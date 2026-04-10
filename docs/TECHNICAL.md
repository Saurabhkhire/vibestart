# VibeStart Technical Documentation

## 1. Architecture

- Frontend: React + Vite (`frontend/`)
- Backend: Express + SQLite + OpenAI (`backend/`)
- Scraper: axios + cheerio
- Reporting: PDFKit
- Creative image generation: DALL·E via OpenAI Images API

Request path:
`frontend -> frontend/src/api.js -> /api/* -> backend/src/routes.js + backend/src/creativeRoutes.js -> db/scraper/openai services`

## 2. Persistence Model

SQLite tables (created in `backend/src/db.js`):
- `profiles`
- `scraped_pages`
- `competitors`
- `analysis_snapshots`

Runtime artifacts:
- `backend/data/raw_html/*` (full scraped HTML)
- `backend/data/generated/*` (creative images)

By default, app data is reset on backend start unless `RESET_DB_ON_START=false`.

## 3. API Surface

### Profile & Competitors
- `POST /api/profile`
  - input: `startupText?`, `startupUrl?`, `profileId?`
  - behavior: upsert profile, optional scrape, build combined brief.
  - if URL scrape fails and only URL is provided, profile still saves with a warning summary.
- `POST /api/competitors`
- `GET /api/profile/:id`

### Intelligence
- `POST /api/analyze/:key`
  - keys: `comparison`, `vcs`, `roast`, `jobs`, `gaps`, `ideas`, `collaborations`, `extras`
  - snapshots persisted to `analysis_snapshots`.
- `POST /api/simulate/vc`

### Creative
- `POST /api/creative/ad`
- `POST /api/creative/story`

Creative context resolver (`loadCreativeContextForCreative`) accepts:
- `profileId?`
- `startupText?` (current section-1 text)
- `startupUrl?` (current section-1 URL)

Priority:
1) request overlay text/url,
2) saved profile row,
3) latest stored scrape text fallback.

### Export
- `POST /api/export/pdf`
- `GET /api/snapshots/:profileId`

## 4. Intelligence Scoping Rules

Competitor context is applied only to deep comparison:
- `comparison`: receives full competitor summaries.
- all other panels: competitor context is omitted (product/startup-only analysis).

Deep comparison schema includes:
- stage comparison,
- ahead/behind landscape,
- level-up and catch-up playbooks,
- recent activity/events section (inferred signals; verify externally).

## 5. Frontend Behavior Notes

- Section 1 holds startup text + URL.
- Creative Studio no longer asks for a separate URL.
- Creative requests include current section-1 values even before save.
- Export PDF can merge latest snapshots and current in-memory panel data.

## 6. Key Modules

Backend:
- `backend/src/index.js` (server bootstrap + middleware)
- `backend/src/routes.js` (profile/competitors/intelligence/pdf/snapshots)
- `backend/src/creativeRoutes.js` (ad + story routes)
- `backend/src/creativeService.js` (creative context + ad/story generation + images)
- `backend/src/openaiService.js` (intelligence prompts + JSON contracts)
- `backend/src/scraper.js` (web scraping + HTML persistence)
- `backend/src/pdfExport.js` (report assembly)

Frontend:
- `frontend/src/App.jsx`
- `frontend/src/components/AnalysisResult.jsx`
- `frontend/src/components/CreativeStudio.jsx`
- `frontend/src/api.js`

## 7. Regenerating Word Technical Document

The Word doc is generated from:
- `scripts/generate_word_doc.py`

Run:
```bash
python scripts/generate_word_doc.py
```

Output:
- `VibeStart_Technical_Documentation.docx`
