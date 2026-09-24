import { Router, type IRouter } from "express";
import { currentAdmin, requireAdmin, changeAdminPassword } from "../lib/auth";
import { recordActivity } from "../lib/activity";
import { all, get, run, transaction } from "../lib/sqlite";
import { slugify } from "../lib/slugify";

const router: IRouter = Router();

router.get("/admin/submissions", requireAdmin, (_req, res) => {
  res.json(all(
    `SELECT s.id, s.user_id AS userId, u.email AS userEmail, u.display_name AS userName,
            s.name, s.short_description AS shortDescription, s.description,
            s.how_it_works AS howItWorks, s.best_for AS bestFor, s.website_url AS websiteUrl,
            s.logo_url AS logoUrl, s.preview_url AS previewUrl, s.pricing,
            s.suggested_categories AS suggestedCategories, s.status,
            s.review_note AS reviewNote, s.created_at AS createdAt, s.updated_at AS updatedAt
     FROM tool_submissions s JOIN users u ON u.id = s.user_id
     ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.created_at DESC`,
  ).map((submission) => ({
    ...submission,
    suggestedCategories: (() => {
      try { return JSON.parse(String(submission.suggestedCategories)); } catch { return []; }
    })(),
  })));
});

router.patch("/admin/submissions/:id", requireAdmin, (req, res) => {
  const admin = currentAdmin(req)!;
  const id = Number(req.params.id);
  const status = req.body?.status;
  const reviewNote = typeof req.body?.reviewNote === "string" ? req.body.reviewNote.trim().slice(0, 1000) : "";
  const categoryId = Number(req.body?.categoryId);
  if (!Number.isInteger(id) || id < 1 || !["approved", "rejected"].includes(status)) {
    res.status(400).json({ error: "Choose approve or reject for a valid submission." });
    return;
  }
  const submission = get<{
    id: number; user_id: number; name: string; short_description: string; description: string;
    how_it_works: string; best_for: string; website_url: string; logo_url: string | null;
    preview_url: string | null; pricing: string; status: string; user_email: string;
  }>(
    `SELECT s.*, u.email AS user_email FROM tool_submissions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    id,
  );
  if (!submission) {
    res.status(404).json({ error: "Submission not found." });
    return;
  }
  if (submission.status === "approved") {
    res.status(409).json({ error: "This submission has already been approved." });
    return;
  }
  if (status === "approved") {
    if (!Number.isInteger(categoryId) || !get<{ id: number }>("SELECT id FROM categories WHERE id = ?", categoryId)) {
      res.status(400).json({ error: "Choose an existing category before approving." });
      return;
    }
    const now = new Date().toISOString();
    const baseSlug = slugify(submission.name) || `tool-${id}`;
    let slug = baseSlug;
    let suffix = 2;
    while (get<{ id: number }>("SELECT id FROM tools WHERE slug = ?", slug)) {
      slug = `${baseSlug}-${suffix++}`;
    }
    try {
      const result = transaction(() => {
        const insert = run(
          `INSERT INTO tools (name, slug, short_description, description, how_it_works, best_for,
             website_url, logo_url, preview_url, category_id, pricing, featured, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'published', ?)`,
          submission.name, slug, submission.short_description, submission.description,
          submission.how_it_works, submission.best_for, submission.website_url, submission.logo_url,
          submission.preview_url, categoryId, submission.pricing, now,
        );
        const toolId = Number(insert.lastInsertRowid);
        run(
          `UPDATE tool_submissions SET status = 'approved', review_note = ?, updated_at = ?, reviewed_at = ?, reviewed_by = ?, published_tool_id = ?
           WHERE id = ?`,
          reviewNote, now, now, admin.id, toolId, id,
        );
        return toolId;
      });
      recordActivity("admin", admin.id, admin.email, "submission_approved", "submission", id, submission.name);
      res.json({ id, status: "approved", publishedToolId: result, reviewNote });
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Could not publish this submission." });
    }
    return;
  }
  const now = new Date().toISOString();
  run(
    "UPDATE tool_submissions SET status = 'rejected', review_note = ?, updated_at = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?",
    reviewNote || "This submission was not approved.", now, now, admin.id, id,
  );
  recordActivity("admin", admin.id, admin.email, "submission_rejected", "submission", id, submission.name);
  res.json({ id, status: "rejected", reviewNote: reviewNote || "This submission was not approved." });
});

router.get("/admin/users", requireAdmin, (_req, res) => {
  res.json(all(
    `SELECT u.id, u.email, u.display_name AS displayName, u.profession, u.status, u.created_at AS createdAt,
            (SELECT COUNT(*) FROM tool_submissions s WHERE s.user_id = u.id) AS submissionCount,
            (SELECT COUNT(*) FROM tool_submissions s WHERE s.user_id = u.id AND s.status = 'pending') AS pendingCount
     FROM users u ORDER BY u.created_at DESC`,
  ));
});

router.patch("/admin/users/:id", requireAdmin, (req, res) => {
  const admin = currentAdmin(req)!;
  const id = Number(req.params.id);
  const status = req.body?.status;
  if (!Number.isInteger(id) || id < 1 || !["active", "suspended"].includes(status)) {
    res.status(400).json({ error: "Choose active or suspended for a valid account." });
    return;
  }
  const user = get<{ id: number; email: string; status: string }>("SELECT id, email, status FROM users WHERE id = ?", id);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  run("UPDATE users SET status = ? WHERE id = ?", status, id);
  if (status === "suspended") run("DELETE FROM user_sessions WHERE user_id = ?", id);
  recordActivity("admin", admin.id, admin.email, `user_${status}`, "user", id, user.email);
  res.json({ id, status });
});

router.get("/admin/activity", requireAdmin, (_req, res) => {
  res.json(all(
    `SELECT id, actor_type AS actorType, actor_email AS actorEmail, action, target_type AS targetType,
            target_id AS targetId, details, created_at AS createdAt
     FROM activity_log ORDER BY created_at DESC LIMIT 200`,
  ));
});

router.post("/admin/password", requireAdmin, (req, res) => {
  const admin = currentAdmin(req)!;
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Use a new password with at least 8 characters." });
    return;
  }
  if (!changeAdminPassword(admin.id, currentPassword, newPassword)) {
    res.status(400).json({ error: "The current password is incorrect." });
    return;
  }
  recordActivity("admin", admin.id, admin.email, "password_changed", "admin", admin.id);
  res.json({ changed: true });
});

export default router;