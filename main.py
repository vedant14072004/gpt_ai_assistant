"""
main.py  —  AI College Portal API  (FastAPI)
Run:  uvicorn main:app --reload --port 8000
"""
from __future__ import annotations
import os, threading, mimetypes
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import requests as _http

import database as db
import pdf_processor as pp
import scorer as sc

# ── Optional RAG ──────────────────────────────────────────────────────────────
try:
    import chromadb
    from chromadb.utils import embedding_functions
    _ef  = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
    _chr = chromadb.PersistentClient(path="db")
    _col = _chr.get_collection(name="college_info", embedding_function=_ef)
    RAG_AVAILABLE = True
except Exception:
    RAG_AVAILABLE = False

# ── Folders ────────────────────────────────────────────────────────────────────
BASE_DIR            = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER       = os.path.join(BASE_DIR, "uploads")
ASSIGNMENT_FOLDER   = os.path.join(BASE_DIR, "assignments")
SUBMISSION_FOLDER   = os.path.join(BASE_DIR, "submissions")
MAX_MB              = 50
for _d in (UPLOAD_FOLDER, ASSIGNMENT_FOLDER, SUBMISSION_FOLDER):
    os.makedirs(_d, exist_ok=True)

app = FastAPI(title="AI College Portal API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)
db.init_db()
_lock = threading.Lock()

# ── Extended DB init (assignments + doubts + submissions) ──────────────────────
def _init_extra_tables():
    conn = db.get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS assignments (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            title         TEXT NOT NULL,
            subject       TEXT NOT NULL DEFAULT 'General',
            description   TEXT DEFAULT '',
            due_date      TEXT DEFAULT '',
            filename      TEXT NOT NULL,
            original_name TEXT NOT NULL,
            posted_by     TEXT DEFAULT 'Teacher',
            posted_at     TEXT DEFAULT CURRENT_TIMESTAMP,
            file_size     INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS doubts (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name  TEXT NOT NULL DEFAULT 'Student',
            subject       TEXT NOT NULL DEFAULT 'General',
            question      TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'pending',
            answer        TEXT DEFAULT '',
            answered_by   TEXT DEFAULT '',
            created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
            answered_at   TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS submissions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            assignment_id   INTEGER NOT NULL,
            student_name    TEXT NOT NULL DEFAULT 'Student',
            filename        TEXT NOT NULL,
            original_name   TEXT NOT NULL,
            submitted_at    TEXT DEFAULT CURRENT_TIMESTAMP,
            file_size       INTEGER DEFAULT 0,
            grade           TEXT DEFAULT '',
            feedback        TEXT DEFAULT '',
            FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()

_init_extra_tables()

# ── Helpers ────────────────────────────────────────────────────────────────────
def _rescore_all():
    with _lock:
        papers    = db.get_all_papers()
        questions = db.get_all_questions()
        if not questions: return
        scored = sc.calculate_probabilities(questions, total_papers=len(papers))
        db.update_probabilities(scored)

def _safe_name(name: str) -> str:
    name = os.path.basename(name)
    name = "".join(c for c in name if c.isalnum() or c in "._- ").strip()
    return name or "file"

def _size_str(b: int) -> str:
    return f"{b/1024:.1f} KB" if b < 1_048_576 else f"{b/1_048_576:.1f} MB"

class ChatRequest(BaseModel):
    prompt: str

class DoubtRequest(BaseModel):
    student_name: str = "Student"
    subject:      str = "General"
    question:     str

class AnswerRequest(BaseModel):
    answer:      str
    answered_by: str = "Teacher"

class GradeRequest(BaseModel):
    grade:    str = ""
    feedback: str = ""

# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "AI College Portal API running!", "rag": RAG_AVAILABLE}

# ── Core: Stats, Subjects, Papers, Questions ──────────────────────────────────
@app.get("/api/stats")        
def api_stats():          return db.get_stats()

@app.get("/api/subjects")     
def api_subjects():       return db.get_subjects()

@app.get("/api/subjects_list")
def api_subjects_list():  return pp.ENGINEERING_SUBJECTS

@app.get("/api/papers")       
def api_papers():         return db.get_all_papers()

@app.get("/api/questions")
def api_questions(
    subject:  str = Query("All"),
    search:   str = Query(""),
    sort:     str = Query("probability"),
    page:     int = Query(1,  ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    qs = db.get_all_questions(subject if subject != "All" else None)
    if search:
        lo = search.strip().lower()
        qs = [q for q in qs if lo in q["text"].lower()]
    if sort == "subject":       qs.sort(key=lambda q: q["subject"])
    elif sort == "frequency":   qs.sort(key=lambda q: q["frequency"], reverse=True)
    else:                       qs.sort(key=lambda q: q["probability"], reverse=True)
    total = len(qs)
    s, e  = (page-1)*per_page, page*per_page
    return {"questions": qs[s:e], "total": total, "page": page,
            "per_page": per_page, "total_pages": max(1,(total+per_page-1)//per_page)}

# ── Paper upload ───────────────────────────────────────────────────────────────
async def _handle_upload(file: UploadFile, manual_subject: str = ""):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are accepted.")
    content = await file.read()
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_MB} MB limit.")
    filename  = _safe_name(file.filename)
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    base, ext = os.path.splitext(filename)
    c = 1
    while os.path.exists(save_path):
        filename = f"{base}_{c}{ext}"; save_path = os.path.join(UPLOAD_FOLDER, filename); c += 1
    with open(save_path, "wb") as f: f.write(content)
    try:
        sections = pp.process_pdf_multisubject(save_path)
    except (RuntimeError, ValueError) as exc:
        os.remove(save_path); raise HTTPException(422, str(exc))
    ms = manual_subject.strip()
    if ms:
        sections = [(ms, pages, qs) for (_, pages, qs) in sections]
    total_pages = sum(p for _, p, _ in sections)
    total_qs    = sum(len(q) for _, _, q in sections)
    if total_qs == 0:
        os.remove(save_path); raise HTTPException(422, "No questions could be extracted.")
    existing_qs    = db.get_all_questions()
    existing_texts = [q["text"] for q in existing_qs]
    vec, mat       = (sc.build_tfidf(existing_texts) if existing_texts else (None, None))
    added = merged = 0; paper_ids: list[int] = []
    for subject, sec_pages, questions in sections:
        paper_id = db.insert_paper(filename, subject, sec_pages, len(questions))
        paper_ids.append(paper_id)
        now = datetime.utcnow().isoformat()
        for q_text in questions:
            idx = sc.find_similar_existing(q_text, existing_texts, vec, mat)
            if idx is not None:
                mid = existing_qs[idx]["id"]
                conn = db.get_db()
                conn.execute("UPDATE questions SET frequency=frequency+1, last_seen=? WHERE id=?", (now, mid))
                conn.execute("INSERT OR IGNORE INTO question_papers (question_id, paper_id) VALUES (?,?)", (mid, paper_id))
                conn.commit(); conn.close(); merged += 1
            else:
                db.insert_or_update_question(q_text, subject, paper_id); added += 1
    _rescore_all()
    subjects_found = [s for s, _, _ in sections]
    return {"success": True, "filename": filename,
            "subject": ms if ms else ", ".join(subjects_found),
            "subjects": subjects_found, "pages": total_pages,
            "extracted": total_qs, "new": added, "merged": merged,
            "paper_ids": paper_ids, "multi": len(sections) > 1}

@app.post("/api/upload-paper")
async def api_upload_paper(file: UploadFile = File(...), subject: str = Form("")):
    return await _handle_upload(file, subject)

@app.post("/api/upload")
async def api_upload(file: UploadFile = File(...), subject: str = Form("")):
    return await _handle_upload(file, subject)

@app.delete("/api/delete_paper/{paper_id}")
def api_delete_paper(paper_id: int):
    db.delete_paper(paper_id); _rescore_all(); return {"success": True}

@app.post("/api/rescore")
def api_rescore():
    _rescore_all(); return {"success": True}

# ══════════════════════════════════════════════════════════════════════════════
# ASSIGNMENTS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/assignments")
async def post_assignment(
    title:       str        = Form(...),
    subject:     str        = Form("General"),
    description: str        = Form(""),
    due_date:    str        = Form(""),
    file:        UploadFile = File(...),
):
    content = await file.read()
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_MB} MB limit.")
    ts          = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    stored_name = f"{ts}_{_safe_name(os.path.splitext(file.filename)[0])}{os.path.splitext(file.filename)[1] or '.bin'}"
    with open(os.path.join(ASSIGNMENT_FOLDER, stored_name), "wb") as f: f.write(content)
    conn = db.get_db()
    cur  = conn.execute(
        "INSERT INTO assignments (title,subject,description,due_date,filename,original_name,file_size) VALUES (?,?,?,?,?,?,?)",
        (title.strip(), subject.strip(), description.strip(), due_date.strip(), stored_name, file.filename, len(content))
    )
    aid = cur.lastrowid; conn.commit(); conn.close()
    return {"success": True, "id": aid, "title": title, "filename": stored_name}

@app.get("/api/assignments")
def get_assignments(subject: str = Query("All")):
    conn = db.get_db()
    if subject != "All":
        rows = conn.execute("SELECT * FROM assignments WHERE subject=? ORDER BY posted_at DESC", (subject,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM assignments ORDER BY posted_at DESC").fetchall()
    # Attach submission count to each assignment
    result = []
    for r in rows:
        d = dict(r)
        d["file_size_str"] = _size_str(d.get("file_size", 0))
        d["submission_count"] = conn.execute(
            "SELECT COUNT(*) FROM submissions WHERE assignment_id=?", (d["id"],)
        ).fetchone()[0]
        result.append(d)
    conn.close()
    return result

@app.get("/api/assignments/{assignment_id}/download")
def download_assignment(assignment_id: int):
    conn = db.get_db()
    row  = conn.execute("SELECT * FROM assignments WHERE id=?", (assignment_id,)).fetchone()
    conn.close()
    if not row: raise HTTPException(404, "Assignment not found.")
    path = os.path.join(ASSIGNMENT_FOLDER, row["filename"])
    if not os.path.exists(path): raise HTTPException(404, "File not found on server.")
    mime, _ = mimetypes.guess_type(row["original_name"])
    return FileResponse(path, media_type=mime or "application/octet-stream",
                        filename=row["original_name"],
                        headers={"Content-Disposition": f'attachment; filename="{row["original_name"]}"'})

@app.delete("/api/assignments/{assignment_id}")
def delete_assignment(assignment_id: int):
    conn = db.get_db()
    row  = conn.execute("SELECT filename FROM assignments WHERE id=?", (assignment_id,)).fetchone()
    if row:
        path = os.path.join(ASSIGNMENT_FOLDER, row["filename"])
        if os.path.exists(path): os.remove(path)
        conn.execute("DELETE FROM assignments WHERE id=?", (assignment_id,))
        conn.commit()
    conn.close()
    return {"success": True}

# ══════════════════════════════════════════════════════════════════════════════
# ASSIGNMENT SUBMISSIONS
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/assignments/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: int,
    student_name:  str        = Form("Student"),
    file:          UploadFile = File(...),
):
    # Verify assignment exists
    conn = db.get_db()
    asg  = conn.execute("SELECT id FROM assignments WHERE id=?", (assignment_id,)).fetchone()
    conn.close()
    if not asg: raise HTTPException(404, "Assignment not found.")

    content = await file.read()
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_MB} MB limit.")

    ts          = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_student = _safe_name(student_name)
    stored_name  = f"{ts}_{safe_student}_{_safe_name(os.path.splitext(file.filename)[0])}{os.path.splitext(file.filename)[1] or '.bin'}"
    with open(os.path.join(SUBMISSION_FOLDER, stored_name), "wb") as f: f.write(content)

    conn = db.get_db()
    cur  = conn.execute(
        "INSERT INTO submissions (assignment_id, student_name, filename, original_name, file_size) VALUES (?,?,?,?,?)",
        (assignment_id, student_name.strip(), stored_name, file.filename, len(content))
    )
    sid = cur.lastrowid; conn.commit(); conn.close()
    return {"success": True, "id": sid, "filename": stored_name}

@app.get("/api/assignments/{assignment_id}/submissions")
def get_submissions_for_assignment(assignment_id: int):
    conn  = db.get_db()
    rows  = conn.execute(
        "SELECT * FROM submissions WHERE assignment_id=? ORDER BY submitted_at DESC", (assignment_id,)
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["file_size_str"] = _size_str(d.get("file_size", 0))
        result.append(d)
    return result

@app.get("/api/submissions/student/{student_name}")
def get_student_submissions(student_name: str):
    conn = db.get_db()
    rows = conn.execute("""
        SELECT s.*, a.title as assignment_title, a.subject as assignment_subject,
               a.due_date, a.description as assignment_description
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE s.student_name=?
        ORDER BY s.submitted_at DESC
    """, (student_name,)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["file_size_str"] = _size_str(d.get("file_size", 0))
        result.append(d)
    return result

@app.get("/api/submissions/{submission_id}/download")
def download_submission(submission_id: int):
    conn = db.get_db()
    row  = conn.execute("SELECT * FROM submissions WHERE id=?", (submission_id,)).fetchone()
    conn.close()
    if not row: raise HTTPException(404, "Submission not found.")
    path = os.path.join(SUBMISSION_FOLDER, row["filename"])
    if not os.path.exists(path): raise HTTPException(404, "File not found on server.")
    mime, _ = mimetypes.guess_type(row["original_name"])
    return FileResponse(path, media_type=mime or "application/octet-stream",
                        filename=row["original_name"],
                        headers={"Content-Disposition": f'attachment; filename="{row["original_name"]}"'})

@app.put("/api/submissions/{submission_id}/grade")
def grade_submission(submission_id: int, req: GradeRequest):
    conn = db.get_db()
    conn.execute("UPDATE submissions SET grade=?, feedback=? WHERE id=?",
                 (req.grade.strip(), req.feedback.strip(), submission_id))
    conn.commit(); conn.close()
    return {"success": True}

@app.delete("/api/submissions/{submission_id}")
def delete_submission(submission_id: int):
    conn = db.get_db()
    row  = conn.execute("SELECT filename FROM submissions WHERE id=?", (submission_id,)).fetchone()
    if row:
        path = os.path.join(SUBMISSION_FOLDER, row["filename"])
        if os.path.exists(path): os.remove(path)
        conn.execute("DELETE FROM submissions WHERE id=?", (submission_id,))
        conn.commit()
    conn.close()
    return {"success": True}

# ══════════════════════════════════════════════════════════════════════════════
# DOUBTS  (student → teacher Q&A)
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/doubts")
def post_doubt(req: DoubtRequest):
    if not req.question.strip():
        raise HTTPException(400, "Question cannot be empty.")
    conn = db.get_db()
    cur  = conn.execute(
        "INSERT INTO doubts (student_name, subject, question) VALUES (?,?,?)",
        (req.student_name.strip(), req.subject.strip(), req.question.strip())
    )
    did = cur.lastrowid; conn.commit(); conn.close()
    return {"success": True, "id": did}

@app.get("/api/doubts")
def get_doubts(status: str = Query("all"), subject: str = Query("All")):
    """Teacher endpoint — returns all doubts with optional filters."""
    conn = db.get_db()
    query  = "SELECT * FROM doubts WHERE 1=1"
    params = []
    if status != "all":
        query += " AND status=?"; params.append(status)
    if subject != "All":
        query += " AND subject=?"; params.append(subject)
    query += " ORDER BY created_at DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/doubts/student/{student_name}")
def get_student_doubts(student_name: str):
    """Student endpoint — returns only their own doubts."""
    conn = db.get_db()
    rows = conn.execute(
        "SELECT * FROM doubts WHERE student_name=? ORDER BY created_at DESC", (student_name,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.put("/api/doubts/{doubt_id}/answer")
def answer_doubt(doubt_id: int, req: AnswerRequest):
    if not req.answer.strip():
        raise HTTPException(400, "Answer cannot be empty.")
    now  = datetime.utcnow().isoformat()
    conn = db.get_db()
    conn.execute(
        "UPDATE doubts SET answer=?, answered_by=?, status='answered', answered_at=? WHERE id=?",
        (req.answer.strip(), req.answered_by.strip(), now, doubt_id)
    )
    conn.commit(); conn.close()
    return {"success": True}

@app.delete("/api/doubts/{doubt_id}")
def delete_doubt(doubt_id: int):
    conn = db.get_db()
    conn.execute("DELETE FROM doubts WHERE id=?", (doubt_id,))
    conn.commit(); conn.close()
    return {"success": True}

# ── Chat ───────────────────────────────────────────────────────────────────────
@app.post("/ask")
def ask_question(req: ChatRequest):
    context: list[str] = []
    if RAG_AVAILABLE:
        try:
            results = _col.query(query_texts=[req.prompt], n_results=2)
            context = results["documents"][0]
        except Exception: pass
    augmented = (f"Using this context: '{' '.join(context)}', answer: '{req.prompt}'"
                 if context else req.prompt)
    try:
        r = _http.post("http://localhost:11434/api/generate",
            json={"model": "llama3", "prompt": augmented, "stream": False}, timeout=60)
        r.raise_for_status()
        return {"response": r.json().get("response", "No response content.")}
    except Exception as exc:
        return {"response": f"Error: Could not reach the language model. ({exc})"}
