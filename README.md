# Question Paper Alignment Software (QST)

A comprehensive, production-ready educational examination paper alignment and formatting software designed for school teachers following standard **CBSE / ICSE** formats.

---

## 🌟 Key Features

1. **Integrated Web Application**:
   - Single unified backend & frontend server powered by FastAPI and modern vanilla JavaScript / CSS.
   - Run the whole stack with a single command: `python run.py`.
   - Access the full editor & live preview directly at `http://127.0.0.1:8000`.

2. **Two-Pane Live Workspace**:
   - **Left Pane**: Dynamic interactive examination paper editor with section management, marks calculation, and collapsible header details.
   - **Right Pane**: Live A4 formatted examination paper preview reflecting changes with a 400ms debounce.
   - Zoom controls (60% to 150%) and responsive mobile/tablet tab switcher.

3. **Full CBSE & ICSE Header Support**:
   - School Name, Examination Title, Class, Subject, Duration, and Total Marks.
   - Instant marks sanity check (Target total marks vs sum of calculated marks from all sections).
   - Collapsible header card to save vertical workspace during question drafting.

4. **Section Management**:
   - Create, edit, reorder, and delete sections (Section A, B, C, D, etc.).
   - Configure marks per question and optional section instructions.
   - Automatic formula indicator (e.g. `1 × 17 = 17 Marks`).
   - Continuous global question numbering across sections.

5. **All Eight Question Types**:
   - **MCQ**: Question text and 4 choices (A, B, C, D).
   - **Sequence**: Question instruction, chronological sequence events (i, ii, iii, iv), and answer choices.
   - **Assertion–Reason**: Assertion (A), Reason (R), and 4 standard editable choices.
   - **Match**: Question text, Column A entries (1, 2, 3, 4), Column B entries (a, b, c, d), and choices.
   - **Short Answer**: Question text with marks.
   - **Long Answer**: Question text with marks.
   - **Passage-Based**: Reading passage paragraph, dynamic sub-questions with individual marks.
   - **Map-Based**: Map locating text and dynamic list of places.

6. **File Operations & PDF Generation**:
   - **Open / Import**: Import existing `.json` examination paper files with schema validation.
   - **Save / Export**: Export current paper as formatted `.json`.
   - **Load Sample**: One-click load of the Class VII Social Science sample paper.
   - **Download PDF**: High-fidelity print-ready PDF generated via WeasyPrint (`POST /generate`).
   - **Print Preview**: Direct browser print-to-PDF button using `@page A4` styling.

7. **Autosave & Client Fallback**:
   - Automatic draft saving via browser `localStorage`.
   - Session recovery on page reload.
   - Live status indicator (Saved, Autosaved, Unsaved changes).
   - Built-in client-side preview fallback if backend is offline.

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Virtual environment with dependencies installed:
  ```bash
  .\venv\Scripts\activate
  pip install fastapi uvicorn jinja2 weasyprint
  ```

### Running the Integrated Application

Run the launcher from the repository root:
```bash
python run.py
```
Or run directly with uvicorn:
```bash
uvicorn app.main:app --port 8000 --reload
```

Open your browser at:
```
http://127.0.0.1:8000
```
The web editor will load immediately and connect to the backend rendering engine.

---

## 📁 Repository Structure

```
QST_PAPER_ALIGNMENT_SOFTWARE/
├── run.py                       # Single-command launcher for backend & frontend
├── README.md                    # Project documentation
├── app/                         # FastAPI backend
│   ├── __init__.py
│   ├── main.py                  # API endpoints and static frontend mounting
│   └── render.py                # Jinja2 HTML rendering & WeasyPrint PDF pipeline
├── frontend/                    # Single-page web application
│   ├── index.html               # Main application HTML entry point
│   ├── css/                     # Vanilla CSS stylesheets & design tokens
│   │   ├── tokens.css           # Color palette, spacing, typography tokens
│   │   ├── main.css             # Layout, header, toolbar, responsive grid
│   │   ├── editor.css           # Header card, section tabs, question cards
│   │   ├── forms.css            # Form inputs, dynamic lists, buttons
│   │   ├── preview.css          # Sandboxed iframe wrapper, zoom controls
│   │   └── modal.css            # Dialogs, confirm modals, toast notifications
│   └── js/                      # Modular ES6 JavaScript
│       ├── app.js               # Application bootstrap and component mounting
│       ├── state.js             # Central reactive state store
│       ├── api.js               # Backend API client with auto-origin detection
│       ├── sampleData.js        # Class VII Social Science sample paper data
│       ├── validator.js         # Schema validation service
│       ├── clientRenderer.js    # Client-side fallback preview renderer
│       ├── components/          # UI components
│       │   ├── toolbar.js       # Top toolbar component
│       │   ├── headerForm.js    # Paper header details form
│       │   ├── sectionList.js   # Section tabs & question management
│       │   ├── questionForm.js  # Modal form for editing all 8 question types
│       │   ├── previewPane.js   # Live preview pane with iframe & debouncing
│       │   └── modal.js         # Accessible modal and toast notifications
│       └── utils/               # Helpers
│           ├── storage.js       # LocalStorage autosave service
│           └── fileIO.js        # JSON file import & export
├── static/                      # Print stylesheet for examination papers
│   └── paper.css                # A4 print and pagination styling
├── templates/                   # Jinja2 templates for paper rendering
│   ├── paper.html               # Base examination paper template
│   └── partials/                # Question type templates
│       ├── assertion_reason.html
│       ├── map.html
│       ├── match.html
│       ├── mcq.html
│       ├── passage.html
│       ├── sequence.html
│       ├── text.html
│       └── unknown.html
└── tests/                       # Test assets and test suites
    ├── sample_paper.json        # Reference CBSE sample examination paper
    └── test_app.py              # Automated integration tests
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the web frontend editor (`index.html`) |
| `GET` | `/health` | Health check (`{"status": "ok"}`) |
| `POST` | `/preview` | Accepts question paper JSON payload and returns rendered HTML |
| `POST` | `/generate` | Accepts question paper JSON payload and returns binary A4 PDF |
| `GET` | `/dev/sample` | Renders HTML for the built-in sample paper |
| `GET` | `/dev/sample.pdf` | Generates PDF for the built-in sample paper |

---

## 🧪 Running Tests

Run the integration test suite:
```bash
python -m unittest tests/test_app.py
```
