import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import PDFDocument from "pdfkit";
import { HttpError } from "./httpError.js";
import { getDb } from "./db.js";
import { scrapeUrl } from "./scraper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEN_DIR = path.join(__dirname, "..", "data", "generated");

let client;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(
      503,
      "OPENAI_API_KEY is not set. Add it to backend/.env and restart the server."
    );
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";

function ensureGenDir() {
  if (!fs.existsSync(GEN_DIR)) fs.mkdirSync(GEN_DIR, { recursive: true });
}

function publicImageUrl(fileName) {
  return `/api/creative/static/${fileName}`;
}

function inferBrandName(ctx) {
  const t = String(ctx?.pageTitle || "").trim();
  if (t) return t.split("|")[0].split("-")[0].trim().slice(0, 60);
  const u = String(ctx?.productUrl || "").trim();
  if (!u) return "Your Company";
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/[-_]/g, " ").slice(0, 60);
  } catch {
    return "Your Company";
  }
}

async function chatJson(system, user, schemaHint, maxTokens = 3500) {
  const c = getClient();
  const content = `${user}\n\nRespond with valid JSON only. ${schemaHint || ""}`;
  const res = await c.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.55,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
  });
  const raw = res.choices[0]?.message?.content || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { _parse_error: true, raw };
  }
}

async function generateImagePng(prompt) {
  const c = getClient();
  const safe = String(prompt || "minimal abstract product illustration")
    .slice(0, 3800)
    .replace(/\n+/g, " ");
  const res = await c.images.generate({
    model: IMAGE_MODEL,
    prompt: safe,
    size: "1024x1024",
    response_format: "b64_json",
    n: 1,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API returned no image data.");
  ensureGenDir();
  const id = `${randomUUID()}.png`;
  const fp = path.join(GEN_DIR, id);
  fs.writeFileSync(fp, Buffer.from(b64, "base64"));
  return { url: publicImageUrl(id), fileName: id };
}

/**
 * Latest stored HTML-derived text for this profile (startup scrape), if any.
 */
function getLatestStoredSiteBody(profileId) {
  const row = getDb()
    .prepare(
      `SELECT body_text, excerpt, title, url FROM scraped_pages
       WHERE profile_id = ? AND kind IN ('startup_site', 'creative_product')
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(profileId);
  if (!row) return null;
  const body = String(row.body_text || row.excerpt || "").trim();
  if (!body) return null;
  return {
    url: row.url,
    title: row.title,
    excerpt: String(row.excerpt || "").slice(0, 600),
    bodySample: body.slice(0, 120_000),
  };
}

/**
 * Creative context: URL and/or description from section 1.
 * Request may include profileId plus optional startupText / startupUrl overlays (current form values),
 * so ads/stories work with description-only, URL-only (when scrape works), or both — without requiring a separate product URL field.
 */
export async function loadCreativeContextForCreative(input, getProfileRow) {
  const overlayText = (input?.startupText || "").trim();
  const overlayUrl = (input?.startupUrl || "").trim();
  const id = (input?.profileId || "").trim();

  let row = null;
  if (id) {
    row = getProfileRow(id);
    if (!row) throw new HttpError(404, "Profile not found.");
  }

  const startupUrlResolved = overlayUrl || (row?.startup_url || "").trim();

  let founderText =
    overlayText ||
    (row?.combined_summary || "").trim() ||
    (row?.startup_text || "").trim() ||
    "";

  if (!founderText && id) {
    const stored = getLatestStoredSiteBody(id);
    if (stored) founderText = stored.bodySample.slice(0, 12_000);
  }

  if (!startupUrlResolved && !founderText) {
    throw new HttpError(
      400,
      "Add a startup description and/or website URL in section 1. Your current text and URL are sent automatically when you generate — save the profile if you want them stored."
    );
  }

  let scrape = null;
  let scrapeError = null;
  if (startupUrlResolved) {
    try {
      scrape = await scrapeUrl(startupUrlResolved, {
        profileId: id || null,
        kind: "creative_product",
      });
    } catch (e) {
      scrapeError = e.message || String(e);
    }
  }

  if (scrape) {
    return {
      source: "scraped_start_url",
      productUrl: scrape.url,
      pageTitle: scrape.title,
      excerpt: scrape.excerpt,
      bodySample: scrape.bodyPreview,
      founderContext: founderText.slice(0, 6000),
      scrapeNote: null,
    };
  }

  if (!founderText) {
    throw new HttpError(
      502,
      startupUrlResolved
        ? `Could not load the website (${scrapeError || "error"}). Add a written pitch in section 1, or fix the URL.`
        : "Add a startup description in section 1."
    );
  }

  const pageTitle =
    overlayText && !row
      ? "Startup brief (from your description)"
      : startupUrlResolved
        ? "Startup brief (site unavailable — using your pitch text)"
        : "Startup brief (from your saved profile)";

  return {
    source: startupUrlResolved ? "profile_text_fallback" : "profile_text_only",
    productUrl: startupUrlResolved || null,
    pageTitle,
    excerpt: founderText.slice(0, 500),
    bodySample: founderText.slice(0, 12_000),
    founderContext: founderText.slice(0, 6000),
    scrapeNote:
      startupUrlResolved && scrapeError
        ? `Live site fetch failed (${scrapeError}). Copy uses the pitch/description you provided.`
        : null,
  };
}

export async function generateAdFromProduct(ctx, output) {
  const brandName = inferBrandName(ctx);
  const system =
    "You are a senior performance marketer and copy chief. Write sharp, compliant ad copy (no misleading claims, no impersonation of real people/brands). " +
    "Always keep ad text minimal and conversion-focused: only essential words needed for an ad. " +
    "Ad must clearly map to the startup context (problem, audience, value). " +
    "Do not return fluffy prose or long paragraphs. " +
    "If the scrape is thin, infer cautiously and say what you assumed. " +
    "For image mode, design a complete ad creative: clear headline, subhead, CTA, and brand name visible in the visual.";
  const user = JSON.stringify({
    product_page: ctx,
    inferred_brand_name: brandName,
    output_mode: output,
    note:
      ctx.scrapeNote ||
      "Context is from the founder's saved profile (URL scrape and/or stored pitch).",
  });
  const parsed = await chatJson(
    system,
    user,
    `Schema: {
      "brand_name": string,
      "product_name": string,
      "target_audience": string,
      "core_offer": string,
      "headline": string,
      "subhead": string,
      "body": string,
      "cta": string,
      "platform_variants": {"linkedin": string, "instagram": string, "google_search": string},
      "hashtags": string[],
      "image_prompt_for_dalle": string,
      "image_text_overlay_lines": string[],
      "video_scene_beats": string[],
      "disclaimer": string
    }. Constraints:
    - headline <= 10 words
    - subhead <= 14 words
    - body <= 22 words
    - cta <= 4 words
    - image_text_overlay_lines: 3-5 short lines, each <= 8 words
    - must include brand_name at least once in headline/subhead/overlay lines
    `
  );

  if (parsed._parse_error) return parsed;

  const out = {
    mode: output,
    copy: {
      brand_name: parsed.brand_name || brandName,
      product_name: parsed.product_name || "",
      target_audience: parsed.target_audience || "",
      core_offer: parsed.core_offer || "",
      headline: parsed.headline,
      subhead: parsed.subhead,
      body: parsed.body,
      cta: parsed.cta,
      platform_variants: parsed.platform_variants,
      hashtags: parsed.hashtags,
      video_scene_beats: parsed.video_scene_beats,
      disclaimer: parsed.disclaimer,
    },
    image: null,
  };

  if (output === "image") {
    const overlay = Array.isArray(parsed.image_text_overlay_lines)
      ? parsed.image_text_overlay_lines.filter(Boolean).slice(0, 5)
      : [];
    const adImagePrompt =
      parsed.image_prompt_for_dalle ||
      `Create a polished conversion ad visual for "${parsed.brand_name || brandName}" and product "${parsed.product_name || "core product"}". Audience: "${parsed.target_audience || "target users"}". Offer: "${parsed.core_offer || parsed.subhead || "clear benefit"}". Include visible headline "${parsed.headline}", short support line "${parsed.subhead}", CTA "${parsed.cta}", and brand "${parsed.brand_name || brandName}". Clean hierarchy, high contrast typography, mobile-first square ad format. This must look like a real paid ad creative, not a generic plain visual.`;
    const img = await generateImagePng(
      `${adImagePrompt} ${
        overlay.length
          ? `Text overlays to include verbatim: ${overlay.join(" | ")}.`
          : ""
      } Ensure the ad includes visible marketing copy and logo/brand wordmark.`
    );
    out.image = img;
  }

  return out;
}

export async function generateStoryFromProduct(ctx, output) {
  const brandName = inferBrandName(ctx);
  const system =
    "You are a brand storyteller. Turn product evidence into a compelling narrative arc (problem → insight → product → outcome). " +
    "For image mode, produce a clear comic-like story with 3-4 panels that make sense in order. " +
    "Each panel must advance the plot, keep character/context continuity, and be understandable on its own. " +
    "Explain what the app does, why it matters, and how to use it in child-friendly language (simple words, concrete examples). " +
    "Include readable in-image text (captions/speech bubbles/sfx) and visible brand mention where natural.";
  const user = JSON.stringify({
    product_page: ctx,
    inferred_brand_name: brandName,
    output_mode: output,
    note:
      ctx.scrapeNote ||
      "Context is from the founder's saved profile (URL scrape and/or stored pitch).",
  });
  const parsed = await chatJson(
    system,
    user,
    `Schema: {
      "title": string,
      "story_markdown": string,
      "one_line_hook": string,
      "panels": [{"title": string, "paragraph": string, "image_prompt": string, "overlay_text_lines": string[]}]
    }. Constraints:
    - panels length: 4-6
    - panel 1 = problem/setup, panel 2 = tension/insight, panel 3 = product moment, panel 4 (optional) = outcome/CTA
    - paragraph: 1-2 short sentences, plain language
    - overlay_text_lines: 2-4 short lines for each panel, readable in comic bubbles/captions
    `,
    4500
  );

  if (parsed._parse_error) return parsed;

  const out = {
    mode: output,
    title: parsed.title,
    hook: parsed.one_line_hook,
    story_markdown: parsed.story_markdown,
    panels: [],
  };

  if (output === "images") {
    const panels = Array.isArray(parsed.panels) ? parsed.panels : [];
    const take = panels.slice(0, 6);
    for (const p of take) {
      const panelOverlay = Array.isArray(p.overlay_text_lines)
        ? p.overlay_text_lines.filter(Boolean).slice(0, 5)
        : [];
      const promptBase =
        p.image_prompt ||
        `Create one comic-style story panel for "${brandName}". Scene: ${p.title}. Narrative: ${p.paragraph}. Include readable caption/speech-bubble text and consistent character style.`.slice(
          0,
          3800
        );
      const prompt = `${promptBase} ${
        panelOverlay.length
          ? `Use these exact in-image text lines: ${panelOverlay.join(" | ")}.`
          : "Include short in-image narrative text and a subtle brand mention."
      }`;
      const img = await generateImagePng(prompt);
      out.panels.push({
        title: p.title,
        paragraph: p.paragraph,
        imageUrl: img.url,
      });
    }
  } else {
    out.panels = (parsed.panels || []).map((p) => ({
      title: p.title,
      paragraph: p.paragraph,
    }));
  }

  return out;
}

function tryResolveGeneratedImageFsPath(imageUrl) {
  const u = String(imageUrl || "").trim();
  if (!u.startsWith("/api/creative/static/")) return null;
  const fileName = u.split("/").pop();
  if (!fileName) return null;
  const fp = path.join(GEN_DIR, fileName);
  return fs.existsSync(fp) ? fp : null;
}

export async function buildStoryPdf(story) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "LETTER" });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(story?.title || "Storyboard", { underline: true });
    if (story?.hook) {
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor("#444").text(story.hook);
      doc.fillColor("#000");
    }
    if (story?.story_markdown) {
      doc.moveDown(0.4);
      doc.fontSize(10).text(String(story.story_markdown), { width: 500 });
    }
    doc.moveDown(0.6);

    const panels = Array.isArray(story?.panels) ? story.panels : [];
    panels.forEach((p, i) => {
      doc.fontSize(12).text(`${i + 1}. ${p?.title || `Panel ${i + 1}`}`);
      if (p?.paragraph) {
        doc.moveDown(0.2);
        doc.fontSize(10).text(String(p.paragraph), { width: 500 });
      }
      const fp = tryResolveGeneratedImageFsPath(p?.imageUrl);
      if (fp) {
        doc.moveDown(0.3);
        try {
          doc.image(fp, { fit: [500, 280], align: "left" });
        } catch {
          doc.fontSize(9).fillColor("#666").text("[Image unavailable]");
          doc.fillColor("#000");
        }
      } else if (p?.imageUrl) {
        doc.moveDown(0.2);
        doc.fontSize(9).fillColor("#666").text(`Image URL: ${p.imageUrl}`);
        doc.fillColor("#000");
      }
      if (i < panels.length - 1) doc.addPage();
    });

    doc.end();
  });
}

export { GEN_DIR };
