import { Router, type IRouter, type Request } from "express";
import { currentUser, requireUser, registerUser, loginUser, logoutUser, changeUserPassword } from "../lib/user-auth";
import { recordActivity } from "../lib/activity";
import { all, get, run, transaction } from "../lib/sqlite";

const router: IRouter = Router();
const failedLogins = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

function loginKey(request: Request) {
  return request.ip || "unknown";
}

function isRateLimited(key: string) {
  const attempt = failedLogins.get(key);
  if (!attempt || attempt.resetAt <= Date.now()) {
    failedLogins.delete(key);
    return false;
  }
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(key: string) {
  const current = failedLogins.get(key);
  if (!current || current.resetAt <= Date.now()) {
    failedLogins.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  current.count += 1;
}

function cleanText(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function safeUser(req: Request) {
  return currentUser(req);
}

router.post("/auth/register", (req, res) => {
  const displayName = cleanText(req.body?.displayName, 100);
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password.slice(0, 256) : "";
  const profession = cleanText(req.body?.profession, 100);
  if (displayName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    res.status(400).json({ error: "Enter your name, a valid email, and a password with at least 8 characters." });
    return;
  }
  const id = registerUser(displayName, email, password, profession);
  if (!id) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }
  const user = loginUser(email, password, res);
  recordActivity("user", id, email, "account_created", "user", id);
  res.status(201).json({ user });
});

router.get("/auth/user/status", (req, res) => {
  const user = safeUser(req);
  res.json({ user: user ? { id: user.id, email: user.email, displayName: user.displayName, profession: user.profession } : null });
});

router.post("/auth/user/login", (req, res) => {
  const key = loginKey(req);
  if (isRateLimited(key)) {
    res.setHeader("Retry-After", String(Math.ceil((failedLogins.get(key)!.resetAt - Date.now()) / 1000)));
    res.status(429).json({ error: "Too many login attempts. Try again later." });
    return;
  }
  const email = cleanText(req.body?.email, 254);
  const password = typeof req.body?.password === "string" ? req.body.password.slice(0, 256) : "";
  const user = loginUser(email, password, res);
  if (!user) {
    recordFailedLogin(key);
    res.status(401).json({ error: "Email or password is incorrect, or this account is unavailable." });
    return;
  }
  failedLogins.delete(key);
  recordActivity("user", user.id, user.email, "signed_in", "user", user.id);
  res.json({ user });
});

router.post("/auth/user/logout", (req, res) => {
  const user = currentUser(req);
  if (user) recordActivity("user", user.id, user.email, "signed_out", "user", user.id);
  logoutUser(req, res);
  res.sendStatus(204);
});

router.patch("/account/profile", requireUser, (req, res) => {
  const user = currentUser(req)!;
  const displayName = cleanText(req.body?.displayName, 100);
  const profession = cleanText(req.body?.profession, 100);
  const categoryIds = Array.isArray(req.body?.categoryIds)
    ? [...new Set(req.body.categoryIds.map(Number).filter((value: number) => Number.isInteger(value) && value > 0))].slice(0, 12)
    : [];
  if (displayName.length < 2) {
    res.status(400).json({ error: "Your name must contain at least 2 characters." });
    return;
  }
  const existingCategories = categoryIds.length
    ? all<{ id: number }>(`SELECT id FROM categories WHERE id IN (${categoryIds.map(() => "?").join(",")})`, ...categoryIds)
    : [];
  if (existingCategories.length !== categoryIds.length) {
    res.status(400).json({ error: "One or more selected interests are not available." });
    return;
  }
  transaction(() => {
    run("UPDATE users SET display_name = ?, profession = ? WHERE id = ?", displayName, profession, user.id);
    run("DELETE FROM user_interests WHERE user_id = ?", user.id);
    for (const categoryId of categoryIds) run("INSERT INTO user_interests (user_id, category_id) VALUES (?, ?)", user.id, categoryId);
  });
  recordActivity("user", user.id, user.email, "profile_updated", "user", user.id);
  res.json({
    user: { id: user.id, email: user.email, displayName, profession },
    categoryIds,
  });
});

router.get("/account/profile", requireUser, (req, res) => {
  const user = currentUser(req)!;
  const categoryIds = all<{ category_id: number }>("SELECT category_id FROM user_interests WHERE user_id = ? ORDER BY category_id", user.id).map((item) => item.category_id);
  res.json({ user: { id: user.id, email: user.email, displayName: user.displayName, profession: user.profession }, categoryIds });
});

router.post("/account/password", requireUser, (req, res) => {
  const user = currentUser(req)!;
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword.slice(0, 256) : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword.slice(0, 256) : "";
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Use a new password with at least 8 characters." });
    return;
  }
  if (!changeUserPassword(user.id, currentPassword, newPassword, user.sessionId)) {
    res.status(400).json({ error: "The current password is incorrect." });
    return;
  }
  recordActivity("user", user.id, user.email, "password_changed", "user", user.id);
  res.json({ changed: true });
});

router.get("/account/submissions", requireUser, (req, res) => {
  const user = currentUser(req)!;
  const submissions = all(
    `SELECT id, name, website_url AS websiteUrl, status, review_note AS reviewNote, created_at AS createdAt,
            updated_at AS updatedAt, preview_url AS previewUrl
     FROM tool_submissions WHERE user_id = ? ORDER BY created_at DESC`,
    user.id,
  );
  res.json(submissions);
});

router.post("/submissions", requireUser, (req, res) => {
  const user = currentUser(req)!;
  const name = cleanText(req.body?.name, 120);
  const websiteUrl = cleanText(req.body?.websiteUrl, 2000);
  const shortDescription = cleanText(req.body?.shortDescription, 300);
  const description = cleanText(req.body?.description, 4000);
  const howItWorks = cleanText(req.body?.howItWorks, 3000);
  const bestFor = cleanText(req.body?.bestFor, 1000);
  const pricing = cleanText(req.body?.pricing, 100);
  const logoUrl = cleanText(req.body?.logoUrl, 2000);
  if (!name || !isHttpUrl(websiteUrl) || !shortDescription || !description || !howItWorks || !pricing) {
    res.status(400).json({ error: "Complete the required fields and enter a valid http(s) website URL." });
    return;
  }
  if (logoUrl && !isHttpUrl(logoUrl) && !logoUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "Logo URL must use http(s) or be an image upload." });
    return;
  }
  const now = new Date().toISOString();
  const previewUrl = `https://api.microlink.io/?url=${encodeURIComponent(websiteUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
  try {
    const result = run(
      `INSERT INTO tool_submissions
       (user_id, name, short_description, description, how_it_works, best_for, website_url, logo_url, preview_url, pricing, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      user.id, name, shortDescription, description, howItWorks, bestFor, websiteUrl, logoUrl || null, previewUrl, pricing, now, now,
    );
    const submissionId = Number(result.lastInsertRowid);
    recordActivity("user", user.id, user.email, "tool_submitted", "submission", submissionId, name);
    res.status(201).json({ id: submissionId, name, websiteUrl, status: "pending", createdAt: now, previewUrl });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not submit this tool." });
  }
});

router.get("/tools/:slug/related", (req, res) => {
  const source = get<{ id: number; category_id: number; name: string; short_description: string; best_for: string; how_it_works: string }>(
    `SELECT id, category_id, name, short_description, best_for, how_it_works FROM tools WHERE slug = ? AND status = 'published'`,
    req.params.slug,
  );
  if (!source) {
    res.status(404).json({ error: "Tool not found." });
    return;
  }
  const sourceWords = new Set(`${source.name} ${source.short_description} ${source.best_for} ${source.how_it_works}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
  const candidates = all<{ id: number; slug: string; name: string; short_description: string; category_id: number; category_name: string; pricing: string; preview_url: string | null; website_url: string; featured: number; created_at: string; best_for: string; how_it_works: string }>(
    `SELECT t.id, t.slug, t.name, t.short_description, t.category_id, c.name AS category_name, t.pricing,
            t.preview_url, t.website_url, t.featured, t.created_at, t.best_for, t.how_it_works
     FROM tools t JOIN categories c ON c.id = t.category_id
     WHERE t.status = 'published' AND t.id != ?`,
    source.id,
  );
  const ranked = candidates.map((tool) => {
    const words = `${tool.name} ${tool.short_description} ${tool.best_for} ${tool.how_it_works}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
    const overlap = words.reduce((score, word) => score + (sourceWords.has(word) ? 1 : 0), 0);
    return { ...tool, score: overlap + (tool.category_id === source.category_id ? 3 : 0) };
  }).sort((a, b) => b.score - a.score || b.featured - a.featured || b.created_at.localeCompare(a.created_at)).slice(0, 4);
  res.json(ranked.map((tool) => ({
    id: tool.id, slug: tool.slug, name: tool.name, shortDescription: tool.short_description,
    categoryName: tool.category_name, pricing: tool.pricing, previewUrl: tool.preview_url,
    websiteUrl: tool.website_url, featured: Boolean(tool.featured), createdAt: tool.created_at,
    score: tool.score,
  })));
});

export default router;