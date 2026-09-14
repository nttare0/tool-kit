import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, Layers3 } from 'lucide-react';
import { useListCategories, useListTools } from '@workspace/api-client-react';
import { Shell, SearchBox, CategoryPill, ToolCard, LoadingGrid, QueryError, EmptyState } from '@/components/toolstack-ui';

export default function Home() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const categories = useListCategories();
  const tools = useListTools({ search: search || undefined, category: category || undefined });
  const allTools = tools.data || [];
  const featured = useMemo(() => allTools.filter((tool) => tool.featured), [allTools]);
  const recent = useMemo(() => allTools.filter((tool) => !tool.featured), [allTools]);
  const shown = search || category ? allTools : recent;

  return <Shell><main className="mx-auto max-w-7xl px-4 pb-8 md:px-8">
    <section className="relative grid gap-8 border-b border-border py-12 md:grid-cols-[1fr_330px] md:py-16">
      <div><div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary"><span className="h-1.5 w-1.5 bg-primary" /> Curated tools directory</div><h1 className="max-w-3xl text-5xl font-semibold leading-[.96] tracking-[-.075em] md:text-7xl">Find something <em className="font-serif font-normal text-primary">useful.</em></h1><p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">A quiet, visual index of software for making, thinking, shipping, and staying curious. Browse by shelf or search by what you need.</p></div>
      <div className="self-end"><div className="mb-2 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Search the index</div><SearchBox value={search} onChange={setSearch} /><a href="#catalog" className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary">Browse all tools <ArrowDown className="h-3.5 w-3.5" /></a></div>
    </section>
    <section id="catalog" className="sticky top-14 z-30 -mx-4 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-xl md:-mx-8 md:px-8"><div className="flex gap-5 overflow-x-auto"><CategoryPill category={{ name: 'All tools' }} active={!category} onClick={() => setCategory('')} />{(categories.data || []).map((item) => <CategoryPill key={item.id} category={item} active={category === item.slug} onClick={() => setCategory(item.slug)} />)}</div></section>
    {tools.isLoading || categories.isLoading ? <section className="py-12"><LoadingGrid /></section> : tools.isError || categories.isError ? <section className="py-12"><QueryError retry={() => { tools.refetch(); categories.refetch(); }} /></section> : <div className="py-10">
      {!search && !category && featured.length > 0 && <section><div className="mb-5 flex items-end justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">01 / Start here</div><h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">Editor’s picks</h2></div><span className="font-mono text-[10px] text-muted-foreground">{featured.length} selected</span></div><div className="grid gap-4 md:grid-cols-2">{featured.slice(0, 4).map((tool) => <ToolCard key={tool.id} tool={tool} featured />)}</div></section>}
      <section className={`${!search && !category && featured.length ? 'mt-14' : ''}`}><div className="mb-5 flex items-end justify-between"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-accent"><Layers3 className="h-3.5 w-3.5" /> {search || category ? 'Results' : 'The directory'}</div><h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">{search || category ? `${shown.length} ${shown.length === 1 ? 'result' : 'results'}` : 'Browse the shelves'}</h2></div><span className="font-mono text-[10px] text-muted-foreground">{allTools.length} indexed</span></div>{shown.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map((tool) => <ToolCard key={tool.id} tool={tool} />)}</div> : <EmptyState search={search} />}</section>
    </div>}
    <section className="mt-6 flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground"><span>Choose by context, not by hype.</span><span className="font-mono text-[10px]">TOOLSTACK / 01 <ArrowUpRight className="ml-1 inline h-3 w-3" /></span></section>
  </main></Shell>;
}