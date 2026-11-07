import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, Compass, Layers3, Search } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useListCategories, useListTools } from '@workspace/api-client-react';
import { EmptyState, LoadingGrid, QueryError, Shell, ToolCard } from '@/components/toolstack-ui';

export default function Home() {
  const [search, setSearch] = useState('');
  const [, navigate] = useLocation();
  const categories = useListCategories();
  const tools = useListTools();
  const allTools = tools.data || [];
  const picks = useMemo(() => [...allTools].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 6), [allTools]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of allTools) {
      if (tool.categorySlug) counts.set(tool.categorySlug, (counts.get(tool.categorySlug) || 0) + 1);
    }
    return counts;
  }, [allTools]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/directory?search=${encodeURIComponent(term)}` : '/directory');
  };

  return <Shell><main className="mx-auto max-w-7xl px-4 pb-6 md:px-8">
    <section className="relative overflow-hidden border-b border-border py-14 md:py-20 lg:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-[480px] w-[480px] rounded-full bg-primary/10 blur-[100px]" />
      <div className="relative grid gap-10 lg:grid-cols-[1.5fr_.65fr] lg:items-end lg:gap-16">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground"><Compass className="h-4 w-4 text-primary" /> Your software shortlist</div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-.065em] sm:text-6xl lg:text-7xl">Good tools.<br /><span className="text-muted-foreground">Less searching.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">Find software for the work you do. Explore the details, compare options, and save what fits.</p>
          <form onSubmit={submitSearch} role="search" className="mt-8 flex max-w-2xl items-center gap-2 rounded-lg border border-border bg-card p-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Search aria-hidden="true" className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
            <label htmlFor="home-search" className="sr-only">Search tools by name or use case</label>
            <input id="home-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="What do you want to do?" className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground" />
            <button type="submit" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">Search <ArrowRight aria-hidden="true" className="hidden h-4 w-4 sm:block" /></button>
          </form>
          <Link href="/directory" className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">Or browse all tools <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
        <aside className="border-l border-border pl-6 lg:mb-2 lg:pl-8">
          <div className="space-y-6">
            {[
              { icon: Compass, title: 'Discover', copy: 'Browse by category or search by use case.' },
              { icon: Layers3, title: 'Compare', copy: 'See pricing and features side by side.' },
              { icon: Bookmark, title: 'Keep', copy: 'Save tools to your own collections.' },
            ].map(({ icon: Icon, title, copy }) => <div key={title} className="flex gap-3"><Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p></div></div>)}
          </div>
        </aside>
      </div>
    </section>

    <section aria-labelledby="categories-heading" className="border-b border-border py-9 md:py-12">
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id="categories-heading" className="text-xl font-semibold tracking-[-.04em]">Browse by category</h2><Link href="/directory" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">View all <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
      {categories.isLoading ? <div role="status" aria-label="Loading categories" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((id) => <div key={id} className="h-24 animate-pulse rounded-md border border-border bg-card" />)}</div> : categories.isError ? <QueryError retry={() => { void categories.refetch(); }} /> : categories.data?.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{categories.data.map((category) => <Link key={category.id} href={`/directory?category=${encodeURIComponent(category.slug)}`} className="group flex items-start justify-between gap-3 rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-secondary/50"><div><h3 className="text-sm font-semibold">{category.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{category.description}</p>{tools.isSuccess && <span className="mt-3 block font-mono text-[10px] text-muted-foreground">{categoryCounts.get(category.slug) || 0} {(categoryCounts.get(category.slug) || 0) === 1 ? 'tool' : 'tools'}</span>}</div><ArrowUpRight aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" /></Link>)}</div> : <p className="text-sm text-muted-foreground">Categories will appear as the directory grows.</p>}
    </section>

    <section aria-labelledby="tools-heading" className="py-9 md:py-12">
      <div className="mb-6 flex items-end justify-between gap-4"><div><h2 id="tools-heading" className="text-2xl font-semibold tracking-[-.05em] md:text-3xl">Worth a look</h2><p className="mt-2 text-sm text-muted-foreground">A starting point for your next shortlist.</p></div><Link href="/directory" className="inline-flex shrink-0 items-center gap-2 text-xs font-medium hover:text-primary">All tools <ArrowRight className="h-4 w-4" /></Link></div>
      {tools.isLoading ? <LoadingGrid /> : tools.isError ? <QueryError retry={() => { void tools.refetch(); }} /> : picks.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{picks.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div> : <EmptyState />}
    </section>

    <section className="flex flex-col justify-between gap-5 rounded-lg border border-border bg-secondary/40 p-6 sm:flex-row sm:items-center md:p-8"><div><h2 className="text-lg font-semibold tracking-[-.03em]">Missing a useful tool?</h2><p className="mt-1 text-sm text-muted-foreground">Suggest it for the directory. Every submission is reviewed.</p></div><Link href="/account" className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:border-primary">Suggest a tool <ArrowUpRight className="h-4 w-4" /></Link></section>
  </main></Shell>;
}
