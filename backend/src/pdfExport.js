import PDFDocument from "pdfkit";
import { getDb } from "./db.js";

const PANEL_ORDER = [
  ["comparison", "Deep competitor comparison"],
  ["vcs", "VCs you may have missed"],
  ["roast", "Roast"],
  ["jobs", "Hiring & job opportunities"],
  ["gaps", "Strategic gaps"],
  ["ideas", "Startup ideas for you"],
  ["collaborations", "Collaborations"],
  ["extras", "Moats, pivots & extras"],
];

export function getLatestSnapshotMap(profileId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT analysis_key, payload_json FROM analysis_snapshots
       WHERE profile_id = ? ORDER BY created_at DESC`
    )
    .all(profileId);
  const out = {};
  for (const r of rows) {
    if (Object.prototype.hasOwnProperty.call(out, r.analysis_key)) continue;
    try {
      out[r.analysis_key] = JSON.parse(r.payload_json);
    } catch {
      out[r.analysis_key] = { _parse_error: true };
    }
  }
  return out;
}

function mergePanels(clientPanels, snapshotPanels) {
  const merged = { ...(snapshotPanels || {}) };
  for (const [k, v] of Object.entries(clientPanels || {})) {
    if (v != null) merged[k] = v;
  }
  return merged;
}

function section(doc, title) {
  doc.addPage();
  doc.fontSize(14).fillColor("#111").text(title, { underline: true });
  doc.moveDown(0.6);
  doc.fillColor("#000");
}

function jsonBlock(doc, data) {
  const s = JSON.stringify(data, null, 2);
  doc.font("Courier").fontSize(7.5).text(s, { width: 500, align: "left" });
  doc.font("Helvetica");
}

/**
 * @param {{
 *   profileId?: string,
 *   combinedSummary?: string,
 *   assumptions?: string[],
 *   tags?: string[],
 *   startupUrl?: string | null,
 *   competitors?: { url?: string; summary?: string }[],
 *   panels?: Record<string, unknown>,
 *   vcSimulator?: unknown,
 *   mergeSnapshots?: boolean,
 * }} input
 */
export async function buildReportPdf(input) {
  let panels = { ...(input.panels || {}) };
  if (input.mergeSnapshots !== false && input.profileId) {
    const snaps = getLatestSnapshotMap(input.profileId);
    panels = mergePanels(panels, snaps);
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "LETTER" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("VibeStart — Intelligence report", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor("#444").text(`Generated: ${new Date().toISOString()}`);
    if (input.profileId) {
      doc.text(`Profile ID: ${input.profileId}`);
    }
    doc.fillColor("#000").moveDown();

    doc.fontSize(11).text("Combined brief (markdown / text)", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(9).text(String(input.combinedSummary || "(none)"), { width: 500 });
    doc.moveDown();

    if (input.assumptions?.length) {
      doc.fontSize(10).text("Assumptions", { underline: true });
      doc.moveDown(0.3);
      input.assumptions.forEach((a) => {
        doc.fontSize(9).text(`• ${a}`, { width: 500 });
      });
      doc.moveDown();
    }
    if (input.tags?.length) {
      doc.fontSize(10).text("Tags", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(9).text(input.tags.join(", "));
      doc.moveDown();
    }
    if (input.startupUrl) {
      doc.fontSize(9).text(`Startup URL: ${input.startupUrl}`);
      doc.moveDown();
    }

    if (input.competitors?.length) {
      doc.fontSize(11).text("Competitors (scraped summaries)", { underline: true });
      doc.moveDown(0.4);
      input.competitors.forEach((c, i) => {
        doc.fontSize(9).text(`${i + 1}. ${c.url || "—"}`, { width: 500 });
        if (c.summary) doc.fontSize(8).fillColor("#333").text(c.summary.slice(0, 1500), { width: 500 });
        doc.fillColor("#000").moveDown(0.4);
      });
    }

    for (const [key, label] of PANEL_ORDER) {
      const data = panels[key];
      if (data == null) continue;
      section(doc, label);
      jsonBlock(doc, data);
    }

    if (input.vcSimulator != null) {
      section(doc, "VC pitch simulator (role-play response)");
      jsonBlock(doc, input.vcSimulator);
    }

    doc.end();
  });
}
