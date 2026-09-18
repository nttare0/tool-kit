import { ArrowUpRight, Check, ExternalLink, Moon, Search, Sparkles, Sun } from 'lucide-react';
import { Link } from 'wouter';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Category, Tool } from '@workspace/api-client-react';

export function BrandMark() {
  return <Link href="/" data-testid="link-brand" className="group inline-flex items-center gap-2.5">
    <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-md border border-border bg-white transition-transform group-hover:-rotate-6"><img src="/toolstack-mark.png" alt="" className="h-full w-full object-cover dark:invert dark:mix-blend-screen" /></span>
    <span className="text-base font-semibold tracking-[-0.05em]">tool<span className="text-primary">stack</span></span>
  </Link>;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('toolstack-theme');
    const next = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', next);
    setDark(next);
  }, []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('toolstack-theme', next ? 'dark' : 'light');
    setDark(next);
  };
  return <button type="button" onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">{dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}</button>;
}

export function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-[100dvh] bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-8">
        <BrandMark />
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/" data-testid="link-discover" className="rounded px-2.5 py-1.5 transition-colors hover:bg-secondary hover:text-foreground">Discover</Link>
          <span className="hidden font-mono text-[10px] text-border sm:block">/</span>
          <span className="hidden px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground sm:block">Field guide for useful software</span>
          <ThemeToggle />
        </nav>
      </div>
    </header>
    {children}
    <footer className="mx-auto mt-16 max-w-7xl border-t border-border px-4 py-8 text-xs text-muted-foreground md:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><span className="font-mono text-[10px] uppercase tracking-[.16em]">Toolstack / a calm place to choose</span><p className="mt-2 text-muted-foreground/70">Useful things, carefully kept.</p></div>
        <div className="flex flex-wrap items-center gap-4"><Link href="/terms" className="hover:text-foreground">Terms</Link><Link href="/privacy" className="hover:text-foreground">Privacy</Link><Link href="/admin" data-testid="link-admin-footer" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground transition-colors hover:text-primary">Admin access <ArrowUpRight className="h-3 w-3" /></Link></div>
      </div>
    </footer>
  </div>;
}

function Preview({ tool, className = '' }: { tool: Tool; className?: string }) {
  return <div className={`relative h-full w-full bg-[radial-gradient(circle_at_85%_15%,rgba(216,255,99,.28),transparent_30%),linear-gradient(135deg,#24271d,#11130f_65%)] ${className}`}>
    <div className="flex h-full w-full items-end justify-between p-5"><span className="font-serif text-6xl leading-none text-primary/80">{tool.name.slice(0, 1)}</span><span className="font-mono text-[9px] uppercase tracking-[.18em] text-foreground/45">preview unavailable</span></div>
    {tool.previewUrl && <img src={tool.previewUrl} alt={`${tool.name} website preview`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
  </div>;
}

export function Logo({ tool, size = 'md' }: { tool: Tool; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'h-16 w-16 text-2xl' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-base';
  const logoUrl = tool.logoUrl || `https://www.google.com/s2/favicons?domain=${encodeURIComponent(tool.websiteUrl)}&sz=64`;
  return <img src={logoUrl} alt={`${tool.name} logo`} className={`${cls} rounded-sm border border-border bg-secondary object-contain p-1`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />;
}

export function CategoryPill({ category, active, onClick }: { category: Category | { name: string; accent?: string }; active?: boolean; onClick?: () => void }) {
  const style = { '--pill-accent': category.accent || '#e8a33d' } as CSSProperties;
  return <button type="button" onClick={onClick} data-testid={`button-category-${category.name.toLowerCase().replace(/\s+/g, '-')}`} className={`whitespace-nowrap border-b-2 px-1 pb-2 text-xs transition-all ${active ? 'border-[var(--pill-accent)] text-foreground' : 'border-transparent text-muted-foreground hover:border-[var(--pill-accent)]/50 hover:text-foreground'}`} style={style}>{category.name}</button>;
}

export function ToolCard({ tool, featured = false, compareSelected = false, onCompare }: { tool: Tool; featured?: boolean; compareSelected?: boolean; onCompare?: () => void }) {
  return <article className={`group relative overflow-hidden border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-[0_18px_45px_rgba(0,0,0,.22)] ${featured ? 'md:grid md:grid-cols-[1.35fr_1fr]' : ''} ${compareSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
    <Link href={`/tool/${tool.slug}`} data-testid={`card-tool-${tool.id}`} className="block">
      <div className={`relative overflow-hidden bg-secondary ${featured ? 'aspect-[16/10] md:aspect-auto md:min-h-[250px]' : 'aspect-[16/10]'}`}><Preview tool={tool} /></div>
      <div className={`flex flex-col justify-between p-4 ${featured ? 'md:p-6' : ''}`}>
        <div><div className="flex items-center justify-between gap-3"><span className="font-mono text-[10px] uppercase tracking-[.12em] text-accent">{tool.categoryName}</span><span className="font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">{tool.pricing}</span></div><h3 className={`${featured ? 'mt-8 text-2xl' : 'mt-5 text-lg'} font-semibold tracking-[-.05em]`}>{tool.name}</h3><p className="mt-2 max-w-[36ch] text-sm leading-6 text-muted-foreground">{tool.shortDescription}</p></div>
        <div className="mt-8 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground"><span>{tool.featured ? 'Editor’s pick' : 'Open field note'}</span><ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" /></div>
      </div>
    </Link>
    {onCompare && <button type="button" onClick={onCompare} aria-pressed={compareSelected} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 border border-border bg-background/95 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground transition-colors hover:border-primary hover:text-foreground">{compareSelected ? <Check className="h-3 w-3 text-primary" /> : null}{compareSelected ? 'Added' : 'Compare'}</button>}
  </article>;
}

export function PreviewPanel({ tool }: { tool: Tool }) {
  return <div className="group relative aspect-[16/10] overflow-hidden border border-border bg-secondary"><Preview tool={tool} /><div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" /><span className="absolute bottom-3 left-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.14em] text-white/80"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Tool preview</span></div>;
}

export function SearchBox({ value, onChange, compact = false }: { value: string; onChange: (value: string) => void; compact?: boolean }) {
  return <label className="relative block w-full"><span className="sr-only">Search tools</span><Search className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ${compact ? 'h-3.5 w-3.5' : ''}`} /><input data-testid="input-search-tools" type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search tools…" className={`${compact ? 'h-9 text-xs' : 'h-12 text-sm'} w-full border border-border bg-card pl-10 pr-4 font-mono text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20`} /></label>;
}

export function LoadingGrid() { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-72 animate-pulse border border-border bg-card/70" />)}</div>; }
export function QueryError({ retry }: { retry: () => void }) { return <div className="border border-destructive/40 bg-destructive/5 p-10 text-center"><Sparkles className="mx-auto h-7 w-7 text-destructive" /><h2 className="mt-4 text-xl font-semibold">The shelf is out of reach.</h2><p className="mt-2 text-sm text-muted-foreground">We could not load this field guide right now.</p><button type="button" data-testid="button-retry" onClick={retry} className="mt-5 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button></div>; }
export function EmptyState({ search }: { search?: string }) { return <div className="border border-dashed border-border bg-card/50 px-6 py-16 text-center"><span className="font-mono text-xs uppercase tracking-[.2em] text-primary">No match</span><h2 className="mt-3 text-2xl font-semibold tracking-[-.04em]">{search ? `Nothing found for “${search}”` : 'This shelf is still open.'}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Try another phrase or explore a different category.</p></div>; }
export function VisitButton({ url }: { url: string }) { return <a href={url} target="_blank" rel="noreferrer" data-testid="link-visit-tool" className="inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background">Visit website <ExternalLink className="h-4 w-4" /></a>; }