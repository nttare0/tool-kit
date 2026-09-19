import { ArrowRight, ArrowUpRight, CheckCircle2, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { Link } from 'wouter';
import { BrandMark, Shell } from '@/components/toolstack-ui';

const tasks = [
  { label: 'Think through a hard problem', description: 'Research, write, and reason with more context.', category: 'ai-assistants' },
  { label: 'Design a product', description: 'Move from first sketch to shared decisions.', category: 'design' },
  { label: 'Sketch an idea', description: 'Make the rough version easy to change.', category: 'design' },
  { label: 'Move faster every day', description: 'Cut the repetitive steps from your workflow.', category: 'productivity' },
];

const principles = [
  ['Useful over loud', 'We look for tools that solve a real problem clearly, not products that simply have the most noise around them.'],
  ['A page you can scan', 'Every listing explains what it is, how it works, who it helps, and what it costs before sending you elsewhere.'],
  ['The source stays close', 'Pricing and product details change. The official website is always one click away from the field note.'],
];

export default function Home() {
  return <Shell><main className="mx-auto max-w-7xl px-4 pb-10 md:px-8">
    <section className="relative overflow-hidden border-b border-border py-16 md:py-24">
      <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
        <div>
          <div className="mb-7 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary"><span className="h-1.5 w-1.5 bg-primary" /> A field guide for useful software</div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[.95] tracking-[-.08em] md:text-8xl">Find the tools worth using.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">Toolstack helps you discover, compare, and choose software for the work you actually want to get done.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3"><Link href="/directory" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Explore the directory <ArrowRight className="h-4 w-4" /></Link><a href="#method" className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium transition-colors hover:bg-secondary">How it works <ArrowUpRight className="h-4 w-4" /></a></div>
        </div>
        <div className="border border-border bg-card p-5 md:p-7">
          <div className="flex items-start justify-between gap-4"><span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">The short version</span><Sparkles className="h-4 w-4 text-primary" /></div>
          <p className="mt-10 max-w-sm text-2xl font-medium leading-tight tracking-[-.04em]">Less browsing. Better software decisions.</p>
          <div className="mt-8 grid grid-cols-2 gap-px border border-border bg-border"><div className="bg-background p-4"><div className="font-mono text-2xl">01</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Start with the work</p></div><div className="bg-background p-4"><div className="font-mono text-2xl">02</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Choose with context</p></div></div>
        </div>
      </div>
    </section>

    <section className="border-b border-border py-10 md:py-14">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Start with the work</div><h2 className="mt-2 text-3xl font-semibold tracking-[-.06em] md:text-5xl">What are you trying to accomplish?</h2></div><p className="max-w-sm text-sm leading-6 text-muted-foreground">You do not need to know the category first. Start with the job, then narrow the decision.</p></div>
      <div className="mt-7 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">{tasks.map((task, index) => <Link key={task.label} href={`/directory?category=${task.category}`} className="group bg-background p-5 text-left transition-colors hover:bg-secondary"><span className="font-mono text-[10px] text-primary">0{index + 1}</span><h3 className="mt-8 text-base font-semibold tracking-[-.03em] group-hover:text-primary">{task.label}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{task.description}</p><span className="mt-5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Explore shelf <ArrowUpRight className="h-3 w-3" /></span></Link>)}</div>
    </section>

    <section id="method" className="scroll-mt-16 border-b border-border py-14 md:py-20"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr]"><div><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground"><WandSparkles className="h-3.5 w-3.5" /> Why Toolstack</div><h2 className="mt-5 max-w-lg text-4xl font-semibold leading-tight tracking-[-.07em] md:text-6xl">A better starting point than another endless feed.</h2></div><div className="grid gap-px border border-border bg-border md:grid-cols-3">{principles.map(([title, body], index) => <div key={title} className="bg-background p-6"><span className="font-mono text-xs text-primary">0{index + 1}</span><h3 className="mt-12 text-lg font-semibold tracking-[-.04em]">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p></div>)}</div></div></section>

    <section className="grid gap-6 py-14 md:grid-cols-2 md:items-stretch md:py-20"><div className="border border-border bg-primary p-7 text-primary-foreground md:p-10"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-primary-foreground/60"><ShieldCheck className="h-3.5 w-3.5" /> Built for signal</div><h2 className="mt-12 max-w-md text-3xl font-semibold leading-tight tracking-[-.06em] md:text-5xl">A small index with enough context to trust.</h2><p className="mt-5 max-w-md text-sm leading-6 text-primary-foreground/70">Every listing is structured around the questions that matter: what it does, how it works, who it is for, and what to expect before you click through.</p></div><div className="flex flex-col justify-between border border-border p-7 md:p-10"><BrandMark /><div><p className="max-w-md text-2xl font-medium leading-tight tracking-[-.04em]">Good software should make the next step feel obvious.</p><div className="mt-7 flex items-center gap-3 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Curated for clarity, not volume.</div></div></div></section>
  </main></Shell>;
}