import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "vibestart.sqlite");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const rawHtmlDir = path.join(dataDir, "raw_html");

function clearRawHtmlFiles() {
  if (!fs.existsSync(rawHtmlDir)) {
    fs.mkdirSync(rawHtmlDir, { recursive: true });
    return;
  }
  for (const name of fs.readdirSync(rawHtmlDir)) {
    const fp = path.join(rawHtmlDir, name);
    try {
      fs.unlinkSync(fp);
    } catch {
      /* ignore */
    }
  }
}

/** Wipes app tables + cached HTML. Call when RESET_DB_ON_START is not 'false'. */
export function resetAllStoredData() {
  db.exec(`
    DELETE FROM analysis_snapshots;
    DELETE FROM competitors;
    DELETE FROM scraped_pages;
    DELETE FROM profiles;
  `);
  clearRawHtmlFiles();
}

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    startup_text TEXT,
    startup_url TEXT,
    combined_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scraped_pages (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    url TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT,
    excerpt TEXT,
    body_text TEXT,
    raw_source_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS competitors (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    url TEXT NOT NULL,
    label TEXT,
    summary TEXT,
    scraped_page_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
  );

  CREATE TABLE IF NOT EXISTS analysis_snapshots (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    analysis_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
  );
`);

// Default: clear SQLite + raw_html on every API process start (set RESET_DB_ON_START=false to keep data).
if (process.env.RESET_DB_ON_START !== "false") {
  resetAllStoredData();
  console.log(
    "[vibestart] RESET_DB_ON_START: cleared profiles, scrapes, snapshots, and raw_html (set RESET_DB_ON_START=false to persist)."
  );
}

export function getDb() {
  return db;
}
