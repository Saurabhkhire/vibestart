import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";
import { getDb } from "./db.js";
import {
  loadCreativeContext,
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
    const { productUrl, profileId, output } = req.body || {};
    const mode = output === "image" ? "image" : "text";
    const ctx = await loadCreativeContext(productUrl, profileId, rowProfile);
    const result = await generateAdFromProduct(ctx, mode);
    return res.json({ ok: true, context: { productUrl: ctx.productUrl, pageTitle: ctx.pageTitle }, result });
  })
);

creativeRouter.post(
  "/story",
  asyncRoute(async (req, res) => {
    const { productUrl, profileId, output } = req.body || {};
    const mode = output === "images" ? "images" : "text";
    const ctx = await loadCreativeContext(productUrl, profileId, rowProfile);
    const result = await generateStoryFromProduct(ctx, mode);
    return res.json({ ok: true, context: { productUrl: ctx.productUrl, pageTitle: ctx.pageTitle }, result });
  })
);
