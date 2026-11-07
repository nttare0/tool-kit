import catalog from '../data/tool-catalog.json';
import { all, run, transaction } from './sqlite';
import { slugify } from './slugify';
import { logger } from './logger';

/** Add curated starter listings without replacing administrator-owned content. */
export async function importToolCatalog() {
  return transaction(async () => {
    // A durable receipt prevents later admin deletions from being re-imported.
    const receipt = await all("SELECT id FROM activity_log WHERE action = ? AND target_type = ? LIMIT 1", 'starter_catalog_200_v1', 'catalog');
    if (receipt.length) return 0;
    const categories = await all<{ id: number; slug: string }>('SELECT id, slug FROM categories');
    const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));
    const existing = await all<{ slug: string; website_url: string }>('SELECT slug, website_url FROM tools');
    const slugs = new Set(existing.map((tool) => tool.slug));
    const normalizedUrl = (url: string) => url.replace(/\/$/, '').toLowerCase();
    const urls = new Set(existing.map((tool) => normalizedUrl(tool.website_url)));
    let inserted = 0;
    for (const tool of catalog) {
      const slug = slugify(tool.name);
      if (slugs.has(slug) || urls.has(normalizedUrl(tool.websiteUrl))) continue;
      const categoryId = categoryIds.get(slugify(tool.category));
      if (!categoryId) throw new Error(`Catalog category missing: ${tool.category}`);
      const result = await run(
        `INSERT INTO tools
         (name, slug, short_description, description, how_it_works, best_for, website_url, logo_url, preview_url, category_id, pricing, featured, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (slug) DO NOTHING`,
        tool.name, slug, tool.shortDescription, tool.shortDescription,
        `Visit the official ${tool.name} website to review its features, access requirements, and documentation.`,
        tool.category, tool.websiteUrl, null,
        `https://api.microlink.io/?url=${encodeURIComponent(tool.websiteUrl)}&screenshot=true&meta=false&embed=screenshot.url`,
        categoryId, 'See website', 0, 'published', new Date().toISOString(),
      );
      inserted += result.changes;
      slugs.add(slug);
      urls.add(normalizedUrl(tool.websiteUrl));
    }
    await run(
      `INSERT INTO activity_log (actor_type, actor_id, actor_email, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      'system', null, 'system', 'starter_catalog_200_v1', 'catalog', null,
      `Imported ${inserted} new listings from a 200-tool starter catalog; existing listings preserved.`, new Date().toISOString(),
    );
    logger.info({ inserted, catalogSize: catalog.length }, 'Imported starter tool catalog');
    return inserted;
  });
}
