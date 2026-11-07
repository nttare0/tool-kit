import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Replit preview and deployment need to frame the app — SAMEORIGIN allows
  // preview while still blocking external clickjacking.
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const configuredWebOrigin = process.env.WEB_ORIGIN?.trim();
// In production the frontend is served from the same origin (single-port
// Autoscale deployment). If WEB_ORIGIN is not set, we allow any origin
// for local dev and preview environments where the host is dynamic (Replit
// preview URLs, localhost vite dev servers, etc.). When WEB_ORIGIN is set,
// we enforce it strictly.
app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (!configuredWebOrigin) {
      callback(null, true);
      return;
    }
    if (origin === configuredWebOrigin) {
      callback(null, true);
      return;
    }
    // Allow Replit preview hosts implicitly when WEB_ORIGIN is a repl
    // — this keeps deployments working without manual env changes.
    callback(null, false);
  },
}));
app.use(cookieParser());
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

app.use("/api", router);

// In production (Autoscale) the API and frontend run on a single port.
// If the Toolstack Vite build exists (artifacts/toolstack/dist/public), serve it
// as static files and fallback to index.html for SPA routing. This makes a
// single `api-server` deployment serve both `/api/*` and the UI.
const currentFile = fileURLToPath(import.meta.url);
const distDir = path.dirname(currentFile);

// Resolve Toolstack static in both dev (vite) and prod (bundled) layouts
const candidateRoots = [
  path.resolve(distDir, "..", "..", "..", "artifacts", "toolstack", "dist", "public"), // bundled: artifacts/api-server/dist -> workspace/artifacts/toolstack
  path.resolve(distDir, "dist", "public"), // if api-server and toolstack share a parent build
  path.resolve(process.cwd(), "artifacts", "toolstack", "dist", "public"), // cwd = workspace root
  path.resolve(process.cwd(), "dist", "public"), // cwd = artifacts/toolstack
  path.resolve(process.cwd(), "public"), // fallback
];

let toolstackDist = "";
let toolstackIndex = "";
for (const candidate of candidateRoots) {
  const idx = path.join(candidate, "index.html");
  if (fs.existsSync(idx)) {
    toolstackDist = candidate;
    toolstackIndex = idx;
    break;
  }
}
// Fallback to the primary expected path for logging
if (!toolstackDist) {
  toolstackDist = candidateRoots[0];
  toolstackIndex = path.join(toolstackDist, "index.html");
}

if (fs.existsSync(toolstackIndex)) {
  logger.info({ toolstackDist }, "Serving Toolstack frontend from dist/public");
  app.use(express.static(toolstackDist, { maxAge: "1h", setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
  }}));

  // SPA fallback — serve index.html for any non-API route that isn't a file.
  // Express 5 requires named splat: "/*splat" not "*".
  app.get("/*splat", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    // Don't interfere with files that exist in dist (e.g. /og-image.svg, /robots.txt)
    // express.static already handled them; this is for SPA routes like /tool/:slug
    if (path.extname(req.path)) return next();
    res.sendFile(toolstackIndex, (err) => {
      if (err) next(err);
    });
  });
} else {
  // Helpful root response when frontend hasn't been built (e.g. local API-only dev)
  app.get("/", (_req, res) => {
    res.json({
      name: "Toolstack API",
      health: "/api/healthz",
      frontend: fs.existsSync(toolstackDist) ? "built but index missing" : "not built — run `pnpm --filter @workspace/toolstack run build` or start the vite dev server",
    });
  });
}

export default app;
