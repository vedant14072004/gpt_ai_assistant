"""
scorer.py
Computes exam-appearance probability scores for extracted questions.

Scoring model:
    1. Spread score   – fraction of papers in which this question (or a very
                        similar one) appears. Higher = more likely to recur.
    2. Recency score  – how recently this question was last seen.
                        Recent appearances predict near-future recurrence.
    3. Cluster score  – TF-IDF cosine similarity to other questions in the
                        same subject pool. Questions that belong to dense
                        topic clusters are more "examinable".

Final probability is a weighted combination, scaled to [0, 100].
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import List, Dict

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# ── Similarity deduplication ──────────────────────────────────────────────────

SIMILARITY_THRESHOLD = 0.82   # questions above this are considered "the same"


def _normalize_for_tfidf(text: str) -> str:
    """Lower-case, remove isolated digits and punctuation used in numbering."""
    text = text.lower()
    text = re.sub(r'\b\d+\b', 'NUM', text)   # replace bare numbers with token
    text = re.sub(r'[^\w\s]', ' ', text)
    return text


def build_tfidf(texts: List[str]):
    """Fit a TF-IDF vectorizer and return (vectorizer, matrix)."""
    normed = [_normalize_for_tfidf(t) for t in texts]
    vec = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=10_000,
        sublinear_tf=True
    )
    try:
        mat = vec.fit_transform(normed)
        return vec, mat
    except ValueError:
        return None, None


def find_similar_existing(
    new_text: str,
    existing_texts: List[str],
    vec,
    existing_mat,
    threshold: float = SIMILARITY_THRESHOLD
) -> int | None:
    """
    Return the index into existing_texts of the most similar question,
    or None if no question exceeds the threshold.
    """
    if vec is None or existing_mat is None or not existing_texts:
        return None
    normed = _normalize_for_tfidf(new_text)
    try:
        new_vec = vec.transform([normed])
    except Exception:
        return None
    sims = cosine_similarity(new_vec, existing_mat).flatten()
    best_idx = int(np.argmax(sims))
    return best_idx if sims[best_idx] >= threshold else None


# ── Cluster score ─────────────────────────────────────────────────────────────

def _cluster_scores(texts: List[str]) -> List[float]:
    """
    For each question, compute the mean cosine similarity to all other
    questions. This is a proxy for "how central / core-topic" this question is.
    """
    if len(texts) < 2:
        return [0.5] * len(texts)

    _, mat = build_tfidf(texts)
    if mat is None:
        return [0.5] * len(texts)

    sim_mat = cosine_similarity(mat)
    n = sim_mat.shape[0]
    # Mean similarity excluding self (diagonal)
    scores = []
    for i in range(n):
        others = [sim_mat[i, j] for j in range(n) if j != i]
        scores.append(float(np.mean(others)) if others else 0.0)
    return scores


# ── Recency score ─────────────────────────────────────────────────────────────

def _recency_score(last_seen_iso: str, half_life_days: int = 180) -> float:
    """
    Exponential decay: score = exp(-λ * days_ago)
    where λ = ln(2) / half_life_days.
    A question seen today → 1.0; seen `half_life_days` ago → 0.5.
    """
    try:
        last = datetime.fromisoformat(last_seen_iso)
    except Exception:
        return 0.5
    days_ago = max(0, (datetime.utcnow() - last).days)
    lam = 0.693147 / half_life_days          # ln(2) / half_life
    return float(np.exp(-lam * days_ago))


# ── Main scoring function ─────────────────────────────────────────────────────

WEIGHTS = {
    'spread':   0.50,    # how many papers it appears in
    'recency':  0.25,    # how recently it appeared
    'cluster':  0.25,    # how "core" the topic is
}


def calculate_probabilities(questions: List[Dict], total_papers: int) -> List[Dict]:
    """
    Accepts the full list of question dicts from the DB:
        {id, text, subject, frequency, last_seen, probability, ...}
    Returns the same list with updated 'probability' (0-100, float).

    Processing is done per-subject so that cluster scores are meaningful.
    """
    if not questions:
        return []

    total_papers = max(total_papers, 1)

    # Group by subject
    subjects: Dict[str, List[Dict]] = {}
    for q in questions:
        subjects.setdefault(q['subject'], []).append(q)

    result = []

    for subject, grp in subjects.items():
        texts = [q['text'] for q in grp]
        cluster_sc = _cluster_scores(texts)

        max_freq = max(q['frequency'] for q in grp) or 1

        for i, q in enumerate(grp):
            spread   = min(q['frequency'] / total_papers, 1.0)
            recency  = _recency_score(q['last_seen'])
            cluster  = cluster_sc[i]

            raw = (
                WEIGHTS['spread']  * spread  +
                WEIGHTS['recency'] * recency +
                WEIGHTS['cluster'] * cluster
            )
            grp[i]['_raw'] = raw

        # Normalise within subject so the best question gets ~95 %
        # (we cap at 95 to avoid claiming certainty)
        max_raw = max(q['_raw'] for q in grp) or 1.0
        for q in grp:
            prob = (q['_raw'] / max_raw) * 95.0
            q['probability'] = round(prob, 1)

        result.extend(grp)

    # Global re-scale to keep cross-subject ordering meaningful
    if result:
        global_max = max(q['probability'] for q in result)
        if global_max > 0:
            for q in result:
                q['probability'] = round(q['probability'] / global_max * 95.0, 1)

    return sorted(result, key=lambda x: x['probability'], reverse=True)
