import { useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, Layers3, X } from 'lucide-react';
import { useListCategories, useListTools } from '@workspace/api-client-react';
import type { Tool } from '@workspace/api-client-react';
import { Shell, SearchBox, CategoryPill, ToolCard, LoadingGrid, QueryError, EmptyState } from '@/components/toolstack-ui';

function toggleSelection(ids: number[], id: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  return ids.length < 3 ? [...ids, id] : ids;
}

export default function Directory() {
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '');
  const [category, setCategory] = useState(() => new URLSearchParams(window.location.search).get('category') || '');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const categories = useListCategories();
  const tools = useListTools();
  const allTools = tools.data || [];
  const featured = useMemo(() => allTools.filter((tool) => tool.featured), [allTools]);
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = allTools.filter((tool) => {
      const matchesSearch = !term || [tool.name, tool.shortDescription, tool.description, tool.bestFor, tool.categoryName].join(' ').toLowerCase().includes(term);
      const matchesCategory = !category || tool.categorySlug === category;
      return matchesSearch && matchesCategory;
    });
    return search || category ? filtered : allTools.filter((tool) => !tool.featured);
  }, [allTools, category, search]);
  const selectedTools = useMemo(() => compareIds.map((id) => allTools.find((tool) => tool.id === id)).filter(Boolean) as Tool[], [allTools, compareIds]);
  const stackTools = useMemo(() => allTools.filter((tool) => ['Claude', 'Figma', 'Raycast'].includes(tool.name)), [allTools]);

  return <Shell><main className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
    <section className="border-b border-border py-12 md:py-20">
      <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end"><div><div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary"><Layers3 className="h-3.5 w-3.5" /> The directory</div><h1 className="text-5xl font-semibold tracking-[-.08em] md:text-8xl">Find your next tool.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Search a small, visual index of software for making, thinking, shipping, and staying curious.</p></div><div><SearchBox value={search} onChange={setSearch} /><p className="mt-3 text-xs text-muted-foreground">Search by name, use case, or shelf.</p></div></div>
      <div className="mt-9 flex gap-5 overflow-x-auto border-y border-border py-4"><CategoryPill category={{ name: 'All tools' }} active={!category} onClick={() => setCategory('')} />{(categories.data || []).map((item) => <CategoryPill key={item.id} category={item} active={category === item.slug} onClick={() => setCategory(item.slug)} />)}</div>
    </section>

    {tools.isLoading || categories.isLoading ? <section className="py-12"><LoadingGrid /></section> : tools.isError || categories.isError ? <section className="py-12"><QueryError retry={() => { tools.refetch(); categories.refetch(); }} /></section> : <div className="pt-10">
      {!search && !category && featured.length > 0 && <section><div className="mb-5 flex items-end justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">01 / Start here</div><h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">Editor’s picks</h2></div><span className="font-mono text-[10px] text-muted-foreground">{featured.length} selected</span></div><div className="grid gap-4 md:grid-cols-2">{featured.slice(0, 4).map((tool) => <ToolCard key={tool.id} tool={tool} featured compareSelected={compareIds.includes(tool.id)} onCompare={() => setCompareIds((ids) => toggleSelection(ids, tool.id))} />)}</div></section>}
      <section className={`${!search && !category && featured.length ? 'mt-14' : ''}`}><div className="mb-5 flex items-end justify-between"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground"><BookOpen className="h-3.5 w-3.5" /> {search || category ? 'Results' : 'The shelves'}</div><h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">{search || category ? `${shown.length} ${shown.length === 1 ? 'result' : 'results'}` : 'Browse the collection'}</h2></div><span className="font-mono text-[10px] text-muted-foreground">{allTools.length} indexed</span></div>{shown.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map((tool) => <ToolCard key={tool.id} tool={tool} compareSelected={compareIds.includes(tool.id)} onCompare={() => setCompareIds((ids) => toggleSelection(ids, tool.id))} />)}</div> : <EmptyState search={search || category} />}</section>
      {stackTools.length > 0 && !search && !category && <section className="mt-14"><div className="mb-5"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">A starting stack</div><h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">A calm stack for making things</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">One possible combination, not a universal winner: think with Claude, shape the idea in Figma, and keep the small actions moving with Raycast.</p></div><div className="grid gap-3 md:grid-cols-3">{stackTools.map((tool, index) => <button type="button" key={tool.id} onClick={() => setCompareIds((ids) => toggleSelection(ids, tool.id))} className="flex items-center gap-4 border border-border bg-card p-4 text-left transition-colors hover:border-primary"><span className="font-mono text-xs text-primary">0{index + 1}</span><div><div className="font-semibold">{tool.name}</div><div className="mt-1 text-xs text-muted-foreground">{tool.bestFor}</div></div></button>)}</div></section>}
    </div>}
  </main>{selectedTools.length > 0 && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-12px_35px_rgba(0,0,0,.15)] backdrop-blur md:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm"><span className="font-mono text-[10px] uppercase tracking-[.14em] text-primary">{selectedTools.length}/3 selected</span><span className="hidden text-muted-foreground sm:inline">·</span><span className="truncate text-muted-foreground">{selectedTools.map((tool) => tool.name).join(' · ')}</span></div><div className="flex gap-2"><button type="button" onClick={() => setCompareIds([])} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Clear</button><button type="button" disabled={selectedTools.length < 2} onClick={() => setCompareOpen(true)} className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">Compare tools <ArrowUpRight className="h-3.5 w-3.5" /></button></div></div></div>}{compareOpen && <ComparisonDialog tools={selectedTools} onClose={() => setCompareOpen(false)} />}</Shell>;
}

function ComparisonDialog({ tools, onClose }: { tools: Tool[]; onClose: () => void }) {
  const rows: Array<[string, (tool: Tool) => string]> = [['Category', (tool) => tool.categoryName], ['Pricing', (tool) => tool.pricing], ['Best for', (tool) => tool.bestFor || 'Not specified'], ['What it does', (tool) => tool.shortDescription]];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="compare-title"><div className="max-h-[90vh] w-full max-w-5xl overflow-auto border border-border bg-background p-5 shadow-2xl md:p-8"><div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Side by side</div><h2 id="compare-title" className="mt-2 text-3xl font-semibold tracking-[-.06em]">Compare the shortlist.</h2><p className="mt-2 text-sm text-muted-foreground">Facts and editorial context, without declaring a universal winner.</p></div><button type="button" onClick={onClose} aria-label="Close comparison" className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div><div className="mt-7 min-w-[620px] overflow-hidden border border-border"><div className="grid grid-cols-[140px_repeat(3,minmax(170px,1fr))] border-b border-border bg-secondary/50">{[<div key="label" className="p-3 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Decision point</div>, ...tools.map((tool) => <div key={tool.id} className="border-l border-border p-3 font-semibold">{tool.name}</div>) ]}</div>{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[140px_repeat(3,minmax(170px,1fr))] border-b border-border last:border-b-0"><div className="p-3 text-xs font-medium text-muted-foreground">{label}</div>{tools.map((tool) => <div key={tool.id} className="border-l border-border p-3 text-sm leading-5">{value(tool)}</div>)}</div>)}</div></div></div>;
}