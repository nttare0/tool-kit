import { ArrowRight, Layers3, Search, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { Shell } from '@/components/toolstack-ui';

function ToolMap() {
  return <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[390px] [perspective:900px]">
    <div className="absolute inset-[8%] rotate-[-12deg] rounded-full border border-primary/20 [transform:rotateX(60deg)_rotateZ(-20deg)]" />
    <div className="absolute inset-[19%] rotate-[18deg] rounded-full border border-primary/30 [transform:rotateX(60deg)_rotateZ(35deg)]" />
    <div className="absolute inset-[30%] rotate-[-25deg] rounded-full border border-border [transform:rotateX(60deg)_rotateZ(-48deg)]" />
    <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full [transform:rotateX(60deg)_rotateZ(-20deg)]">
      <g fill="none" stroke="currentColor" strokeOpacity=".32" strokeWidth="1">
        <path d="M78 129 154 78 236 119 317 81M78 129l61 95 97-105 69 90M139 224l86 74 80-99M154 78l-15 146M236 119l-11 179M317 81l-11 138" />
      </g>
      <g fill="currentColor">
        <circle cx="78" cy="129" r="4" /><circle cx="154" cy="78" r="3" /><circle cx="236" cy="119" r="5" />
        <circle cx="317" cy="81" r="3" /><circle cx="139" cy="224" r="4" /><circle cx="306" cy="219" r="5" />
        <circle cx="225" cy="298" r="3" />
      </g>
      <circle cx="236" cy="119" r="15" fill="currentColor" fillOpacity=".12" />
    </svg>
    <div className="absolute left-[48%] top-[31%] grid h-14 w-14 place-items-center rounded-xl border border-primary/35 bg-background/90 text-primary shadow-[0_12px_40px_rgba(0,0,0,.18)] backdrop-blur"><Layers3 className="h-6 w-6" /></div>
    <div className="absolute left-[6%] top-[34%] flex items-center gap-2 border border-border bg-background/90 px-3 py-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground shadow-lg backdrop-blur"><Search className="h-3 w-3 text-primary" /> find</div>
    <div className="absolute bottom-[14%] right-[2%] flex items-center gap-2 border border-border bg-background/90 px-3 py-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground shadow-lg backdrop-blur"><Sparkles className="h-3 w-3 text-primary" /> compare</div>
  </div>;
}

export default function Home() {
  return <Shell><main className="mx-auto max-w-7xl px-4 pb-8 md:px-8">
    <section className="relative grid min-h-[520px] items-center gap-8 overflow-hidden border-b border-border py-14 lg:grid-cols-[1.08fr_.92fr] lg:py-16">
      <div className="pointer-events-none absolute -left-48 top-1/3 h-96 w-96 rounded-full bg-primary/10 blur-[110px]" />
      <div className="relative z-10">
        <h1 className="max-w-3xl text-5xl font-semibold leading-[.97] tracking-[-.075em] sm:text-6xl lg:text-[5.6rem]">Find software.<br /><span className="text-muted-foreground">Build your stack.</span></h1>
        <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">Browse tools by category, compare features and pricing, and save your favorites.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/directory" className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Explore the directory <ArrowRight className="h-4 w-4" /></Link></div>

      </div>
      <div className="relative"><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(216,255,99,.09),transparent_65%)]" /><ToolMap /></div>
    </section>
  </main></Shell>;
}
