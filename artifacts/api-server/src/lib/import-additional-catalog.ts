import catalog from '../data/additional-tool-catalog.json';
import { all, run, transaction } from './sqlite';
import { slugify } from './slugify';
import { logger } from './logger';

const receiptAction = 'additional_catalog_1000_v1';
const categories = [
  ['Communication', 'Messaging, communities, email, and video communication.', '#8BE8D5'],
  ['Files & Storage', 'Store, synchronize, archive, and share your files.', '#BBA7FF'],
  ['Business & Finance', 'Finance, commerce, customer relationships, and business operations.', '#FFCF70'],
  ['Knowledge & Learning', 'Wikis, research, reading, documents, and learning platforms.', '#D8FF63'],
  ['Web & Publishing', 'Publish websites, blogs, and structured online content.', '#FF9F68'],
  ['Infrastructure', 'Manage servers, networks, access, and self-hosted services.', '#8BC6E8'],
  ['Home & Lifestyle', 'Tools for home automation, maps, recipes, and personal projects.', '#A9DCA0'],
  ['Games', 'Games, game servers, and community management tools.', '#FF7B9C'],
];

function urlIdentity(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().replace(/^www\./, '') + url.pathname.replace(/\/$/, '').toLowerCase();
  } catch { return value.toLowerCase(); }
}

/** One-time, attributed supplement. Never updates an administrator's listing. */
export async function importAdditionalCatalog() {
  return transaction(async () => {
    const receipt = await all('SELECT id FROM activity_log WHERE action = ? AND target_type = ? LIMIT 1', receiptAction, 'catalog');
    if (receipt.length) return 0;
    for (const [name, description, accent] of categories) {
      await run('INSERT INTO categories (name, slug, description, accent) VALUES (?, ?, ?, ?) ON CONFLICT (slug) DO NOTHING', name, slugify(name), description, accent);
    }
    const savedCategories = await all<{ id: number; slug: string }>('SELECT id, slug FROM categories');
    const categoryIds = new Map(savedCategories.map((category) => [category.slug, category.id]));
    const existing = await all<{ slug: string; website_url: string }>('SELECT slug, website_url FROM tools');
    const slugs = new Set(existing.map((tool) => tool.slug));
    const urls = new Set(existing.map((tool) => urlIdentity(tool.website_url)));
    const rows: unknown[][] = [];
    for (const tool of catalog.tools) {
      const slug = slugify(tool.name);
      const identity = urlIdentity(tool.websiteUrl);
      if (slugs.has(slug) || urls.has(identity)) continue;
      const categoryId = categoryIds.get(slugify(tool.category));
      if (!categoryId) throw new Error(`Catalog category missing: ${tool.category}`);
      const attribution = `Catalog summary: Awesome-Selfhosted contributors (CC BY-SA 3.0). Source: ${tool.sourceUrl}`;
      rows.push([
        tool.name, slug, tool.shortDescription, `${tool.shortDescription}\n\n${attribution}`,
        `This is a self-hosted software listing. Visit the project website for installation instructions, hosting requirements, documentation, and any commercial plans.`,
        tool.tags.join(', '), tool.websiteUrl, null,
        `https://api.microlink.io/?url=${encodeURIComponent(tool.websiteUrl)}&screenshot=true&meta=false&embed=screenshot.url`,
        categoryId, 'See website', 0, 'published', new Date().toISOString(),
      ]);
      slugs.add(slug);
      urls.add(identity);
    }
    let inserted = 0;
    // Bounded bulk statements avoid 1,000 round trips on the production pooler.
    for (let start = 0; start < rows.length; start += 50) {
      const batch = rows.slice(start, start + 50);
      const placeholders = batch.map(() => '(' + Array(14).fill('?').join(', ') + ')').join(', ');
      const result = await run(
        `INSERT INTO tools (name, slug, short_description, description, how_it_works, best_for, website_url, logo_url, preview_url, category_id, pricing, featured, status, created_at) VALUES ${placeholders} ON CONFLICT (slug) DO NOTHING`,
        ...batch.flat(),
      );
      inserted += result.changes;
    }
    await run(
      'INSERT INTO activity_log (actor_type, actor_id, actor_email, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      'system', null, 'system', receiptAction, 'catalog', null,
      `Imported ${inserted} additional listings from Awesome-Selfhosted ${catalog.sourceCommit}; summaries CC BY-SA 3.0; existing listings preserved.`, new Date().toISOString(),
    );
    logger.info({ inserted, catalogSize: catalog.tools.length }, 'Imported additional tool catalog');
    return inserted;
  });
}
