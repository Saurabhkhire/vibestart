import { Router } from "express";
import { randomUUID } from "crypto";
import { getDb } from "./db.js";
import { scrapeUrl, scrapeMany } from "./scraper.js";
import * as ai from "./openaiService.js";
import { asyncRoute } from "./asyncRoute.js";
import { buildReportPdf, getLatestSnapshotMap } from "./pdfExport.js";
import { creativeRouter } from "./creativeRoutes.js";
import {
  computeIntelligenceResult,
  runAllIntelligenceAnalyses,
} from "./intelligenceRunner.js";

export const api = Router();

api.use("/creative", creativeRouter);

function rowProfile(id) {
  const db = getDb();
  return db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
}

function competitorRows(profileId) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM competitors WHERE profile_id = ? ORDER BY created_at")
    .all(profileId);
}

function saveSnapshot(profileId, key, payload) {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO analysis_snapshots (id, profile_id, analysis_key, payload_json) VALUES (?, ?, ?, ?)`
  ).run(id, profileId, key, JSON.stringify(payload));
  return id;
}

async function loadContextBundle(profileId) {
  const p = rowProfile(profileId);
  if (!p) return null;
  const comps = competitorRows(profileId);
  const competitorSummaries = comps.map((c) => ({
    url: c.url,
    label: c.label,
    summary: c.summary,
  }));
  return {
    profile: p,
    competitorSummaries,
    combinedSummary: p.combined_summary || p.startup_text || "",
  };
}

/** Create or update startup profile: optional text + optional URL (scrape stored locally). */
api.post("/profile", asyncRoute(async (req, res) => {
  try {
    const { startupText, startupUrl, profileId: existingId } = req.body || {};
    const text = (startupText || "").trim();
    const url = (startupUrl || "").trim();
    if (!text && !url) {
      return res
        .status(400)
        .json({ error: "Provide startupText and/or startupUrl." });
    }

    const db = getDb();
    const id = existingId || randomUUID();
    const prev = db.prepare("SELECT id FROM profiles WHERE id = ?").get(id);
    if (!prev) {
      db.prepare(
        `INSERT INTO profiles (id, startup_text, startup_url, combined_summary) VALUES (?, ?, ?, ?)`
      ).run(id, text || null, url || null, "");
    }

    let startupScrape = null;
    let scrapeError = null;
    if (url) {
      try {
        startupScrape = await scrapeUrl(url, {
          profileId: id,
          kind: "startup_site",
        });
      } catch (e) {
        scrapeError = e.message || String(e);
      }
    }

    let combined = { combined_summary: text || "", assumptions: [], tags: [] };
    if (text || startupScrape) {
      combined = await ai.buildCombinedContext({
        startupText: text,
        startupScrape,
      });
    } else if (url && scrapeError) {
      combined = {
        combined_summary: `We could not fetch ${url}. Add a short pitch in the text area above and save again. (${scrapeError})`,
        assumptions: [`Startup URL fetch failed: ${scrapeError}`],
        tags: [],
      };
    }

    const summary = combined.combined_summary || text || "";

    db.prepare(
      `UPDATE profiles SET startup_text = ?, startup_url = ?, combined_summary = ? WHERE id = ?`
    ).run(text || null, url || null, summary, id);

    return res.json({
      profileId: id,
      combinedSummary: summary,
      assumptions: combined.assumptions,
      tags: combined.tags,
      startupScrape,
      scrapeWarning: scrapeError || undefined,
    });
  } catch (e) {
    console.error(e);
    const status = e.status || e.statusCode || 500;
    const body = { error: e.message || String(e) };
    if (e.detail) body.detail = e.detail;
    return res.status(status).json(body);
  }
}));

/** Add competitor URLs; scrape each, store locally + DB. */
api.post("/competitors", asyncRoute(async (req, res) => {
  try {
    const { profileId, urls, labels } = req.body || {};
    if (!profileId || !Array.isArray(urls) || urls.length === 0) {
      return res
        .status(400)
        .json({ error: "profileId and urls[] required." });
    }

    const p = rowProfile(profileId);
    if (!p) return res.status(404).json({ error: "Profile not found." });

    const results = await scrapeMany(urls, {
      profileId,
      kind: "competitor_site",
    });

    const db = getDb();
    const inserted = [];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r.ok) {
        inserted.push({ url: r.url, ok: false, error: r.error });
        continue;
      }
      const scrap = r.data;
      const label = Array.isArray(labels) ? labels[i] : null;
      const summary =
        scrap.title && scrap.excerpt
          ? `${scrap.title}\n\n${scrap.excerpt}`
          : scrap.excerpt || scrap.bodyPreview?.slice(0, 800) || "";

      const cid = randomUUID();
      db.prepare(
        `INSERT INTO competitors (id, profile_id, url, label, summary, scraped_page_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        cid,
        profileId,
        scrap.url,
        label || null,
        summary,
        scrap.scrapedPageId
      );

      inserted.push({
        ok: true,
        competitorId: cid,
        url: scrap.url,
        title: scrap.title,
      });
    }

    return res.json({ profileId, competitors: inserted });
  } catch (e) {
    console.error(e);
    const status = e.status || e.statusCode || 500;
    const body = { error: e.message || String(e) };
    if (e.detail) body.detail = e.detail;
    return res.status(status).json(body);
  }
}));

api.get("/profile/:id", (req, res) => {
  const p = rowProfile(req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  const comps = competitorRows(req.params.id);
  res.json({ profile: p, competitors: comps });
});

api.post("/analyze/:key", asyncRoute(async (req, res) => {
  const key = req.params.key;
  const allowed = new Set([
    "comparison",
    "roast",
    "jobs",
    "collaborations",
    "extras",
    "uniqueness",
    "vcs",
    "gaps",
    "ideas",
  ]);
  if (!allowed.has(key)) {
    return res.status(400).json({ error: "Unknown analysis key." });
  }

  try {
    const { profileId, founderPreferences } = req.body || {};
    if (!profileId) return res.status(400).json({ error: "profileId required." });

    const bundle = await loadContextBundle(profileId);
    if (!bundle) return res.status(404).json({ error: "Profile not found." });

    const { combinedSummary, competitorSummaries } = bundle;
    if (!combinedSummary.trim()) {
      return res.status(400).json({ error: "Profile has no combined summary." });
    }

    const result = await computeIntelligenceResult(
      key,
      { combinedSummary, competitorSummaries },
      founderPreferences
    );

    const snapshotId = saveSnapshot(profileId, key, result);
    return res.json({ profileId, analysis: key, snapshotId, result });
  } catch (e) {
    console.error(e);
    const status = e.status || e.statusCode || 500;
    const body = { error: e.message || String(e) };
    if (e.detail) body.detail = e.detail;
    return res.status(status).json(body);
  }
}));

api.post("/simulate/vc", asyncRoute(async (req, res) => {
  try {
    const { profileId, vcPersona, pitchNotes } = req.body || {};
    if (!profileId) return res.status(400).json({ error: "profileId required." });

    const bundle = await loadContextBundle(profileId);
    if (!bundle) return res.status(404).json({ error: "Profile not found." });
    const { combinedSummary, competitorSummaries } = bundle;
    if (!combinedSummary.trim()) {
      return res.status(400).json({ error: "Profile has no combined summary." });
    }

    const result = await ai.simulateVcPitch({
      combinedSummary,
      vcPersona,
      pitchNotes,
    });
    return res.json({ profileId, result });
  } catch (e) {
    console.error(e);
    const status = e.status || e.statusCode || 500;
    const body = { error: e.message || String(e) };
    if (e.detail) body.detail = e.detail;
    return res.status(status).json(body);
  }
}));

api.post("/export/pdf", asyncRoute(async (req, res) => {
  try {
    const b = req.body || {};
    let mergedPanels = { ...(b.panels || {}) };

    if (b.runAllAnalyses !== false && b.profileId) {
      const bundle = await loadContextBundle(b.profileId);
      if (!bundle) {
        return res.status(404).json({ error: "Profile not found." });
      }
      if (!bundle.combinedSummary.trim()) {
        return res
          .status(400)
          .json({ error: "Profile has no combined summary." });
      }
      await runAllIntelligenceAnalyses(
        b.profileId,
        bundle,
        b.founderPreferences,
        saveSnapshot
      );
      const snaps = getLatestSnapshotMap(b.profileId);
      mergedPanels = { ...mergedPanels, ...snaps };
    }

    const buf = await buildReportPdf({
      profileId: b.profileId,
      combinedSummary: b.combinedSummary,
      assumptions: b.assumptions,
      tags: b.tags,
      startupUrl: b.startupUrl,
      competitors: b.competitors,
      panels: mergedPanels,
      vcSimulator: b.vcSimulator,
      mergeSnapshots:
        b.runAllAnalyses !== false && b.profileId ? false : b.mergeSnapshots !== false,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="vibestart-intelligence-report.pdf"'
    );
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "PDF generation failed" });
  }
}));

api.get("/snapshots/:profileId", (req, res, next) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, analysis_key, payload_json, created_at FROM analysis_snapshots
         WHERE profile_id = ? ORDER BY created_at DESC LIMIT 50`
      )
      .all(req.params.profileId);
    const snapshots = rows.map((r) => {
      let payload = null;
      try {
        payload = JSON.parse(r.payload_json);
      } catch {
        payload = { _parse_error: true, raw: r.payload_json };
      }
      return {
        id: r.id,
        analysis_key: r.analysis_key,
        created_at: r.created_at,
        payload,
      };
    });
    res.json({ snapshots });
  } catch (e) {
    next(e);
  }
});
