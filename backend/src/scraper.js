import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { getDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, "..", "data", "raw_html");

const UA =
  "Mozilla/5.0 (compatible; VibeStartBot/1.0; +https://localhost; research-only)";

function ensureRawDir() {
  if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });
}

function normalizeUrl(input) {
  let u = (input || "").trim();
  if (!u) throw new Error("Empty URL");
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

/**
 * Fetches public HTML, extracts readable text, stores raw HTML locally.
 * @param {string} url
 * @param {{ profileId?: string, kind: string }} opts
 */
export async function scrapeUrl(url, opts) {
  const normalized = normalizeUrl(url);
  const res = await axios.get(normalized, {
    timeout: 25000,
    maxRedirects: 5,
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const html = String(res.data || "");
  ensureRawDir();
  const rawId = randomUUID();
  const rawPath = path.join(RAW_DIR, `${rawId}.html`);
  fs.writeFileSync(rawPath, html, "utf8");

  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  const title = $("title").first().text().trim() || null;
  const metaDesc =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null;

  const textBits = [];
  $("h1, h2, h3, p, li").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 2) textBits.push(t);
  });
  let bodyText = textBits.join("\n").slice(0, 120_000);
  if (!bodyText.trim()) {
    bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 120_000);
  }

  const excerpt = (metaDesc || bodyText.slice(0, 500)).slice(0, 600);
  const db = getDb();
  const id = randomUUID();
  const profileId = opts.profileId || null;

  db.prepare(
    `INSERT INTO scraped_pages (id, profile_id, url, kind, title, excerpt, body_text, raw_source_path)
     VALUES (@id, @profile_id, @url, @kind, @title, @excerpt, @body_text, @raw_source_path)`
  ).run({
    id,
    profile_id: profileId,
    url: normalized,
    kind: opts.kind,
    title,
    excerpt,
    body_text: bodyText,
    raw_source_path: path.relative(path.join(__dirname, ".."), rawPath),
  });

  return {
    scrapedPageId: id,
    url: normalized,
    title,
    excerpt,
    bodyPreview: bodyText.slice(0, 4000),
    rawSourcePath: rawPath,
  };
}

export async function scrapeMany(urls, opts) {
  const results = [];
  for (const u of urls) {
    try {
      results.push({ url: u, ok: true, data: await scrapeUrl(u, opts) });
    } catch (e) {
      results.push({
        url: u,
        ok: false,
        error: e.message || String(e),
      });
    }
  }
  return results;
}
