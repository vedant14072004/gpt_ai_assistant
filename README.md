# 🎓 GPT AI Assistant for TASK Automation

A full-stack AI-powered college assistant for **Prof. Ram Meghe Institute of Technology & Research**.  
Students get a chat assistant, an exam question probability analyzer, and an assignment notification system. Teachers can upload academic material and post assignments — all from one dashboard.

---

## ✨ Features

### 👨‍🎓 Student Portal
| Feature | Description |
|---|---|
| 💬 **Chat Assistant** | RAG-powered Q&A using Ollama (LLaMA 3) and a ChromaDB vector store |
| 📊 **Question Analyzer** | Upload past papers → auto-extract questions → TF-IDF probability scoring |
| 🔔 **Notifications** | Real-time bell icon alerts when a teacher posts a new assignment |
| 📚 **Assignments Tab** | Download posted assignments with due-date tracking and unread badges |

### 👩‍🏫 Teacher Portal
| Feature | Description |
|---|---|
| 📤 **Upload Material** | Add PDFs to the RAG knowledge base for the chat assistant |
| 📝 **Add Assignment** | Post any file (PDF, DOCX, ZIP…) with title, subject, due date, and description |
| 🗂️ **Manage Assignments** | View and delete all posted assignments from a live dashboard |

### 🧠 Question Analyzer Engine
- **Multi-format PDF parsing** — handles both `Q.No 1 a` (MSE paper style) and `o Q.1 a)` (bullet-list style)
- **Multi-subject detection** — auto-identifies 60+ engineering subjects per page
- **TF-IDF deduplication** — similar questions across papers are merged and frequency-counted
- **3-factor scoring model**:
  - `50%` Spread — fraction of papers the question appears in
  - `25%` Recency — exponential decay from last appearance
  - `25%` Topic-cluster centrality — TF-IDF cosine similarity to subject pool

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
│   ├── uploads/             # Uploaded question-paper PDFs (git-ignored)
│   ├── assignments/         # Posted assignment files (git-ignored)
│   └── exam_predictor.db    # SQLite database (git-ignored)
│
└── frontend/
    ├── src/
    │   ├── App.jsx           # Main React app (all components)
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
| Ollama | latest | Local LLM (LLaMA 3) for chat |

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

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

The backend will be available at **http://127.0.0.1:8000**  
Interactive API docs at **http://127.0.0.1:8000/docs**

---

### 3 — Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite dev server
npm run dev
```

The frontend will be available at **http://localhost:5173**

---

### 4 — (Optional) Chat Assistant — Ollama + LLaMA 3

The chat assistant requires [Ollama](https://ollama.com) running locally.

```bash
# Install Ollama (macOS / Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the LLaMA 3 model (~4 GB)
ollama pull llama3

# Ollama runs automatically; verify it's up
curl http://localhost:11434/api/tags
```

> If Ollama is not running, the chat tab will return a graceful error message. All other features (Question Analyzer, Assignments) work without it.

---

### 5 — (Optional) RAG Vector Store — ChromaDB

To enable context-aware chat using your own uploaded notes:

```bash
pip install chromadb sentence-transformers
```

Then uncomment the relevant lines in `requirements.txt` and restart the backend.  
Use the **Teacher → Upload Material** tab to add PDFs to the knowledge base.

---

## 🔑 Demo Credentials

| Role | Username | Password |
|---|---|---|
| 👩‍🏫 Teacher | `admin` | `teacher123` |
| 👨‍🎓 Student | `student` | `student123` |

> ⚠️ These are hardcoded demo credentials. For production use, replace with a proper authentication system (JWT + hashed passwords).

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/stats` | Dashboard stats (questions, papers, subjects) |
| `GET` | `/api/questions` | Paginated questions with filter/sort/search |
| `GET` | `/api/subjects` | Subjects detected in the question bank |
| `GET` | `/api/subjects_list` | Full catalogue of 60+ engineering subjects |
| `GET` | `/api/papers` | All uploaded question papers |
| `POST` | `/api/upload-paper` | Upload a PDF for question extraction |
| `DELETE` | `/api/delete_paper/{id}` | Remove a paper and orphaned questions |
| `POST` | `/api/rescore` | Manually re-trigger probability scoring |
| `GET` | `/api/assignments` | List all posted assignments |
| `POST` | `/api/assignments` | Post a new assignment (multipart) |
| `GET` | `/api/assignments/{id}/download` | Download an assignment file |
| `DELETE` | `/api/assignments/{id}` | Delete an assignment |
| `POST` | `/ask` | Chat with the LLM (RAG-augmented) |

---

## 🛠️ Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async REST API
- [pdfminer.six](https://pdfminersix.readthedocs.io/) — text extraction from PDFs
- [scikit-learn](https://scikit-learn.org/) — TF-IDF vectorisation & cosine similarity
- [SQLite](https://www.sqlite.org/) — lightweight embedded database (via Python `sqlite3`)
- [Ollama](https://ollama.com/) — local LLM inference

**Frontend**
- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Axios](https://axios-http.com/) — HTTP client
- [Lucide React](https://lucide.dev/) — icon set

---

## 📄 Supported PDF Formats

The question extractor handles both exam paper styles used at Prof. Ram Meghe Institute:

| Style | Example | Status |
|---|---|---|
| `Q.No` table format | `Q.No 1 a   Explain data structures` | ✅ |
| Bullet-list format | `o  Q.1 a) What do you mean by...` | ✅ |
| Multi-subject PDF | Single PDF with Discrete Maths, Data Structures, etc. on separate pages | ✅ |
| Scanned / image PDF | No extractable text layer | ❌ (use text-based PDFs) |

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
