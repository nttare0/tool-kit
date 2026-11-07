import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Code2, GitBranch, Search, X } from 'lucide-react';
import { Link } from 'wouter';
import { LoadingGrid, QueryError, Shell } from '@/components/toolstack-ui';

type Repository = {
  id: number; name: string; slug: string; description: string;
  categoryName: string; categorySlug: string; repositoryUrl: string;
  repositoryPath: string; host: string; licenses: string[]; tags: string[];
  sourceUrl: string | null;
};

export default function Repositories() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [host, setHost] = useState('');
  const [limit, setLimit] = useState(24);
  const query = useQuery<Repository[]>({
    queryKey: ['repositories'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/repositories', { signal });
      if (!response.ok) throw new Error('Could not load repositories.');
      return response.json();
    },
    staleTime: 60_000,
  });
  const repositories = query.data || [];
  const categories = useMemo(() => [...new Map(repositories.map((repo) => [repo.categorySlug, repo.categoryName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [repositories]);
  const hosts = useMemo(() => [...new Set(repositories.map((repo) => repo.host))].sort(), [repositories]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return repositories.filter((repo) => (!category || repo.categorySlug === category)
      && (!host || repo.host === host)
      && (!term || [repo.name, repo.description, repo.repositoryPath, ...repo.tags, ...repo.licenses].join(' ').toLowerCase().includes(term)));
  }, [repositories, search, category, host]);
  useEffect(() => setLimit(24), [search, category, host]);
  const clear = () => { setSearch(''); setCategory(''); setHost(''); };

  return <Shell><main className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
    <section className="relative my-6 overflow-hidden rounded-2xl bg-[#182d26] px-6 py-10 text-[#f7f5eb] md:my-8 md:px-10 md:py-14">
      <div aria-hidden="true" className="home-hero-grid pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <div><div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#d9ed92]"><GitBranch className="h-4 w-4" /> The source, not just the software</div><h1 className="text-4xl font-medium tracking-[-.055em] sm:text-6xl">Explore the <span className="font-serif italic text-[#d9ed92]">repositories.</span></h1><p className="mt-5 max-w-xl text-sm leading-7 text-[#c1cdc5]">Find source code for tools in the directory. Browse projects, read the docs, or make your first contribution.</p></div>
        <div className="flex items-center gap-3 border-l border-white/20 pl-5"><Code2 aria-hidden="true" className="h-7 w-7 text-[#d9ed92]" /><div><div className="text-2xl font-semibold">{query.isSuccess ? repositories.length.toLocaleString() : '—'}</div><div className="mt-1 text-xs text-[#c1cdc5]">linked repositories</div></div></div>
      </div>
    </section>

    <section aria-label="Find repositories" className="mb-8 grid gap-3 md:grid-cols-[1fr_220px_170px]">
      <label className="relative"><span className="sr-only">Search repositories, topics, or licenses</span><Search aria-hidden="true" className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects, topics, or licenses…" className="h-12 w-full rounded-md border border-border bg-card pl-11 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>
      <label><span className="sr-only">Filter by category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-12 w-full rounded-md border border-border bg-card px-3 text-sm focus:ring-2 focus:ring-primary"><option value="">All categories</option>{categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select></label>
      <label><span className="sr-only">Filter by repository host</span><select value={host} onChange={(event) => setHost(event.target.value)} className="h-12 w-full rounded-md border border-border bg-card px-3 text-sm focus:ring-2 focus:ring-primary"><option value="">All hosts</option>{hosts.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    </section>

    {query.isLoading ? <LoadingGrid /> : query.isError ? <QueryError retry={() => { void query.refetch(); }} /> : <>
      <div className="mb-5 flex items-center justify-between gap-4"><p role="status" className="text-xs text-muted-foreground">{filtered.length.toLocaleString()} {filtered.length === 1 ? 'repository' : 'repositories'}{search || category || host ? ' found' : ' in the directory'}</p>{(search || category || host) && <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs hover:text-primary"><X className="h-3 w-3" /> Clear filters</button>}</div>
      {filtered.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.slice(0, limit).map((repo) => <article key={repo.id} className="group flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/60">
        <div className="flex items-center justify-between gap-3"><span className="rounded border border-border bg-secondary/50 px-2 py-1 text-[10px] text-muted-foreground">{repo.host}</span><GitBranch aria-hidden="true" className="h-4 w-4 text-primary" /></div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight"><a href={repo.repositoryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-primary">{repo.name}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></a></h2>
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{repo.repositoryPath}</p>
        <p className="mb-5 mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{repo.description}</p>
        <div className="mt-auto flex flex-wrap gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] text-primary">{repo.categoryName}</span>{repo.licenses.map((license) => <span key={license} className="rounded-full border border-border px-2.5 py-1 text-[10px] text-muted-foreground">{license}</span>)}</div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-xs"><Link href={`/tool/${repo.slug}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">Tool details <ArrowRight className="h-3 w-3" /></Link><a href={repo.repositoryUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${repo.name} repository`} className="inline-flex items-center gap-1 font-medium hover:text-primary">View code <ArrowUpRight className="h-3.5 w-3.5" /></a></div>
      </article>)}</div> : <div className="rounded-xl border border-dashed border-border p-12 text-center"><Code2 className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 text-xl font-semibold">{repositories.length ? 'No matching repositories' : 'No repositories yet'}</h2><p className="mt-2 text-sm text-muted-foreground">{repositories.length ? 'Try another search or clear the filters.' : 'Projects with recorded source-code links will appear here.'}</p></div>}
      {filtered.length > 0 && <div className="mt-8 flex flex-col items-center gap-4"><p className="text-xs text-muted-foreground">Showing {Math.min(limit, filtered.length)} of {filtered.length.toLocaleString()}</p>{limit < filtered.length && <button type="button" onClick={() => setLimit((value) => value + 24)} className="rounded-md border border-border bg-card px-6 py-3 text-sm font-medium hover:border-primary">Load more repositories</button>}</div>}
    </>}
    <p className="mt-10 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">Repository links and software licenses come from the catalog snapshot, not a live hosting API. Check the project for current licensing and maintenance. <Link href="/credits" className="underline underline-offset-4 hover:text-primary">Source credits</Link></p>
  </main></Shell>;
}
