import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUpRight, BookOpen, Check, CheckCircle2, Layers3, ShieldCheck, Sparkles, WandSparkles, X } from 'lucide-react';
import { useListCategories, useListTools } from '@workspace/api-client-react';
import type { Tool } from '@workspace/api-client-react';
import { Shell, SearchBox, CategoryPill, ToolCard, LoadingGrid, QueryError, EmptyState, BrandMark } from '@/components/toolstack-ui';

const principles = [
  ['Useful over loud', 'We look for tools that solve a real problem clearly, not products that simply have the most noise around them.'],
  ['A page you can scan', 'Every listing explains what it is, how it works, who it helps, and what it costs before sending you elsewhere.'],
  ['The source stays close', 'Pricing and product details change. The official website is always one click away from the field note.'],
];

const tasks = [
  { label: 'Think through a hard problem', description: 'Research, write, and reason with more context.', category: 'ai-assistants' },
  { label: 'Design a product', description: 'Move from first sketch to shared decisions.', category: 'design' },
  { label: 'Sketch an idea', description: 'Make the rough version easy to change.', category: 'design' },
  { label: 'Move faster every day', description: 'Cut the repetitive steps from your workflow.', category: 'productivity' },
];

function toggleSelection(ids: number[], id: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  return ids.length < 3 ? [...ids, id] : ids;
}

export default function Home() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const categories = useListCategories();
  const tools = useListTools();
  const allTools = tools.data || [];
  const featured = useMemo(() => allTools.filter((tool) => tool.featured), [allTools]);
  const recent = useMemo(() => allTools.filter((tool) => !tool.featured), [allTools]);
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = allTools.filter((tool) => {
      const matchesSearch = !term || [tool.name, tool.shortDescription, tool.description, tool.bestFor, tool.categoryName].join(' ').toLowerCase().includes(term);
      const matchesCategory = !category || tool.categorySlug === category;
      return matchesSearch && matchesCategory;
    });
    return search || category ? filtered : recent;
  }, [allTools, category, recent, search]);
  const selectedTools = useMemo(() => compareIds.map((id) => allTools.find((tool) => tool.id === id)).filter(Boolean) as Tool[], [allTools, compareIds]);
  const stackTools = useMemo(() => allTools.filter((tool) => ['Claude', 'Figma', 'Raycast'].includes(tool.name)), [allTools]);
  const chooseTask = (task: typeof tasks[number]) => { setSearch(''); setCategory(task.category); document.getElementById('directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return <Shell><main className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
    <section className="relative overflow-hidden border-b border-border py-16 md:py-24">
      <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
        <div>
          <div className="mb-7 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary"><span className="h-1.5 w-1.5 bg-primary" /> A field guide for useful software</div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[.95] tracking-[-.08em] md:text-8xl">Make better choices <em className="font-serif font-normal text-primary">faster.</em></h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">Toolstack is a calm, visual index of software for making, thinking, shipping, and staying curious. Browse the shelves, compare the essentials, and leave with a tool that fits the work.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3"><a href="#directory" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Explore the directory <ArrowDown className="h-4 w-4" /></a><a href="#method" className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary">How it works <ArrowUpRight className="h-4 w-4" /></a></div>
        </div>
        <div className="border border-border bg-card p-5 md:p-7">
          <div className="flex items-start justify-between gap-4"><span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">The short version</span><Sparkles className="h-4 w-4 text-primary" /></div>
          <p className="mt-10 max-w-sm text-2xl font-medium leading-tight tracking-[-.04em]">Less browsing. More making.</p>
          <div className="mt-8 grid grid-cols-2 gap-px border border-border bg-border"><div className="bg-background p-4"><div className="font-mono text-2xl">01</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Browse by context</p></div><div className="bg-background p-4"><div className="font-mono text-2xl">02</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Choose with clarity</p></div></div>
        </div>
      </div>
    </section>

    <section className="border-b border-border py-10 md:py-14">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Start with the work</div><h2 className="mt-2 text-3xl font-semibold tracking-[-.06em] md:text-5xl">What are you trying to accomplish?</h2></div><p className="max-w-sm text-sm leading-6 text-muted-foreground">You do not need to know the category first. Start with the job, then narrow the decision.</p></div>
      <div className="mt-7 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">{tasks.map((task, index) => <button key={task.label} type="button" onClick={() => chooseTask(task)} className="group bg-background p-5 text-left transition-colors hover:bg-secondary"><span className="font-mono text-[10px] text-primary">0{index + 1}</span><h3 className="mt-8 text-base font-semibold tracking-[-.03em] group-hover:text-primary">{task.label}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{task.description}</p><span className="mt-5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Explore shelf <ArrowUpRight className="h-3 w-3" /></span></button>)}</div>
    </section>

    <section id="directory" className="scroll-mt-16 border-b border-border py-10 md:py-14">
      <div className="grid gap-7 md:grid-cols-[1fr_420px] md:items-end"><div><div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground"><Layers3 className="h-3.5 w-3.5" /> The directory</div><h2 className="text-3xl font-semibold tracking-[-.06em] md:text-5xl">Find your next tool.</h2></div><div><SearchBox value={search} onChange={setSearch} /><p className="mt-3 text-xs text-muted-foreground">Search by name, use case, or shelf.</p></div></div>
      <div className="mt-9 flex gap-5 overflow-x-auto border-y border-border py-4"><CategoryPill category={{ name: 'All tools' }} active={!category} onClick={() => setCategory('')} />{(categories.data || []).map((item) => <CategoryPill key={item.id} category={item} active={category === item.slug} onClick={() => setCategory(item.slug)} />)}</div>
      {tools.isLoading || categories.isLoading ? <section className="py-12"><LoadingGrid /></section> : tools.isError || categories.isError ? <section className="py-12"><QueryError retry={() => { tools.refetch(); categories.refetch(); }} /></section> : <div className="pt-10">
        {!search && !category && featured.length > 0 && <section><div className="mb-5 flex items-end justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">01 / Start here</div><h3 className="mt-2 text-2xl font-semibold tracking-[-.05em]">Editor’s picks</h3></div><span className="font-mono text-[10px] text-muted-foreground">{featured.length} selected</span></div><div className="grid gap-4 md:grid-cols-2">{featured.slice(0, 4).map((tool) => <ToolCard key={tool.id} tool={tool} featured />)}</div></section>}
         <section className={`${!search && !category && featured.length ? 'mt-14' : ''}`}><div className="mb-5 flex items-end justify-between"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground"><BookOpen className="h-3.5 w-3.5" /> {search || category ? 'Results' : 'The shelves'}</div><h3 className="mt-2 text-2xl font-semibold tracking-[-.05em]">{search || category ? `${shown.length} ${shown.length === 1 ? 'result' : 'results'}` : 'Browse the collection'}</h3></div><span className="font-mono text-[10px] text-muted-foreground">{allTools.length} indexed</span></div>{shown.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map((tool) => <ToolCard key={tool.id} tool={tool} compareSelected={compareIds.includes(tool.id)} onCompare={() => setCompareIds((ids) => toggleSelection(ids, tool.id))} />)}</div> : <EmptyState search={search} />}</section>
         {stackTools.length > 0 && !search && !category && <section className="mt-14"><div className="mb-5"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">A starting stack</div><h3 className="mt-2 text-2xl font-semibold tracking-[-.05em]">A calm stack for making things</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">One possible combination, not a universal winner: think with Claude, shape the idea in Figma, and keep the small actions moving with Raycast.</p></div><div className="grid gap-3 md:grid-cols-3">{stackTools.map((tool, index) => <button type="button" key={tool.id} onClick={() => setCompareIds((ids) => toggleSelection(ids, tool.id))} className="flex items-center gap-4 border border-border bg-card p-4 text-left transition-colors hover:border-primary"><span className="font-mono text-xs text-primary">0{index + 1}</span><div><div className="font-semibold">{tool.name}</div><div className="mt-1 text-xs text-muted-foreground">{tool.bestFor}</div></div></button>)}</div></section>}
      </div>}
    </section>

    <section id="method" className="scroll-mt-16 border-b border-border py-14 md:py-20"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground"><WandSparkles className="h-3.5 w-3.5" /> Why Toolstack</div><h2 className="mt-5 max-w-lg text-4xl font-semibold leading-tight tracking-[-.07em] md:text-6xl">A better starting point than another endless feed.</h2></div><div className="grid gap-px border border-border bg-border md:grid-cols-3">{principles.map(([title, body], index) => <div key={title} className="bg-background p-6"><span className="font-mono text-xs text-primary">0{index + 1}</span><h3 className="mt-12 text-lg font-semibold tracking-[-.04em]">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p></div>)}</div></div></section>

    <section className="grid gap-6 py-14 md:grid-cols-2 md:items-stretch md:py-20"><div className="border border-border bg-primary p-7 text-primary-foreground md:p-10"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary-foreground/60"><ShieldCheck className="h-3.5 w-3.5" /> Built for signal</div><h2 className="mt-12 max-w-md text-3xl font-semibold leading-tight tracking-[-.06em] md:text-5xl">A small index with enough context to trust.</h2><p className="mt-5 max-w-md text-sm leading-6 text-primary-foreground/70">Every listing is structured around the questions that matter: what it does, how it works, who it is for, and what to expect before you click through.</p></div><div className="flex flex-col justify-between border border-border p-7 md:p-10"><BrandMark /><div><p className="max-w-md text-2xl font-medium leading-tight tracking-[-.04em]">Good software should make the next step feel obvious.</p><div className="mt-7 flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Curated for clarity, not volume.</div></div></div></section>
   </main>{selectedTools.length > 0 && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-12px_35px_rgba(0,0,0,.15)] backdrop-blur md:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-sm"><span className="font-mono text-[10px] uppercase tracking-[.14em] text-primary">{selectedTools.length}/3 selected</span><span className="hidden text-muted-foreground sm:inline">·</span><span className="truncate text-muted-foreground">{selectedTools.map((tool) => tool.name).join(' · ')}</span></div><div className="flex gap-2"><button type="button" onClick={() => setCompareIds([])} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Clear</button><button type="button" disabled={selectedTools.length < 2} onClick={() => setCompareOpen(true)} className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">Compare tools <ArrowUpRight className="h-3.5 w-3.5" /></button></div></div></div>}{compareOpen && <ComparisonDialog tools={selectedTools} onClose={() => setCompareOpen(false)} />}</Shell>;
}

function ComparisonDialog({ tools, onClose }: { tools: Tool[]; onClose: () => void }) {
  const rows: Array<[string, (tool: Tool) => string]> = [['Category', (tool) => tool.categoryName], ['Pricing', (tool) => tool.pricing], ['Best for', (tool) => tool.bestFor || 'Not specified'], ['What it does', (tool) => tool.shortDescription]];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="compare-title"><div className="max-h-[90vh] w-full max-w-5xl overflow-auto border border-border bg-background p-5 shadow-2xl md:p-8"><div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Side by side</div><h2 id="compare-title" className="mt-2 text-3xl font-semibold tracking-[-.06em]">Compare the shortlist.</h2><p className="mt-2 text-sm text-muted-foreground">Facts and editorial context, without declaring a universal winner.</p></div><button type="button" onClick={onClose} aria-label="Close comparison" className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div><div className="mt-7 min-w-[620px] overflow-hidden border border-border"><div className="grid grid-cols-[140px_repeat(3,minmax(170px,1fr))] border-b border-border bg-secondary/50">{[<div key="label" className="p-3 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Decision point</div>, ...tools.map((tool) => <div key={tool.id} className="border-l border-border p-3 font-semibold">{tool.name}</div>) ]}</div>{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[140px_repeat(3,minmax(170px,1fr))] border-b border-border last:border-b-0"><div className="p-3 text-xs font-medium text-muted-foreground">{label}</div>{tools.map((tool) => <div key={tool.id} className="border-l border-border p-3 text-sm leading-5">{value(tool)}</div>)}</div>)}</div></div></div>;
}