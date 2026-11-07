import { Router, type IRouter } from "express";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  DeleteCategoryParams,
  ListCategoriesResponse,
  UpdateCategoryBody,
  UpdateCategoryParams,
  UpdateCategoryResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../lib/auth";
import { all, get, run } from "../lib/sqlite";
import { slugify } from "../lib/slugify";

const router: IRouter = Router();

type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  description: string;
  accent: string;
  tool_count: number;
};

function presentCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    accent: row.accent,
    toolCount: row.tool_count,
  };
}

async function getCategories() {
  return (
    await all<CategoryRow>(
      `SELECT c.id, c.name, c.slug, c.description, c.accent,
      (SELECT count(*) FROM tools t WHERE t.category_id = c.id) AS tool_count
     FROM categories c ORDER BY c.name ASC`,
    )
  ).map(presentCategory);
}

router.get("/categories", async (_req, res) => {
  res.json(ListCategoriesResponse.parse(await getCategories()));
});

router.post("/categories", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const result = await run(
      "INSERT INTO categories (name, slug, description, accent) VALUES (?, ?, ?, ?)",
      parsed.data.name,
      slugify(parsed.data.name),
      parsed.data.description,
      parsed.data.accent ?? "#D8FF63",
    );
    const created = (await getCategories()).find(
      (category) => category.id === Number(result.lastInsertRowid),
    );
    res.status(201).json(CreateCategoryResponse.parse(created));
  } catch (error) {
    res
      .status(400)
      .json({
        error:
          error instanceof Error ? error.message : "Could not create category",
      });
  }
});

router.patch(
  "/categories/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateCategoryParams.safeParse(req.params);
    const parsed = UpdateCategoryBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    const map: Record<string, unknown> = {
      name: parsed.data.name,
      slug: parsed.data.name ? slugify(parsed.data.name) : undefined,
      description: parsed.data.description,
      accent: parsed.data.accent,
    };
    for (const [field, value] of Object.entries(map)) {
      if (value !== undefined) {
        fields.push(`${field} = ?`);
        values.push(value);
      }
    }
    if (fields.length) {
      values.push(params.data.id);
      await run(
        `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`,
        ...values,
      );
    }
    const category = (await getCategories()).find(
      (item) => item.id === params.data.id,
    );
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(UpdateCategoryResponse.parse(category));
  },
);

router.delete(
  "/categories/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteCategoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const tools = await get<{ id: number }>(
      "SELECT id FROM tools WHERE category_id = ? LIMIT 1",
      params.data.id,
    );
    if (tools) {
      res
        .status(409)
        .json({ error: "Move or delete tools in this category first." });
      return;
    }
    const result = await run(
      "DELETE FROM categories WHERE id = ?",
      params.data.id,
    );
    if (!result.changes) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
