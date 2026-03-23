import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'exam_predictor.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS papers (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT NOT NULL,
            subject     TEXT DEFAULT 'General',
            upload_date TEXT DEFAULT CURRENT_TIMESTAMP,
            page_count  INTEGER DEFAULT 0,
            q_count     INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS questions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            text        TEXT NOT NULL,
            subject     TEXT DEFAULT 'General',
            frequency   INTEGER DEFAULT 1,
            first_seen  TEXT DEFAULT CURRENT_TIMESTAMP,
            last_seen   TEXT DEFAULT CURRENT_TIMESTAMP,
            probability REAL DEFAULT 0.0
        );

        CREATE TABLE IF NOT EXISTS question_papers (
            question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
            paper_id    INTEGER REFERENCES papers(id)    ON DELETE CASCADE,
            PRIMARY KEY (question_id, paper_id)
        );
    ''')
    conn.commit()
    conn.close()


# ── Papers ────────────────────────────────────────────────────────────────────

def insert_paper(filename: str, subject: str, page_count: int, q_count: int) -> int:
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO papers (filename, subject, page_count, q_count) VALUES (?,?,?,?)",
        (filename, subject, page_count, q_count)
    )
    paper_id = cur.lastrowid
    conn.commit()
    conn.close()
    return paper_id


def get_all_papers():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM papers ORDER BY upload_date DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_paper(paper_id: int):
    conn = get_db()
    # Remove mappings; orphaned questions get cleaned up separately
    conn.execute("DELETE FROM question_papers WHERE paper_id=?", (paper_id,))
    conn.execute("DELETE FROM papers WHERE id=?", (paper_id,))
    # Remove questions that no longer appear in any paper
    conn.execute("""
        DELETE FROM questions
        WHERE id NOT IN (SELECT DISTINCT question_id FROM question_papers)
    """)
    conn.commit()
    conn.close()


# ── Questions ─────────────────────────────────────────────────────────────────

def get_all_questions(subject: str = None):
    conn = get_db()
    if subject and subject != 'All':
        rows = conn.execute(
            "SELECT * FROM questions WHERE subject=? ORDER BY probability DESC",
            (subject,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM questions ORDER BY probability DESC"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def insert_or_update_question(text: str, subject: str, paper_id: int) -> int:
    """
    Returns the question_id (existing or newly inserted).
    Increments frequency if the question already exists (exact match).
    """
    conn = get_db()
    now = datetime.utcnow().isoformat()

    existing = conn.execute(
        "SELECT id FROM questions WHERE text=?", (text,)
    ).fetchone()

    if existing:
        q_id = existing['id']
        conn.execute(
            "UPDATE questions SET frequency=frequency+1, last_seen=? WHERE id=?",
            (now, q_id)
        )
    else:
        cur = conn.execute(
            "INSERT INTO questions (text, subject, first_seen, last_seen) VALUES (?,?,?,?)",
            (text, subject, now, now)
        )
        q_id = cur.lastrowid

    # Link to paper (ignore if already linked)
    conn.execute(
        "INSERT OR IGNORE INTO question_papers (question_id, paper_id) VALUES (?,?)",
        (q_id, paper_id)
    )
    conn.commit()
    conn.close()
    return q_id


def update_probabilities(scored: list):
    """Bulk-update probability values."""
    conn = get_db()
    conn.executemany(
        "UPDATE questions SET probability=? WHERE id=?",
        [(s['probability'], s['id']) for s in scored]
    )
    conn.commit()
    conn.close()


def get_subjects():
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT subject FROM questions ORDER BY subject"
    ).fetchall()
    conn.close()
    return [r['subject'] for r in rows]


def get_stats():
    conn = get_db()
    q_count  = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    p_count  = conn.execute("SELECT COUNT(*) FROM papers").fetchone()[0]
    s_count  = conn.execute("SELECT COUNT(DISTINCT subject) FROM questions").fetchone()[0]
    top_q    = conn.execute(
        "SELECT text, probability, subject FROM questions ORDER BY probability DESC LIMIT 1"
    ).fetchone()
    conn.close()
    return {
        'total_questions': q_count,
        'total_papers':    p_count,
        'total_subjects':  s_count,
        'top_question':    dict(top_q) if top_q else None
    }
