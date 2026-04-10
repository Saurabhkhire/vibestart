import "dotenv/config";
import fs from "fs";
import express from "express";
import cors from "cors";
import "./db.js";
import { GEN_DIR } from "./creativeService.js";
import { api } from "./routes.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "127.0.0.1";

const devOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
if (process.env.CORS_ORIGIN) devOrigins.add(process.env.CORS_ORIGIN);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || devOrigins.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

if (!fs.existsSync(GEN_DIR)) {
  fs.mkdirSync(GEN_DIR, { recursive: true });
}
app.use("/api/creative/static", express.static(GEN_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "vibestart-backend" });
});

app.use("/api", api);

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  return next(err);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  const body = { error: err.message || "Server error" };
  if (err.detail) body.detail = err.detail;
  res.status(status).json(body);
});

const server = app.listen(PORT, HOST, () => {
  console.log(`VibeStart API http://${HOST}:${PORT}`);
});

server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;
server.requestTimeout = 0;
server.timeout = 0;
