# Erazum Bilet — AI-friendly Project Overview

This document explains the entire application located in this workspace so another AI (or human) can understand it, provide feedback, and offer improvements. It consolidates the project's architecture, file-by-file responsibilities, data flows, run instructions, testing suggestions, edge cases, security considerations, and example prompts an AI reviewer can use.

---

## Quick summary / intent

Erazum Bilet is a lightweight, static-first web application for learning words. It provides a dictionary, flashcards, quizzes, and local file import. It includes client-side logic (HTML/JS/CSS) and a small Python backend (FastAPI / uvicorn is present in the repo) used by the frontend during development. Authentication uses Google OAuth (GSI) and JWT decoding utilities.

The app emphasizes offline/local storage (LocalStorage/SessionStorage) and a simple, modular frontend. The server (if used) appears to be optional for local development/testing endpoints.

---

## Contract (short)

- Inputs: user interactions in the browser, optionally Google Sign-In tokens, local file imports (word lists), and API calls to local backend endpoints.
- Outputs: updated browser UI, data persisted to LocalStorage/SessionStorage, quiz/flashcard sessions, optional server responses for auth or data sync.
- Error modes: missing words, malformed imports, network/auth failures, insufficient words for quizzes.
- Success criteria: user can add/edit/delete words, study via flashcards, take quizzes, and import words from files.

---

## Project file map (high-level)

Files in the workspace (only relevant ones listed):

- `index.html` — likely the main entry/landing page for the app.
- `app.html` / `app.html.new` — core UI pages. `app.html` probably contains the main interface (dictionary, flashcards, quizzes, import UI).
- `script.js` — main client-side JavaScript. Handles authentication, UI updates, data persistence, quiz logic, flashcards, and imports. (Note: earlier terminal logs show lines replaced changing `localhost:8000` to `localhost:8001`.)
- `style.css` — active stylesheet for the app.
- `style-backup.css` — previous stylesheet kept as backup.
- `main.py` — Python backend application (likely FastAPI) used with `uvicorn` (terminals show `uvicorn main:app --host 127.0.0.1 --port 8001`).
- `package.json` and `npm/` — JS dependency info (if any client tooling is used).
- `credentials.json` and `config.js` — configuration and credentials related to Google OAuth and possibly API settings.
- `fsfsfs.txt` and other docs — project-specific notes (the repository includes `c:\...\.github\copilot-instructions.md` with developer guidance).
- `presentation.md`, `project_presentation.md` — documentation or presentation materials.
- `__pycache__/` — Python bytecode cache (not relevant for explanation).

Note: the file `c:\Users\pc\Desktop\erazum bilet\.github\copilot-instructions.md` (attached) contains a concise project overview that confirms the architecture, tech choices, and feature list.

---

## Architecture overview

- Frontend: static HTML + CSS + vanilla JavaScript (ES6+). The client manages most features locally and uses LocalStorage/SessionStorage for persistence. Dynamic views are toggled via JS.

- Authentication: Google OAuth 2.0 via Google Sign-In (GSI). The client expects a Google credential and uses JWT decoding (third-party `jwt-decode` or similar) to manage user session information.

- Storage: LocalStorage for persistent dictionary data and session-specific data in SessionStorage.

- Backend (optional): A small Python web app (`main.py`) designed to run with `uvicorn` (FastAPI likely). The backend may be used for development endpoints, auth verification, or future cloud sync.

- Dependencies: Minimal JS libs (JWT decode, Google GSI client) and Python runtime/venv for the backend.

---

## Frontend details (behavioral breakdown)

The frontend is responsible for:

1. Authentication flow
   - Uses Google Sign-In (GSI). The client collects the ID token from Google.
   - A JWT decode utility is used to extract user claims.
   - The app stores login state (likely in SessionStorage) and toggles UI views accordingly.

2. Dictionary management
   - Add words (term + translation + optional metadata).
   - Edit and delete entries.
   - Persist dictionary to LocalStorage.
   - Provide a listing UI and search/filter.

3. Flashcards
   - Presents word pairs as flashcards.
   - Flip animation using `.flipped` class and modal markup `.flashcard-modal`.
   - Tracks progress per session; may write session stats back to LocalStorage.

4. Quizzes
   - Generates quizzes from the dictionary; randomizes answers.
   - Tracks score/progress, enforces minimum number of words (>= 4 per docs).

5. Local file import
   - Allows bulk import of words from a local file.
   - Parsing and validation of file content to dictionary entries.

6. UI/UX
   - Theme, animations, and responsive layout handled by `style.css` and `theme.css`.
   - Dynamic view toggles via `script.js`.

Notes: The exact function names and code structures are in `script.js` — an AI reviewer should analyze that file for event handlers, data models, and exact LocalStorage keys.

---

## Backend (main.py) — inferred behavior

- The presence of `main.py` and terminal logs referencing `uvicorn main:app` indicate a Python ASGI application that likely exposes small endpoints used by the frontend during development.
- Typical responsibilities for such a backend in this project would be:
  - Serve static files (if not using direct file system/browser open).
  - Provide endpoints for token verification or auditing (e.g., verifying Google tokens with Google servers).
  - Provide optional sync endpoints for persistence beyond LocalStorage.

If the backend exists to only support local dev, the app still works primarily as a static webapp when `index.html` / `app.html` are opened directly.

---

## How to run (developer / tester)

Assumptions: you're on Windows (PowerShell), and a Python venv exists in `venv/` (terminals show `venv\Scripts\Activate.ps1`). The frontend can be opened directly in a browser or served from a local server; the backend can be started with uvicorn.

PowerShell steps (recommended) — activate venv then run uvicorn:

```powershell
# from project root (c:\Users\pc\Desktop\erazum bilet)
& "./venv/Scripts/Activate.ps1";
python -m pip install -r requirements.txt  # only if requirements.txt exists and dependencies are missing
uvicorn main:app --host 127.0.0.1 --port 8001
```

Alternative (frontend-only quick test):
- Open `index.html` in a modern browser (Chrome, Edge, Firefox). If the app expects a backend, update `script.js` base URL as necessary (terminals show a replacement to `localhost:8001`).

Notes:
- The terminals show `script.js` was updated to use `localhost:8001` instead of `8000` — ensure `main.py`/uvicorn runs on the same port.
- If Google OAuth is used, ensure `credentials.json` and Google client configuration (`config.js`) contain the correct client ID and allowed origins (or use the hosted `https://developers.google.com` test flow).

---

## Testing suggestions (minimal, pragmatic)

Create short tests that exercise the core client flows. Because the app is static-first, many tests will be UI/integration style.

Unit/Integration ideas:

- JS unit tests for parser functions used by file import (happy path + malformed file). Use a small test runner (Jest or simple Node-based assertions) if you want automation.
- End-to-end (playwright or puppeteer) to validate:
  - Add word -> persists to LocalStorage -> reload -> still present.
  - Start quiz with <4 words -> show validation error.
  - Import words file -> new words added and deduplicated.
- Backend checks:
  - Start `uvicorn main:app` and `GET /` or health endpoint if present.
  - If endpoints accept tokens, test the token verification flow with a sample token.

Suggested quick manual tests:
- Add 4+ words and start a quiz to confirm UI logic and scoring works.
- Sign in with Google in an incognito window to validate auth flow (requires valid client config).

---

## Edge cases & likely bugs

1. Empty dictionary / insufficient words for quiz (already noted; enforce friendly UX messaging).
2. File import malformed lines or duplicates — parser should validate and report line numbers.
3. LocalStorage size limits (rare for word lists but possible on extremely large imports).
4. Offline vs online auth — Google Sign-In requires network; app should degrade gracefully (local usage allowed without sign-in).
5. Cross-origin / incorrect OAuth client configuration (causes sign-in failures).
6. Concurrent edits from multiple tabs — no locking; last write wins.
7. Missing `credentials.json` or misconfigured client IDs — handle gracefully with clear error messages.

---

## Security considerations

- Do not store Google ID tokens in LocalStorage long-term; prefer SessionStorage for auth tokens or better: only store minimal user profile info.
- Sanitize any imported text (escape HTML) before injecting it into the DOM to avoid XSS from imported files.
- If the backend verifies tokens, validate tokens server-side with Google's tokeninfo endpoint or Google-auth libraries.
- Avoid exposing client secrets in repository. `credentials.json` should not contain any secret that must remain private.

---

## Suggested improvements / next steps

1. Add explicit unit tests for parser logic and quiz generation.
2. Add e2e tests (Playwright) for the main user journeys.
3. Add schema versioning to LocalStorage data (allow migrations when shape changes).
4. Improve import feedback: show line numbers and validation errors during import.
5. Add optional server-side persistence with user accounts (e.g., a small FastAPI + SQLite sync) if multi-device sync is desired.
6. Add feature flags and a simple logging/telemetry layer for error reporting.
7. Add types (TypeScript or JSDoc) to `script.js` to make intent clearer and enable static checks.

---

## How another AI should review this repo (recommended checklist & prompts)

Checklist for the AI reviewer:
- Read `script.js` and extract the main functions and the LocalStorage keys used.
- Verify the Google Sign-In flow and ensure token handling is secure.
- Identify code paths that mutate LocalStorage and list potential race conditions.
- Search for DOM insertion points that use imported strings and flag missing sanitization.
- Suggest testable invariants (e.g., quiz requires >=4 words; import returns parsed_count and error_count).
- Find TODO comments and list the top 5 actionable items sorted by risk/impact.

Example prompts for an AI reviewer:
- "Summarize the data model stored in LocalStorage: list keys, their types, and sample values." 
- "List security issues in `script.js` and `main.py` and propose fixes." 
- "Write 3 unit tests in Jest that validate the import parser and one that validates quiz generation." 
- "Produce an end-to-end Playwright test that signs in (if possible), adds 5 words, and runs a quiz to completion." 
- "Create a migration plan to move LocalStorage dictionary entries to a server-backed SQLite DB with minimal user friction." 

---

## Files to inspect first (priority)

1. `script.js` — primary behavior; parse data model & public functions.
2. `app.html` / `index.html` — layout and element IDs/classes used by JS.
3. `main.py` — backend endpoints & their JSON contracts.
4. `config.js` / `credentials.json` — Google client configuration and environment settings.
5. `style.css` / `theme.css` — UI conventions referenced by JS (modal classes, flip animations).

---

## Minimal debugging steps when something is broken

1. Open browser devtools Console to view JS errors. Inspect LocalStorage for keys and contents.
2. If backend endpoints fail, start `uvicorn main:app` and curl the endpoint or view uvicorn logs.
3. For auth issues, check the network tab for Google GSI requests and ensure allowed origins in Google Console.

---

## Quick summary for a reviewer

This is a small but complete static-first vocabulary learning webapp with Google Sign-In. The main value is offline usability and local persistence. The first review steps are to read `script.js` and verify storage keys, check import parsing, and validate any DOM insertions for XSS. Add tests for parser and quiz generation, and consider optional server-side persistence for syncing.

---

## Contact points in repo (where to change behavior)

- UI text / behavior: `app.html`, `index.html` (change labels or HTML structure)
- Logic: `script.js` (all business logic)
- Styling: `style.css`, `theme.css`
- Auth/config: `config.js`, `credentials.json`
- Backend: `main.py` (server behavior)

---

If you want, I can now:
- Run a static analysis of `script.js` to extract LocalStorage keys and function list.
- Generate Jest tests for the import parser.
- Produce Playwright e2e test skeleton.

Tell me which of those to do next and I will add it to the plan and implement it.
