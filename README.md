# 🎓 GPT AI Assistant For Task Automation

A full-stack AI-powered college assistant for **Prof. Ram Meghe Institute of Technology & Research, Badnera-Amravati**.

Students get a smart chat assistant, an exam question probability analyzer, a direct line to ask their teacher doubts, and a full assignment lifecycle — download, submit, and receive grades. Teachers manage all of this from one clean dashboard.

---

## ✨ Feature Overview

### 👨‍🎓 Student Portal

| Tab | Feature |
|---|---|
| 💬 **Chat Assistant** | RAG-powered Q&A using Ollama (LLaMA 3) + ChromaDB vector store |
| 📊 **Question Analyzer** | Upload past papers → auto-extract questions → TF-IDF probability scoring |
| 📚 **Assignments** | View posted assignments, download question files, upload your submission |
| ❓ **Ask Teacher** | Submit doubts directly to the teacher; get notified when answered |
| 🔔 **Notification Bell** | Real-time badge alerts for new assignments and answered doubts |

### 👩‍🏫 Teacher Portal

| Tab | Feature |
|---|---|
| 📝 **Add Assignment** | Post any file (PDF, DOCX, ZIP…) with title, subject, due date, description |
| 📥 **Student Doubts** | View all student questions; write and send answers with one click |
| 📤 **Upload Material** | Add PDFs to the RAG knowledge base for the chat assistant |
| 🏆 **Grade Submissions** | Expand any assignment to see all student submissions; download, grade, and leave feedback |

---

## 🧠 Question Analyzer — How It Works

1. **Upload** a past exam paper PDF (any format used at Ram Meghe Institute)
2. **Extraction** — `pdfminer.six` parses the text; two regex strategies handle both `Q.No 1 a` (MSE table format) and `o  Q.1 a)` (bullet-list format)
3. **Subject detection** — 60+ engineering subjects auto-identified per page via header parsing + keyword fallback
4. **TF-IDF deduplication** — similar questions across papers are merged and their frequency incremented (threshold: 82% cosine similarity)
5. **3-factor probability scoring** — recalculated every time a new paper is uploaded:

| Factor | Weight | Description |
|---|---|---|
| Spread | 50% | Fraction of all papers this question appears in |
| Recency | 25% | Exponential decay from last appearance (half-life: 180 days) |
| Topic cluster | 25% | TF-IDF cosine similarity centrality within subject pool |

---

## 🗂️ Project Structure

```
ai-college-portal/
│
├── backend/
│   ├── main.py              # FastAPI app — all API routes
│   ├── database.py          # SQLite schema & query helpers
│   ├── pdf_processor.py     # PDF parsing, subject detection, Q extraction
│   ├── scorer.py            # TF-IDF deduplication + probability scoring
│   ├── requirements.txt     # Python dependencies
│   │
│   ├── uploads/             # Uploaded question-paper PDFs      [git-ignored]
│   ├── assignments/         # Assignment files posted by teacher [git-ignored]
│   ├── submissions/         # Student assignment submissions     [git-ignored]
│   └── exam_predictor.db    # SQLite database                    [git-ignored]
│
└── frontend/
    ├── src/
    │   ├── App.jsx           # All React components & pages
    │   ├── App.css           # Styles
    │   ├── main.jsx          # Vite entry point
    │   └── index.css         # Global reset
    ├── package.json
    └── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Backend runtime |
| Node.js | 18+ | Frontend build tooling |
| Ollama | latest | Local LLM for chat (optional) |

---

### 1 — Clone the Repository

```bash
git clone https://github.com/your-username/ai-college-portal.git
cd ai-college-portal
```

---

### 2 — Backend Setup

```bash
cd backend

# Create and activate a virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn main:app --reload --port 8000
```

The backend will be available at **http://127.0.0.1:8000**  
Interactive API docs at **http://127.0.0.1:8000/docs**

> The SQLite database and all storage folders (`uploads/`, `assignments/`, `submissions/`) are created automatically on first run.

---

### 3 — Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

The app will be available at **http://localhost:5173**

---

### 4 — (Optional) Chat Assistant — Ollama + LLaMA 3

```bash
# Install Ollama  (macOS / Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the LLaMA 3 model  (~4 GB)
ollama pull llama3

# Verify it is running
curl http://localhost:11434/api/tags
```

> If Ollama is not running, the Chat tab returns a graceful error. All other features work without it.

---

### 5 — (Optional) RAG Vector Store — ChromaDB

For context-aware chat using your own uploaded notes:

```bash
pip install chromadb sentence-transformers
```

Then uncomment the two lines at the bottom of `requirements.txt` and restart the backend. Use **Teacher → Upload Material** to add PDFs to the knowledge base.

---

## 🔑 Demo Credentials

| Role | Username | Password |
|---|---|---|
| 👩‍🏫 Teacher | `admin` | `teacher123` |
| 👨‍🎓 Student | `student` | `student123` |

> ⚠️ These are hardcoded demo credentials. Replace with a proper auth system (JWT + hashed passwords) before any production use.

---

## 📡 API Reference

### Core

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Dashboard stats |
| `GET` | `/api/questions` | Paginated questions (filter / sort / search) |
| `GET` | `/api/subjects` | Subjects in question bank |
| `GET` | `/api/subjects_list` | Full 60+ subject catalogue |
| `GET` | `/api/papers` | All uploaded question papers |
| `POST` | `/api/upload-paper` | Upload PDF for question extraction |
| `DELETE` | `/api/delete_paper/{id}` | Remove paper + orphaned questions |
| `POST` | `/api/rescore` | Manually retrigger probability scoring |

### Assignments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/assignments` | List all assignments (with submission counts) |
| `POST` | `/api/assignments` | Post a new assignment (multipart) |
| `GET` | `/api/assignments/{id}/download` | Download assignment file |
| `DELETE` | `/api/assignments/{id}` | Delete assignment + file |

### Submissions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/assignments/{id}/submit` | Student uploads their work |
| `GET` | `/api/assignments/{id}/submissions` | Teacher views all submissions |
| `GET` | `/api/submissions/student/{name}` | Student views their own submissions |
| `GET` | `/api/submissions/{id}/download` | Download a submission file |
| `PUT` | `/api/submissions/{id}/grade` | Teacher saves grade + feedback |
| `DELETE` | `/api/submissions/{id}` | Delete a submission |

### Doubts (Student ↔ Teacher Q&A)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/doubts` | Student submits a doubt |
| `GET` | `/api/doubts` | Teacher views all doubts (filter by status / subject) |
| `GET` | `/api/doubts/student/{name}` | Student views their own doubts |
| `PUT` | `/api/doubts/{id}/answer` | Teacher sends an answer |
| `DELETE` | `/api/doubts/{id}` | Delete a doubt |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ask` | Chat with LLM (RAG-augmented if ChromaDB is enabled) |

---

## 🛠️ Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async REST API framework
- [pdfminer.six](https://pdfminersix.readthedocs.io/) — text-layer PDF extraction
- [scikit-learn](https://scikit-learn.org/) — TF-IDF vectorisation & cosine similarity
- [SQLite](https://www.sqlite.org/) — embedded database via Python `sqlite3`
- [Ollama](https://ollama.com/) — local LLM inference (LLaMA 3)

**Frontend**
- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Axios](https://axios-http.com/) — HTTP client
- [Lucide React](https://lucide.dev/) — icon library

---

## 📄 Supported PDF Formats

| Style | Example line | Supported |
|---|---|---|
| MSE table format | `Q.No 1 a   Explain data structures` | ✅ |
| Bullet-list format | `o  Q.1 a) What do you mean by...` | ✅ |
| Multi-subject (one PDF, multiple subjects across pages) | — | ✅ |
| Scanned / image-only PDF | No text layer | ❌ |

---

## 🗃️ Database Schema

```
papers          — uploaded question-paper PDFs
questions       — extracted questions with probability scores
question_papers — many-to-many link between questions and papers
assignments     — teacher-posted assignments
submissions     — student file submissions linked to assignments
doubts          — student questions + teacher answers
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📃 License

This project is for academic and educational use at Prof. Ram Meghe Institute of Technology & Research, Badnera-Amravati.
