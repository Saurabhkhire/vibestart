import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";
import { getDb } from "./db.js";
import {
  loadCreativeContextForCreative,
  generateAdFromProduct,
  generateStoryFromProduct,
  buildStoryPdf,
} from "./creativeService.js";

function rowProfile(id) {
  return getDb().prepare("SELECT * FROM profiles WHERE id = ?").get(id);
}

export const creativeRouter = Router();

creativeRouter.post(
  "/ad",
  asyncRoute(async (req, res) => {
    const { profileId, startupText, startupUrl, output } = req.body || {};
    const mode = output === "image" ? "image" : "text";
    const ctx = await loadCreativeContextForCreative(
      { profileId, startupText, startupUrl },
      rowProfile
    );
    const result = await generateAdFromProduct(ctx, mode);
    return res.json({
      ok: true,
      context: {
        source: ctx.source,
        productUrl: ctx.productUrl,
        pageTitle: ctx.pageTitle,
        scrapeNote: ctx.scrapeNote,
      },
      result,
    });
  })
);

creativeRouter.post(
  "/story",
  asyncRoute(async (req, res) => {
    const { profileId, startupText, startupUrl, output } = req.body || {};
    const mode = output === "images" ? "images" : "text";
    const ctx = await loadCreativeContextForCreative(
      { profileId, startupText, startupUrl },
      rowProfile
    );
    const result = await generateStoryFromProduct(ctx, mode);
    return res.json({
      ok: true,
      context: {
        source: ctx.source,
        productUrl: ctx.productUrl,
        pageTitle: ctx.pageTitle,
        scrapeNote: ctx.scrapeNote,
      },
      result,
    });
  })
);

creativeRouter.post(
  "/story/pdf",
  asyncRoute(async (req, res) => {
    const story = req.body?.story;
    if (!story || typeof story !== "object") {
      return res.status(400).json({ error: "story payload required." });
    }
    const buf = await buildStoryPdf(story);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="vibestart-storyboard.pdf"'
    );
    res.send(buf);
  })
);
