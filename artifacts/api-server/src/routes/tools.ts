import { Router, type IRouter } from "express";
import {
  CreateToolBody,
  CreateToolResponse,
  DeleteToolParams,
  GetToolParams,
  GetToolResponse,
  ListToolsQueryParams,
  ListToolsResponse,
  UpdateToolBody,
  UpdateToolParams,
  UpdateToolResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";
import { all, get, run } from "../lib/sqlite";
import { slugify } from "../lib/slugify";

const router: IRouter = Router();

type ToolRow = {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  how_it_works: string;
  best_for: string;
  website_url: string;
  logo_url: string | null;
  preview_url: string | null;
  category_id: number;
  category_name: string;
  category_slug: string;
  pricing: string;
  featured: number;
  status: string;
  created_at: string;
};

function presentTool(row: ToolRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    howItWorks: row.how_it_works,
    bestFor: row.best_for,
    websiteUrl: row.website_url,
    logoUrl: row.logo_url,
    previewUrl: row.preview_url,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    pricing: row.pricing,
    featured: Boolean(row.featured),
    status: row.status,
    createdAt: row.created_at,
  };
}

const baseQuery = `
  SELECT
    t.id, t.name, t.slug, t.short_description, t.description,
    t.how_it_works, t.best_for, t.website_url, t.logo_url, t.preview_url,
    t.category_id, c.name AS category_name, c.slug AS category_slug,
    t.pricing, t.featured, t.status, t.created_at
  FROM tools t
  INNER JOIN categories c ON c.id = t.category_id
`;

function findTool(id: number) {
  const row = get<ToolRow>(`${baseQuery} WHERE t.id = ?`, id);
  return row ? presentTool(row) : undefined;
}

router.get("/tools", (req, res): void => {
  const parsed = ListToolsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, category, featured, status } = parsed.data;
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status !== "all") {
    clauses.push("t.status = ?");
    params.push(status || "published");
  }
  if (search) {
    clauses.push(
      "(lower(t.name) LIKE lower(?) OR lower(t.short_description) LIKE lower(?) OR lower(t.description) LIKE lower(?) OR lower(c.name) LIKE lower(?))",
    );
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (category) {
    clauses.push("c.slug = ?");
    params.push(category);
  }
  if (featured === true) clauses.push("t.featured = 1");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = all<ToolRow>(
    `${baseQuery} ${where} ORDER BY t.featured DESC, t.created_at DESC`,
    ...params,
  );
  res.json(ListToolsResponse.parse(rows.map(presentTool)));
});

router.post("/tools", requireAdmin, (req, res): void => {
  const parsed = CreateToolBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  if (body.previewUrl && body.previewUrl.length > 4_000_000) {
    res.status(413).json({ error: "Preview image is too large. Keep it under 3 MB." });
    return;
  }
  const now = new Date().toISOString();
  try {
    const result = run(
      `INSERT INTO tools
       (name, slug, short_description, description, how_it_works, best_for, website_url, logo_url, preview_url, category_id, pricing, featured, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      body.name,
      slugify(body.name),
      body.shortDescription,
      body.description,
      body.howItWorks,
      body.bestFor ?? "",
      body.websiteUrl,
      body.logoUrl ?? null,
      body.previewUrl ?? null,
      body.categoryId,
      body.pricing,
      body.featured ? 1 : 0,
      body.status ?? "draft",
      now,
    );
    const tool = findTool(Number(result.lastInsertRowid));
    res.status(201).json(CreateToolResponse.parse(tool));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not create tool" });
  }
});

router.get("/tools/:id", (req, res): void => {
  const params = GetToolParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const tool = findTool(params.data.id);
  if (!tool) {
    res.status(404).json({ error: "Tool not found" });
    return;
  }
  res.json(GetToolResponse.parse(tool));
});

router.patch("/tools/:id", requireAdmin, (req, res): void => {
  const params = UpdateToolParams.safeParse(req.params);
  const parsed = UpdateToolBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  if (data.previewUrl && data.previewUrl.length > 4_000_000) {
    res.status(413).json({ error: "Preview image is too large. Keep it under 3 MB." });
    return;
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    name: data.name,
    slug: data.name ? slugify(data.name) : undefined,
    short_description: data.shortDescription,
    description: data.description,
    how_it_works: data.howItWorks,
    best_for: data.bestFor,
    website_url: data.websiteUrl,
    logo_url: data.logoUrl,
    preview_url: data.previewUrl,
    category_id: data.categoryId,
    pricing: data.pricing,
    featured: data.featured === undefined ? undefined : data.featured ? 1 : 0,
    status: data.status,
  };
  for (const [field, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${field} = ?`);
      values.push(value);
    }
  }
  if (fields.length) {
    values.push(params.data.id);
    run(`UPDATE tools SET ${fields.join(", ")} WHERE id = ?`, ...values);
  }
  const tool = findTool(params.data.id);
  if (!tool) {
    res.status(404).json({ error: "Tool not found" });
    return;
  }
  res.json(UpdateToolResponse.parse(tool));
});

router.delete("/tools/:id", requireAdmin, (req, res): void => {
  const params = DeleteToolParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const result = run("DELETE FROM tools WHERE id = ?", params.data.id);
  if (!result.changes) {
    res.status(404).json({ error: "Tool not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;