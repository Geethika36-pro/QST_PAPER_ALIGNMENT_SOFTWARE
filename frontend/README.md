# Question Paper Alignment Software — Frontend

A clean, modern, responsive educational examination paper alignment and formatting interface designed for school teachers (CBSE / ICSE formats).

---

## 🌟 Key Features

1. **Two-Pane Workspace**:
   - **Left Pane**: Dynamic interactive examination paper editor.
   - **Right Pane**: Live A4 formatted paper preview (sandboxed iframe), reflecting changes with a 400ms debounce.

2. **Full CBSE/ICSE Header Support**:
   - School Name, Examination Title, Class, Subject, Duration, and Total Marks.
   - Instant marks sanity check (Target total marks vs sum of calculated marks from all sections).
   - Collapsible header card to save vertical workspace during question drafting.

3. **Section Management**:
   - Create, edit, reorder, and delete sections (Section A, B, C, D, etc.).
   - Configure marks per question and optional section instructions.
   - Formula indicator: e.g. `1 × 17 = 17 Marks`.
   - Global question numbering across sections.

4. **All Eight Question Types**:
   - **MCQ**: Question text and 4 choices (A, B, C, D).
   - **Sequence**: Question instruction, 4 chronological sequence events (i, ii, iii, iv), and 4 answer choices.
   - **Assertion–Reason**: Assertion (A), Reason (R), and 4 standard editable choices.
   - **Match**: Question text, Column A entries (1, 2, 3, 4), Column B entries (a, b, c, d), and 4 choices.
   - **Short Answer**: Question text.
   - **Long Answer**: Question text.
   - **Passage-Based**: Reading passage paragraph, dynamic sub-questions with marks, add/delete sub-questions.
   - **Map-Based**: Map locating text, dynamic list of places, add/delete places.

5. **Top Toolbar Actions**:
   - **Open**: Import existing `.json` examination paper files with schema validation.
   - **Save**: Export current examination paper as formatted `.json`.
   - **Load Sample**: One-click load of the Class VII Social Science sample paper.
   - **Download PDF**: Requests binary PDF from backend `POST /generate` as `exam_paper.pdf`.
   - **Print Preview**: Direct browser print-to-PDF button using `@page A4` styling.

6. **Autosave & Persistence**:
   - Browser-based automatic draft saving via `localStorage`.
   - Session recovery on page reload.
   - Live status indicator (Saved, Autosaved, Unsaved changes).

7. **Backend Integration & Graceful Demo Mode**:
   - Seamlessly talks to FastAPI backend (`/preview`, `/generate`, `/health`).
   - If backend is offline, activates **Demo Mode** with an exact client-side replica of the Jinja2 rendering pipeline so teachers can continue working without interruption.
   - Handles HTTP 422 with a structured validation error banner.
   - Disregards stale in-flight preview requests using `AbortController`.

8. **Fully Responsive**:
   - Desktop & Laptop: Side-by-side two panes.
   - Tablet & Mobile: Segmented tabs toggle between Editor and Preview.

---

## 🚀 How to Run the Frontend

### Option 1: Serve locally using Python (Zero dependencies)
Run the following in the repository root:
```bash
python -m http.server 3000 --directory frontend
```
Then open your browser at:
```
http://localhost:3000
```

### Option 2: Run with Backend simultaneously
1. Start the FastAPI backend:
   ```bash
   python -m uvicorn app.main:app --port 8000
   ```
2. In another terminal, start the frontend dev server:
   ```bash
   python -m http.server 3000 --directory frontend
   ```
3. Open `http://localhost:3000`. The toolbar status indicator will automatically show `Backend: Online` (connected to `http://127.0.0.1:8000`).

---

## 📁 Architecture & File Structure

```
frontend/
├── index.html                   # Single-page application entry point
├── package.json                 # Project scripts and configuration
├── README.md                    # Documentation
├── css/
│   ├── tokens.css               # Design tokens (colors, typography, shadows, spacing)
│   ├── main.css                 # Layout, header, toolbar, responsive grid
│   ├── editor.css               # Header card, section tabs, question cards
│   ├── forms.css                # Form inputs, dynamic lists, buttons
│   ├── preview.css              # Sandboxed iframe wrapper, zoom, loading state
│   └── modal.css                # Dialogs, confirm modals, toast notifications
└── js/
    ├── app.js                   # Application bootstrap and component mounting
    ├── state.js                 # Central reactive state store
    ├── api.js                   # Backend API adapter (FastAPI /preview and /generate)
    ├── sampleData.js            # Class VII Social Science sample paper data
    ├── validator.js             # Question paper & question schema validation
    ├── clientRenderer.js        # Faithful client-side fallback preview renderer
    ├── components/
    │   ├── toolbar.js           # Top toolbar component
    │   ├── headerForm.js        # Paper header details form
    │   ├── sectionList.js       # Section tabs & question management
    │   ├── questionForm.js      # Modal form for editing all 8 question types
    │   ├── previewPane.js       # Live preview pane with iframe & debouncing
    │   └── modal.js             # Accessible modal and toast notifications
    └── utils/
        ├── storage.js           # LocalStorage autosave service
        └── fileIO.js            # JSON file import & export
```
