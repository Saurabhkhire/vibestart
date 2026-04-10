# VibeStart

VibeStart is a local-first startup intelligence workspace.

It helps founders:
- capture startup context from text and/or a public URL,
- scrape competitor websites,
- run structured intelligence analyses,
- generate creative ads and stories,
- simulate VC reactions,
- export a combined PDF report.

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- OpenAI API key
- (Optional, for Word doc generation) Python 3 + `python-docx`

### Install
```bash
npm run install:all
```

### Configure backend
Create `backend/.env` from `backend/.env.example` and set:
- `OPENAI_API_KEY`
- optional `OPENAI_MODEL`
- optional `OPENAI_IMAGE_MODEL`
- optional `RESET_DB_ON_START=false` to persist DB between restarts

### Run
```bash
npm run dev
```
- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:3001/api/health`

## Core Product Flow

1. Save startup profile via section 1 (`startupText` and/or `startupUrl`).
2. Add competitors (optional, for deep comparison).
3. Run intelligence panels.
4. Use Creative Studio for ads/story from section-1 context.
5. Export a PDF report.

## Intelligence Panels

Supported analysis keys:
- `comparison` (deep competitor comparison)
- `vcs`
- `roast`
- `jobs`
- `gaps`
- `ideas`
- `collaborations`
- `extras`

### Important behavior
- Competitor data is used only for `comparison`.
- All other analyses are product/startup-focused from your profile brief.
- Deep comparison includes:
  - where they are ahead / where you are ahead,
  - inferred stage comparison,
  - leveling/catch-up playbooks,
  - recent activity & events signals (inferred, verify externally).

## Creative Studio Behavior

Creative endpoints (`/api/creative/ad`, `/api/creative/story`) do not have a separate URL field in the UI.
They use section-1 context:
- current unsaved `startupText` / `startupUrl` (overlays),
- saved profile context when `profileId` exists,
- fallback to latest stored scrape text when available.

This means creative generation works with:
- description only,
- URL only (if scrape succeeds),
- or both.

## API Summary

Main backend routes:
- `POST /api/profile`
- `POST /api/competitors`
- `GET /api/profile/:id`
- `POST /api/analyze/:key`
- `POST /api/simulate/vc`
- `POST /api/creative/ad`
- `POST /api/creative/story`
- `POST /api/export/pdf` (by default runs **all** intelligence analyses for the profile, then embeds every panel in the PDF)
- `GET /api/snapshots/:profileId`

## Data & Storage

- SQLite: `backend/data/vibestart.sqlite`
- Raw scraped HTML: `backend/data/raw_html/`
- Generated creative images: `backend/data/generated/`

## Documentation

- Technical reference (Markdown): `docs/TECHNICAL.md`
- Technical reference (Word): `VibeStart_Technical_Documentation.docx`
- Word source generator: `scripts/generate_word_doc.py`
