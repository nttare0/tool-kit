import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Code2, Compass, Palette, Search, Sparkles, Zap } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useListCategories, useListTools } from '@workspace/api-client-react';
import { EmptyState, LoadingGrid, Logo, PreviewPanel, QueryError, Shell, ToolCard } from '@/components/toolstack-ui';

export default function Home() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [, navigate] = useLocation();
  const categories = useListCategories();
  const tools = useListTools();
  const allTools = tools.data || [];
  const picks = useMemo(() => [...allTools].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 6), [allTools]);
  const spotlight = picks[0];
  const visiblePicks = activeCategory ? allTools.filter((tool) => tool.categorySlug === activeCategory).slice(0, 6) : picks;
  const categoryIcons = [Sparkles, Palette, Code2, Zap, Compass];
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
    <section className="home-hero relative my-5 overflow-hidden rounded-2xl bg-[#182d26] text-[#f7f5eb] md:my-8">
      <div aria-hidden="true" className="home-hero-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative grid items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-12 lg:py-16">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.16em] text-[#d9e5bd]"><span className="h-1.5 w-1.5 rounded-full bg-[#d9ed92]" /> A directory for people who make things</div>
          <h1 className="text-[3.4rem] font-medium leading-[.98] tracking-[-.065em] sm:text-7xl lg:text-[5.4rem]">Your next<br />great tool<br /><span className="font-serif italic tracking-[-.04em] text-[#d9ed92]">is in here.</span></h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#c1cdc5]">Less tab-hopping. More making. Discover software that deserves a place in your workflow.</p>
          <form onSubmit={submitSearch} role="search" className="mt-8 flex items-center gap-2 rounded-lg bg-[#f7f5eb] p-2 text-[#182d26] shadow-xl focus-within:ring-2 focus-within:ring-[#d9ed92]">
            <Search aria-hidden="true" className="ml-2 h-5 w-5 shrink-0 opacity-60" />
            <label htmlFor="home-search" className="sr-only">Search tools by name or use case</label>
            <input id="home-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find your next tool…" className="h-10 min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-[#63756b]" />
            <button type="submit" aria-label="Search directory" className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#d9ed92] transition-colors hover:bg-[#c7df79]"><ArrowRight aria-hidden="true" className="h-5 w-5" /></button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[#b9c8bf]"><span>Explore</span>{(categories.data || []).slice(0, 3).map((category) => <Link key={category.id} href={`/directory?category=${encodeURIComponent(category.slug)}`} className="underline decoration-white/25 underline-offset-4 hover:text-[#d9ed92]">{category.name}</Link>)}</div>
        </div>
        <div className="relative min-w-0 lg:pl-2">
          <div aria-hidden="true" className="absolute -inset-5 rounded-full bg-[#d9ed92]/10 blur-3xl" />
          {tools.isLoading ? <div role="status" aria-label="Loading featured tool" className="relative h-80 animate-pulse rounded-xl border border-white/20 bg-white/5" /> : tools.isError ? <div className="relative rounded-xl border border-white/20 p-8"><p className="text-sm">The directory is taking a moment.</p><button onClick={() => void tools.refetch()} className="mt-4 text-sm underline underline-offset-4">Try again</button></div> : spotlight ? <Link href={`/tool/${spotlight.slug}`} className="home-spotlight group relative block overflow-hidden rounded-xl border border-white/20 bg-[#f7f5eb] text-[#182d26] shadow-[0_24px_70px_#0005] transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between border-b border-[#182d26]/10 px-5 py-4"><span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em]"><Sparkles className="h-3.5 w-3.5" /> In the spotlight</span><ArrowUpRight className="h-4 w-4" /></div>
            <div className="p-3"><PreviewPanel tool={spotlight} /></div>
            <div className="px-5 pb-6 pt-2"><div className="flex items-center gap-3"><Logo tool={spotlight} /><div><h2 className="text-2xl font-semibold tracking-[-.05em]">{spotlight.name}</h2><span className="text-[11px] text-[#52685b]">{spotlight.categoryName} / {spotlight.pricing}</span></div></div><p className="mt-4 text-sm leading-6 text-[#52685b]">{spotlight.shortDescription}</p></div>
          </Link> : <div className="relative rounded-xl border border-white/20 p-10"><Compass className="mb-5 h-10 w-10 text-[#d9ed92]" /><h2 className="text-3xl font-medium tracking-tight">A place for your next discovery.</h2><Link href="/directory" className="mt-6 inline-flex items-center gap-2 text-sm text-[#d9ed92]">Explore the directory <ArrowRight className="h-4 w-4" /></Link></div>}
          <div className="relative mt-5 flex items-center justify-between gap-4 px-1 font-mono text-[9px] uppercase tracking-[.13em] text-[#b9c8bf]"><span>Explore. Compare. Make it yours.</span>{tools.isSuccess && <span>{allTools.length} tools to explore</span>}</div>
        </div>
      </div>
    </section>

    <section aria-labelledby="categories-heading" className="border-b border-border py-8 md:py-10">
      <div className="mb-5 flex items-center justify-between gap-4"><h2 id="categories-heading" className="text-xl font-semibold tracking-[-.04em]">Find your focus</h2><Link href="/directory" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">View all <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
      {categories.isLoading ? <div role="status" aria-label="Loading categories" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((id) => <div key={id} className="h-24 animate-pulse rounded-md border border-border bg-card" />)}</div> : categories.isError ? <QueryError retry={() => { void categories.refetch(); }} /> : categories.data?.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{categories.data.map((category, index) => { const Icon = categoryIcons[index % categoryIcons.length]; return <Link key={category.id} href={`/directory?category=${encodeURIComponent(category.slug)}`} className="home-category group relative flex min-h-40 flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg"><div><Icon aria-hidden="true" className="mb-5 h-5 w-5 text-primary" /><h3 className="text-sm font-semibold">{category.name}</h3>{tools.isSuccess && <span className="mt-3 block font-mono text-[10px] text-muted-foreground">{categoryCounts.get(category.slug) || 0} {(categoryCounts.get(category.slug) || 0) === 1 ? 'tool' : 'tools'}</span>}</div><ArrowUpRight aria-hidden="true" className="absolute right-4 top-5 h-4 w-4 text-muted-foreground group-hover:text-primary" /></Link>; })}</div> : <p className="text-sm text-muted-foreground">Categories will appear as the directory grows.</p>}
    </section>

    <section aria-labelledby="tools-heading" className="py-9 md:py-12">
      <div className="mb-6 flex items-end justify-between gap-4"><div><h2 id="tools-heading" className="text-2xl font-semibold tracking-[-.05em] md:text-3xl">Meet your next favorite.</h2><p className="mt-2 text-sm text-muted-foreground">Useful software. The details that matter. All in one place.</p></div><Link href="/directory" className="inline-flex shrink-0 items-center gap-2 text-xs font-medium hover:text-primary">All tools <ArrowRight className="h-4 w-4" /></Link></div>
      <div role="group" aria-label="Filter tools by category" className="mb-7 flex flex-wrap gap-2"><button type="button" onClick={() => setActiveCategory('')} aria-pressed={!activeCategory} className={`rounded-full border px-4 py-2 text-xs transition-colors ${!activeCategory ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground'}`}>All tools</button>{(categories.data || []).map((category) => <button key={category.id} type="button" onClick={() => setActiveCategory(category.slug)} aria-pressed={activeCategory === category.slug} className={`rounded-full border px-4 py-2 text-xs transition-colors ${activeCategory === category.slug ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground'}`}>{category.name}</button>)}</div>
      {tools.isLoading ? <LoadingGrid /> : tools.isError ? <QueryError retry={() => { void tools.refetch(); }} /> : visiblePicks.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visiblePicks.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div> : <EmptyState />}
    </section>

    <section className="flex flex-col justify-between gap-6 rounded-2xl border border-border bg-[#e7eddc] p-7 text-[#182d26] sm:flex-row sm:items-center md:p-10"><div><h2 className="text-2xl font-semibold tracking-[-.04em] md:text-3xl">Good finds are better shared.</h2><p className="mt-2 text-sm text-[#52685b]">Know a tool worth sharing? Help someone find their next favorite.</p></div><Link href="/account" className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-md bg-[#182d26] px-5 py-3 text-sm font-medium text-[#f7f5eb] hover:bg-[#294a3c]">Suggest a tool <ArrowUpRight className="h-4 w-4" /></Link></section>
  </main></Shell>;
}
