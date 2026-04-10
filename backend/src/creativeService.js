import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { HttpError } from "./httpError.js";
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
 * Build creative context from a saved profile only (no ad-hoc URL from the client).
 * Uses startup_url (re-scraped when present) plus combined_summary / startup_text.
 */
export async function loadCreativeContextForProfile(profileId, getProfileRow) {
  const id = (profileId || "").trim();
  if (!id) throw new HttpError(400, "profileId is required.");

  const row = getProfileRow(id);
  if (!row) throw new HttpError(404, "Profile not found.");

  const startupUrl = (row.startup_url || "").trim();
  const founderText = (row.combined_summary || row.startup_text || "").trim();

  if (!startupUrl && !founderText) {
    throw new HttpError(
      400,
      "Save a startup URL and/or pitch text in your profile (section 1) first."
    );
  }

  let scrape = null;
  let scrapeError = null;
  if (startupUrl) {
    try {
      scrape = await scrapeUrl(startupUrl, {
        profileId: id,
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
      startupUrl
        ? `Could not fetch startup URL (${scrapeError || "unknown error"}). Fix the URL or add pitch text in your profile.`
        : "Add pitch text in your profile."
    );
  }

  return {
    source: startupUrl ? "profile_text_fallback" : "profile_text_only",
    productUrl: startupUrl || null,
    pageTitle: startupUrl
      ? "Startup brief (site unavailable — using saved profile text)"
      : "Startup brief (from your saved profile)",
    excerpt: founderText.slice(0, 500),
    bodySample: founderText.slice(0, 12_000),
    founderContext: founderText.slice(0, 6000),
    scrapeNote:
      startupUrl && scrapeError
        ? `Live site fetch failed (${scrapeError}). Copy uses your saved brief.`
        : null,
  };
}

export async function generateAdFromProduct(ctx, output) {
  const system =
    "You are a senior performance marketer and copy chief. Write sharp, compliant ad copy (no misleading claims, no impersonation of real people/brands). " +
    "If the scrape is thin, infer cautiously and say what you assumed.";
  const user = JSON.stringify({
    product_page: ctx,
    output_mode: output,
    note:
      ctx.scrapeNote ||
      "Context is from the founder's saved profile (URL scrape and/or stored pitch).",
  });
  const parsed = await chatJson(
    system,
    user,
    `Schema: {
      "headline": string,
      "subhead": string,
      "body": string,
      "cta": string,
      "platform_variants": {"linkedin": string, "instagram": string, "google_search": string},
      "hashtags": string[],
      "image_prompt_for_dalle": string,
      "disclaimer": string
    }`
  );

  if (parsed._parse_error) return parsed;

  const out = {
    mode: output,
    copy: {
      headline: parsed.headline,
      subhead: parsed.subhead,
      body: parsed.body,
      cta: parsed.cta,
      platform_variants: parsed.platform_variants,
      hashtags: parsed.hashtags,
      disclaimer: parsed.disclaimer,
    },
    image: null,
  };

  if (output === "image") {
    const img = await generateImagePng(
      parsed.image_prompt_for_dalle ||
        `Advertising visual for: ${parsed.headline}. ${parsed.subhead}. Clean, professional, no text overlay.`
    );
    out.image = img;
  }

  return out;
}

export async function generateStoryFromProduct(ctx, output) {
  const system =
    "You are a brand storyteller. Turn product evidence into a compelling narrative arc (problem → insight → product → outcome). " +
    "For image mode, provide 3–4 distinct scene prompts suitable for illustration (no text in image, no real-person likeness).";
  const user = JSON.stringify({
    product_page: ctx,
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
      "panels": [{"title": string, "paragraph": string, "image_prompt": string}]
    }`,
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
    const take = panels.slice(0, 4);
    for (const p of take) {
      const prompt =
        p.image_prompt ||
        `Story illustration: ${p.title}. ${p.paragraph}`.slice(0, 3800);
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

export { GEN_DIR };
