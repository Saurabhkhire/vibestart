import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";
import { getDb } from "./db.js";
import {
  loadCreativeContextForProfile,
  generateAdFromProduct,
  generateStoryFromProduct,
} from "./creativeService.js";

function rowProfile(id) {
  return getDb().prepare("SELECT * FROM profiles WHERE id = ?").get(id);
}

export const creativeRouter = Router();

creativeRouter.post(
  "/ad",
  asyncRoute(async (req, res) => {
    const { profileId, output } = req.body || {};
    const mode = output === "image" ? "image" : "text";
    const ctx = await loadCreativeContextForProfile(profileId, rowProfile);
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
    const { profileId, output } = req.body || {};
    const mode = output === "images" ? "images" : "text";
    const ctx = await loadCreativeContextForProfile(profileId, rowProfile);
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
