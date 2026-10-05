# Folio — instructions for Claude

Folio is a desktop PDF reader and editor (Electron, Windows first, Mac later).

Read before working:
- `PLAN.md`: phases, current status, what's next
- `ARCHITECTURE.md`: rules every change must follow

## How the user works
- **Questions first.** When the user says they have questions, answer them without doing any work. Once everything is resolved, explain the plan and wait for a clear "go" before acting.
- **Be concise.** The user watches token usage. Keep replies short, read only the file ranges you need, and prefer targeted edits over rewrites.
- **One phase (sub-phase) per session.** At the start of a session, confirm which phase is being worked on. When that phase is done, update its status in `PLAN.md`, commit, and **remind the user to start a new session for the next phase**.
- **Model per task.** At the start of each phase, **remind the user which model `PLAN.md` recommends** (Sonnet or Opus) and to switch it in the app's model picker if needed.

## Project facts
- Location: `C:\Users\Codex\Documents\Folio`
- Name: Folio (keep it)
- License: AGPL-3.0, required by MuPDF.js. Selling later means keeping the source public or buying a commercial MuPDF license from Artifex.
- `prototype/folio.html` is the original single-file web reader (PDF.js). It's a UI reference only; the app uses MuPDF.js.
