import { Router, type IRouter } from 'express';
import catalog from '../data/additional-tool-catalog.json';
import { all } from '../lib/sqlite';
import { slugify } from '../lib/slugify';

const router: IRouter = Router();
const sources = new Map(catalog.tools.map((tool) => [slugify(tool.name), tool]));

function repositoryUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    // A hosting homepage, issue, or single-file URL is not a repository listing.
    if (!['github.com', 'gitlab.com', 'codeberg.org', 'bitbucket.org'].includes(url.hostname)) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    url.pathname = '/' + (url.hostname === 'gitlab.com' ? segments.join('/') : segments.slice(0, 2).join('/')).replace(/\.git$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch { return null; }
}

router.get('/repositories', async (_req, res) => {
  const tools = await all<{
    id: number; name: string; slug: string; short_description: string;
    website_url: string; category_name: string; category_slug: string;
  }>(`SELECT t.id, t.name, t.slug, t.short_description, t.website_url,
      c.name AS category_name, c.slug AS category_slug
      FROM tools t JOIN categories c ON c.id = t.category_id
      WHERE t.status = 'published' ORDER BY lower(t.name), t.id`);
  const seen = new Set<string>();
  const repositories = tools.flatMap((tool) => {
    const source = sources.get(tool.slug);
    // Don't attach stale metadata if an admin repurposes a catalog listing.
    const matchesSource = source?.websiteUrl.replace(/\/$/, '') === tool.website_url.replace(/\/$/, '');
    const url = repositoryUrl(matchesSource ? source?.sourceCodeUrl : null) || repositoryUrl(tool.website_url);
    if (!url || seen.has(url.toLowerCase())) return [];
    seen.add(url.toLowerCase());
    const parsed = new URL(url);
    return [{
      id: tool.id, name: tool.name, slug: tool.slug,
      description: tool.short_description, categoryName: tool.category_name,
      categorySlug: tool.category_slug, repositoryUrl: url,
      repositoryPath: parsed.pathname.slice(1), host: parsed.hostname,
      licenses: matchesSource ? source!.softwareLicenses : [],
      tags: matchesSource ? source!.tags : [],
      sourceUrl: matchesSource ? source!.sourceUrl : null,
    }];
  });
  // No GitHub tokens, vendor requests, or invented live statistics required.
  res.json(repositories);
});

export default router;
