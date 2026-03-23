"""
pdf_processor.py  —  Engineering Exam PDF Processor (v5)

Handles Ram Meghe / similar institute exam paper PDFs:
  • Multi-subject PDF (each page = different subject)
  • "Name of Subject :" and value on SEPARATE lines (two-column header)
  • Q-markers alone on a line, text on next line(s)
  • Two-column table: all Q-numbers first, then all texts (page 4 pattern)
  • Sub-parts a)/b)/c) as separate questions
  • Instruction lines skipped
  • Mathematical / symbolic content preserved
"""

import re
from typing import List, Tuple, Dict, Optional

from pdfminer.high_level import extract_text
from pdfminer.layout import LAParams


# ── Engineering subjects catalogue ────────────────────────────────────────────
ENGINEERING_SUBJECTS: List[str] = [
    "Engineering Mathematics", "Applied Mathematics", "Engineering Maths",
    "Advanced Engineering Mathematics", "Discrete Mathematics", "Discrete Structures",
    "Linear Algebra", "Probability and Statistics", "Numerical Methods", "Calculus",
    "Data Structures and Algorithms", "Data Structures", "Design and Analysis of Algorithms",
    "Analysis of Algorithms", "Algorithms", "Theory of Computation",
    "Formal Languages and Automata", "Compiler Design", "Compiler Construction",
    "Object Oriented Programming", "Object Oriented Design",
    "Programming Methodology", "Programming in C", "C Programming",
    "Programming in Java", "Java Programming", "Python Programming", "Programming in Python",
    "Operating Systems", "Computer Networks", "Network Security",
    "Cryptography and Network Security", "Cryptography", "Distributed Systems",
    "Computer Organization and Architecture", "Computer Organization", "Computer Architecture",
    "Microprocessors and Microcontrollers", "Microprocessors", "Embedded Systems",
    "Database Management Systems", "Database Management", "DBMS",
    "Software Engineering", "Software Testing", "Human Computer Interaction",
    "Web Technologies", "Mobile Computing", "Cloud Computing",
    "Machine Learning", "Deep Learning", "Artificial Intelligence",
    "Computer Vision", "Natural Language Processing", "Information Retrieval",
    "Big Data Analytics",
    "Digital Electronics", "Digital Logic Design", "Digital Circuits",
    "Analog Electronics", "Analog Circuits", "Electronic Devices and Circuits",
    "Analog and Digital Devices", "Analog & Digital Devices",
    "VLSI Design", "VLSI Technology", "Signals and Systems",
    "Digital Signal Processing", "Signal Processing", "Communication Systems",
    "Communication Engineering", "Wireless Communication",
    "Electromagnetic Theory", "Electromagnetic Fields",
    "Control Systems", "Control Engineering",
    "Power Systems", "Power Electronics", "Electrical Machines",
    "Electrical Circuits", "Circuit Theory", "Network Analysis", "Instrumentation",
    "Thermodynamics", "Fluid Mechanics", "Fluid Dynamics", "Heat Transfer",
    "Strength of Materials", "Mechanics of Materials", "Theory of Machines",
    "Kinematics of Machines", "Dynamics of Machinery",
    "Manufacturing Processes", "Manufacturing Engineering", "Industrial Engineering",
    "Engineering Mechanics", "Structural Analysis", "Concrete Technology",
    "Reinforced Concrete", "Geotechnical Engineering", "Soil Mechanics",
    "Transportation Engineering", "Environmental Engineering", "Surveying",
    "Engineering Drawing", "Engineering Graphics",
    "Engineering Physics", "Engineering Chemistry",
    "Basic Electronics", "Basic Electrical Engineering",
    "Basic Civil Engineering", "Basic Mechanical Engineering",
    "Workshop Practice", "Environmental Science",
    "Introduction to Constitutional Law", "Constitutional Law",
    "Professional Ethics", "Management", "Economics for Engineers",
]

_SUBJECT_RE_LIST = [
    (re.compile(r'\b' + re.escape(s) + r'\b', re.IGNORECASE), s)
    for s in ENGINEERING_SUBJECTS
]

# ── Instruction phrases ───────────────────────────────────────────────────────
_INSTR_PHRASES = [
    'assume suitable data', 'write answers only', 'use of mobile',
    'blue tooth device', 'programmable calculator', 'strictly prohibited',
    'draw sketches', 'draw diagrams', 'blue/black pen', 'blue/ black pen',
    'clearly state the assumption', 'neatly and cleanly', 'during the examination',
]
def _is_instruction(s: str) -> bool:
    lo = s.lower()
    return any(p in lo for p in _INSTR_PHRASES)

# Lines that are definitely metadata / should be skipped entirely
_METADATA_RE = re.compile(
    r'^\s*('
    r'OR'
    r'|marks\s+(co|only)|\bmarks\b$|\bco\d*\b$'
    r'|name\s+of\s+(examination|program|subject|course)'
    r'|subject\s+code'
    r'|second\s+year|third\s+year|fourth\s+year|first\s+year'
    r'|department\s+of'
    r'|prof\.?\s*ram|an\s+autonomous|autonomous\s+institute'
    r'|mid\s+semester|end\s+semester|semester\s+examination'
    r'|time\s*[:\-]\s*\d|time\s*:\s*\d|time\s*:\s*1'
    r'|maximum\s+marks?'
    r'|instructions?\s*to\s*examinees?'
    r'|nstructions?\s*to'
    r'|\(msie?\)|\(mse\)'
    r'|examination\s*\(msie?\)'
    # ── NEW: section / unit / year / subject header lines ──────────────
    r'|section\s+[ab]'                          # SECTION A, SECTION B
    r'|[•\u2022]\s*unit[\s\-]*\d'               # • UNIT-1, • UNIT-2
    r'|\bunit[\s\-]*\d+\b'                      # UNIT-1  UNIT-2 alone
    r'|winter[\s\-]*20\d{2}|summer[\s\-]*20\d{2}'  # WINTER-2023, SUMMER-2024
    r'|subject\s*:\s*[a-z]'                     # SUBJECT : DATA MINING
    r'|subject\s*name\s*:'                      # SUBJECT NAME:
    r'|[o\u25e6\-]\s*or\s*$'                    # o OR (alone)
    r')\s*[.:]*\s*$',
    re.IGNORECASE
)

# Longer / combined metadata strings that appear as a single line sometimes
_META_CONTAIN = re.compile(
    r'time\s*:\s*\d+\s*hr|maximum\s+marks|mid\s+semester\s+exam'
    r'|^subject\s*:\s*\S'          # "SUBJECT : DATA MINING"
    r'|^[o\u2022]\s+or\s*$',       # bullet OR line
    re.IGNORECASE
)

def _is_meta(line: str) -> bool:
    if _METADATA_RE.match(line):
        return True
    if _META_CONTAIN.search(line) and len(line) < 100:
        return True
    if re.fullmatch(r'[\d\s()\-COco.]+', line):
        return True
    return False


# ── Q-marker patterns ─────────────────────────────────────────────────────────
# 'l' (lowercase L) is OCR artefact for '1' in some papers

_Q_WITH_TEXT = [
    # Standard "Q.No 1 a  text" and "Q.No 1a text"
    re.compile(r'^Q\.?\s*No\.?\s*[0-9lLoO]+\s*[a-dA-D]?\s{2,}(.+)', re.IGNORECASE),
    re.compile(r'^Q\.?\s*No\.?\s*[0-9lLoO]+[a-dA-D]\s+(.+)', re.IGNORECASE),
    re.compile(r'^Q\.?\s*No\.?\s*[0-9lLoO]+\s{2,}(.+)', re.IGNORECASE),
    re.compile(r'^Q\.?\s*[0-9lLoO]+\s*[.,)]\s*[a-dA-D][.)]\s*(.+)', re.IGNORECASE),
    re.compile(r'^Q\.?\s*[0-9lLoO]+\s*[.,)]\s*(.+)', re.IGNORECASE),
    # "Q.1 a) text"  — number, space, letter, closing paren (bullet-PDF style after stripping)
    re.compile(r'^Q\.?\s*[0-9lLoO]+\s+[a-dA-D]\s*[.)]\s*(.+)', re.IGNORECASE),
    # "Q.3 Predict …" — no sub-letter at all (just Q.N text)
    re.compile(r'^Q\.?\s*[0-9lLoO]+\s+(?![a-dA-D]\s*[.)])(.+)', re.IGNORECASE),
    # Bullet-style  "o Q.1 a) text"  when bullet was NOT already stripped
    re.compile(r'^[o\u2022\u25e6\-]\s+Q\.?\s*[0-9lLoO]+\s*[a-dA-D]?\s*[.)]\s*(.+)', re.IGNORECASE),
    re.compile(r'^[o\u2022\u25e6\-]\s+Q\.?\s*No\.?\s*[0-9lLoO]+\s*[a-dA-D]?\s*[.)]\s*(.+)', re.IGNORECASE),
]
_Q_ALONE = re.compile(
    r'^(?:[o\u2022\u25e6\-]\s+)?Q(?:\.?\s*No\.?\s*)?\.?\s*[0-9lLoO]+\s*[.,]?\s*[a-dA-D]?\s*[.,)]?\s*$',
    re.IGNORECASE
)

def _match_q(line: str) -> Tuple[bool, str]:
    for pat in _Q_WITH_TEXT:
        m = pat.match(line)
        if m:
            return True, m.group(1).strip()
    if _Q_ALONE.match(line):
        return True, ''
    return False, ''


# ── Sub-part / roman numerals ─────────────────────────────────────────────────
_SUBPART_RE = re.compile(r'^\s*([a-dA-D])\s*[.)]\s+(.+)', re.IGNORECASE)
_ROMAN_RE   = re.compile(r'^\s*(?:i{1,3}|iv|vi{0,3}|ix?)\s*[.)]\s+', re.IGNORECASE)


# ── Sentence completion check ─────────────────────────────────────────────────
def _ends_sentence(s: str) -> bool:
    """True if the string ends with terminal punctuation (period, ?, !)."""
    return bool(re.search(r'[.?!]\s*$', s))


# ── Valid question heuristic ──────────────────────────────────────────────────
def _is_valid_q(s: str) -> bool:
    if len(s) < 20:
        return False
    if _is_instruction(s):
        return False
    if _is_meta(s):
        return False
    if re.fullmatch(r'[\d\s.,:;()\-CO/]+', s, re.IGNORECASE):
        return False
    return True


def _normalize(s: str) -> str:
    s = re.sub(r'\s+', ' ', s).strip()
    return s.rstrip('([')


# ── Subject extraction ─────────────────────────────────────────────────────────

# Header labels that should NOT be mistaken for subject names
_HDR_LABEL_RE = re.compile(
    r'^(?:name\s+of|subject\s+code|second\s+year|third\s+year|first\s+year'
    r'|fourth\s+year|department|time\s*:|maximum|prof\.|an\s+auto'
    r'|444701|444\d{3}|mid\s+semester|[\d(]+)',
    re.IGNORECASE
)

_SUBJ_HDR_RE = re.compile(r'name\s+of\s+subject\s*[:\-–]?\s*(.*)', re.IGNORECASE)
_SUBJ_LBL_RE = re.compile(
    r'(?:subject\s*(?:name|title)?|course\s*(?:name|title)?|paper\s*(?:name|title)?)'
    r'\s*[:\-–]\s*(.+)', re.IGNORECASE
)
_CODE_RE = re.compile(r'\b[A-Z]{2,6}\s*[-_]?\s*\d{3,4}[A-Z]?\b')
_DATE_RE = re.compile(r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b', re.IGNORECASE)


def _clean_subj(raw: str) -> str:
    raw = _CODE_RE.sub('', raw)
    raw = re.sub(r'\s+', ' ', raw).strip().strip(':-–.,;()')
    if raw.isupper() and len(raw) > 2:
        raw = raw.title()
    return raw[:80]


def _find_known(text: str) -> Optional[str]:
    for pat, name in _SUBJECT_RE_LIST:
        if pat.search(text):
            return name
    return None


def extract_subject_from_page(page_text: str) -> str:
    lines = [l.strip() for l in page_text.splitlines() if l.strip()]

    # Pass 1: "Name of Subject: Discrete Mathematics" — value on SAME line
    for i, line in enumerate(lines[:40]):
        m = _SUBJ_HDR_RE.search(line)
        if m:
            val = _clean_subj(m.group(1))
            if val and len(val) > 3 and not _DATE_RE.search(val) and not _HDR_LABEL_RE.match(val):
                known = _find_known(val)
                return known if known else val

            # Value was blank → search following non-label lines
            for j in range(i + 1, min(i + 10, len(lines))):
                candidate_raw = lines[j]
                # Skip obvious header labels
                if _HDR_LABEL_RE.match(candidate_raw):
                    continue
                candidate = _clean_subj(candidate_raw)
                if not candidate or len(candidate) < 4 or _DATE_RE.search(candidate):
                    continue
                # Subject names contain real words, not just codes
                if re.fullmatch(r'[A-Z0-9\s\-()&]+', candidate) and not re.search(r'[a-z]{3,}', candidate):
                    # Could be a code — check known first
                    known = _find_known(candidate)
                    if known:
                        return known
                    continue
                known = _find_known(candidate)
                if known:
                    return known
                # Accept raw candidate if it has alphabetic words (looks like a subject)
                if re.search(r'[A-Za-z]{4,}', candidate) and not _HDR_LABEL_RE.match(candidate):
                    return candidate
            break

    # Pass 2: "Subject Name: ..." same line
    for line in lines[:40]:
        m = _SUBJ_LBL_RE.search(line)
        if m:
            val = _clean_subj(m.group(1))
            if val and len(val) > 3 and not _DATE_RE.search(val):
                known = _find_known(val)
                return known if known else val

    # Pass 3: standalone known-subject line in first 30 lines
    for line in lines[:30]:
        if len(line) < 4 or len(line) > 90 or re.match(r'^\d', line):
            continue
        if _HDR_LABEL_RE.match(line):
            continue
        known = _find_known(line)
        if known:
            return known

    return _keyword_fallback(page_text)


def _keyword_fallback(text: str) -> str:
    clusters = {
        "Discrete Mathematics": [
            'tautology','contradiction','contingency','predicate','quantifier',
            'proposition','logical connective','truth table','conjunctive normal form',
            'boolean algebra','equivalence','graph coloring','lattice','permutation',
        ],
        "Data Structures": [
            'linked list','binary tree','sorting','hashing','heap','traversal',
            'linear array','insertion','binary search','stack','queue','substring',
            'indexing','pattern matching','record structure',
        ],
        "Programming Methodology": [
            'jvm','byte code','java','class','constructor','method',
            'for loop','fibonacci','factorial','single dimensional array',
            'operator','variable','inheritance','polymorphism',
        ],
        "Analog and Digital Devices": [
            'p-n junction','diode','transistor','zener','avalanche','breakdown',
            'reverse bias','forward bias','knee voltage','icbo','iceo',
            'collector current','emitter current','v-i characteristics',
            'ce configuration','npn','pnp',
        ],
        "Introduction to Constitutional Law": [
            'constitution','preamble','fundamental rights','article','parliament',
            'judicial review','supreme court','directive principles','citizenship',
        ],
        "Operating Systems": ['process','thread','scheduling','deadlock','semaphore','paging'],
        "Computer Networks": ['tcp','udp','ip address','osi','http','dns','router'],
        "Database Management Systems": ['sql','normalization','transaction','acid','join'],
        "Engineering Mathematics": [
            'differential equation','eigenvalue','fourier series','vector calculus',
            'integration','determinant','complex analysis',
        ],
        "Machine Learning": [
            'gradient descent','neural network','regression','classification',
            'clustering','svm','decision tree','overfitting',
        ],
    }
    lower = text.lower()
    scores = {s: sum(lower.count(k) for k in kws) for s, kws in clusters.items()}
    best = max(scores.values(), default=0)
    return max(scores, key=scores.get) if best > 0 else "Engineering"


# ── Question extraction ───────────────────────────────────────────────────────

def extract_questions_from_page(page_text: str) -> List[str]:
    """
    Extract exam questions from a single page.

    Strategy:
      0. Pre-expand: lines like "o Q.1 a) text" are normalised to "Q.1 a) text".
         Long lines containing multiple embedded Q-markers are split at each marker.
      1. Identify and skip instruction block (numbered 1-4 items).
      2. Collect "question-zone" lines, stripping metadata/marks.
      3. Parse Q-markers (alone or with text) and plain text blocks.
      4. Two-column detection: if ≥3 consecutive bare Q-markers appear,
         switch to "sentence-per-question" mode for subsequent text.
    """
    raw_lines = page_text.splitlines()

    # ── Phase 0: normalise bullet-style lines ──────────────────────────────
    # Pattern: optional leading bullet (o / • / - / ◦) followed by a Q marker
    _BULLET_Q = re.compile(
        r'^[o\u2022\u25e6\-]\s+(Q\.?\s*(?:No\.?\s*)?[0-9lLoO]+\s*[a-dA-D]?\s*[.,)]?\s*.*)$',
        re.IGNORECASE
    )
    # Pattern: split a long line at embedded "o Q.X" markers inside it
    _INLINE_Q = re.compile(
        r'(?<!\w)[o\u2022\u25e6]\s+(Q\.?\s*(?:No\.?\s*)?[0-9lLoO]+\s*[a-dA-D]?\s*[.,)])',
        re.IGNORECASE
    )

    expanded: List[str] = []
    for raw in raw_lines:
        stripped = raw.strip()
        if not stripped:
            expanded.append('')
            continue

        # Try stripping leading bullet
        bm = _BULLET_Q.match(stripped)
        if bm:
            expanded.append(bm.group(1).strip())
            continue

        # If line contains multiple embedded "o Q.X" markers → split
        if _INLINE_Q.search(stripped):
            parts = _INLINE_Q.split(stripped)
            # _INLINE_Q has one group, so split gives [before, sep1, after1, sep2, after2 …]
            # Re-join each (sep + after) chunk
            result_parts = [parts[0]] if parts[0].strip() else []
            i = 1
            while i < len(parts) - 1:
                result_parts.append((parts[i] + parts[i + 1]).strip())
                i += 2
            expanded.extend(p for p in result_parts if p.strip())
            continue

        expanded.append(stripped)

    lines = expanded

    # ── Phase A: locate instruction block end ──────────────────────────────
    in_instr = False
    q_zone_start = 0
    for idx, line in enumerate(lines):
        if not line:
            continue
        if re.search(r'instructions?\s*to\s*examinees?|nstructions?\s*to', line, re.IGNORECASE):
            in_instr = True
            continue
        if in_instr:
            if re.match(r'^\d{1,2}[.)]\s+', line) or _is_instruction(line) or _is_meta(line):
                continue
            in_instr = False
            q_zone_start = idx
            break

    # ── Phase B: clean lines, keep only question zone ──────────────────────
    q_lines: List[str] = []
    for line in lines[q_zone_start:]:
        if not line:
            continue
        if _is_meta(line):
            continue
        if _is_instruction(line):
            continue
        if re.fullmatch(r'[\d\s()COco.,\-]+', line):   # pure mark / CO columns
            continue
        q_lines.append(line)

    # ── Phase C: parse questions ───────────────────────────────────────────
    questions: List[str] = []
    buf: List[str] = []
    expect_text = False
    consecutive_q_markers = 0   # for two-column detection
    two_col_mode = False

    def flush():
        if buf:
            q = _normalize(' '.join(buf))
            if _is_valid_q(q):
                questions.append(q)
        buf.clear()

    for line in q_lines:
        is_q, inline = _match_q(line)

        if is_q:
            if inline:
                flush()
                buf.append(inline)
                expect_text = False
                consecutive_q_markers = 0
                two_col_mode = False
            else:
                flush()
                expect_text = True
                consecutive_q_markers += 1
                # After 3 lone Q-markers we're likely in a two-column table
                if consecutive_q_markers >= 3:
                    two_col_mode = True
            continue

        # Reset Q-marker counter on any real text
        consecutive_q_markers = 0

        # Sub-part: "a) Question text"
        sub_m = _SUBPART_RE.match(line)
        if sub_m:
            flush()
            buf.append(sub_m.group(2).strip())
            expect_text = False
            continue

        # Roman-numeral continuation → merge into current
        if _ROMAN_RE.match(line) and buf:
            buf.append(line)
            continue

        # ── Plain text line ────────────────────────────────────────────────
        if two_col_mode:
            # In two-column mode: each line that starts a new sentence (capital
            # letter, or prev question ended with sentence terminator) → new Q
            if buf and (_ends_sentence(' '.join(buf)) or
                        (line[0].isupper() and not line[0].isdigit())):
                flush()
            buf.append(line)
        else:
            buf.append(line)
            expect_text = False

    flush()
    return questions


# ── Main entry points ─────────────────────────────────────────────────────────

def process_pdf_multisubject(path: str) -> List[Tuple[str, int, List[str]]]:
    """
    Process a multi-subject engineering exam PDF.
    Returns [(subject, pages, [questions]), …]
    """
    params = LAParams(
        line_overlap=0.5, char_margin=2.0, line_margin=0.5,
        word_margin=0.1, boxes_flow=0.5,
        detect_vertical=False, all_texts=False,
    )
    try:
        raw = extract_text(path, laparams=params)
    except Exception as e:
        raise RuntimeError(f"Failed to extract text from PDF: {e}")

    if not raw or len(raw.strip()) < 50:
        raise ValueError(
            "PDF appears to be empty or image-only (no extractable text). "
            "Use a text-based (not scanned) PDF."
        )

    pages = [p for p in raw.split('\x0c') if p.strip()]
    if not pages:
        raise ValueError("No readable pages found in this PDF.")

    sections: List[Tuple[str, int, List[str]]] = []
    current_subject: Optional[str] = None
    current_qs: List[str] = []
    current_pages = 0

    for page_text in pages:
        subject = extract_subject_from_page(page_text)
        qs      = extract_questions_from_page(page_text)
        if not qs:
            continue
        if subject == current_subject:
            current_qs.extend(qs)
            current_pages += 1
        else:
            if current_subject is not None and current_qs:
                sections.append((current_subject, current_pages, current_qs))
            current_subject = subject
            current_qs      = list(qs)
            current_pages   = 1

    if current_subject is not None and current_qs:
        sections.append((current_subject, current_pages, current_qs))

    if not sections:
        raise ValueError(
            "No questions could be extracted. "
            "The PDF may use scanned images or the question format is not recognised."
        )

    return sections


def process_pdf(path: str) -> Tuple[str, int, List[str]]:
    """Backward-compatible single-subject wrapper."""
    results = process_pdf_multisubject(path)
    page_count = sum(r[1] for r in results)
    first_subject = results[0][0] if results else 'Engineering'
    all_q = [q for _, _, qs in results for q in qs]
    return first_subject, page_count, all_q
