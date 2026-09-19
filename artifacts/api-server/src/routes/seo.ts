import { Router, type IRouter } from "express";
import { all } from "../lib/sqlite";

const router: IRouter = Router();

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  }[character] || character));
}

router.get("/sitemap.xml", (req, res) => {
  const configuredSiteUrl = process.env.PUBLIC_SITE_URL?.trim();
  const requestSiteUrl = `${req.protocol}://${req.get("host")}`;
  const siteUrl = (configuredSiteUrl || requestSiteUrl).replace(/\/$/, "");
  const tools = all<{ slug: string; created_at: string }>(
    "SELECT slug, created_at FROM tools WHERE status = 'published' ORDER BY created_at DESC",
  );
  const urls: Array<{ path: string; priority: string; changefreq: string; lastmod?: string }> = [
    { path: "/", priority: "1.0", changefreq: "weekly" },
    { path: "/directory", priority: "0.9", changefreq: "daily" },
    { path: "/terms", priority: "0.2", changefreq: "yearly" },
    { path: "/privacy", priority: "0.2", changefreq: "yearly" },
    ...tools.map((tool) => ({ path: `/tool/${tool.slug}`, priority: "0.8", changefreq: "weekly", lastmod: tool.created_at })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(`${siteUrl}${url.path}`)}</loc><changefreq>${url.changefreq}</changefreq><priority>${url.priority}</priority>${url.lastmod ? `<lastmod>${escapeXml(url.lastmod)}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
  res.type("application/xml").set("Cache-Control", "public, max-age=300").send(body);
});

export default router;