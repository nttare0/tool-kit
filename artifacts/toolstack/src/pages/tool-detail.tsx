import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock3, ExternalLink, Hash, Heart, Users } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { useListTools } from '@workspace/api-client-react';
import { EmptyState, LoadingGrid, Logo, PreviewPanel, QueryError, Shell, VisitButton } from '@/components/toolstack-ui';

export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const query = useListTools();
  const [member, setMember] = useState(false);
  const [saved, setSaved] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [favoriteError, setFavoriteError] = useState('');
  const tool = useMemo(() => query.data?.find((item) => item.slug === slug), [query.data, slug]);
  useEffect(() => {
    let active = true;
    fetch('/api/auth/user/status', { credentials: 'include' })
      .then((response) => response.json())
      .then(async (status: { user?: unknown }) => {
        if (!active) return;
        const signedIn = Boolean(status.user);
        setMember(signedIn);
        if (signedIn) {
          const favoritesResponse = await fetch('/api/account/favorites', { credentials: 'include' });
          if (favoritesResponse.ok) {
            const favorites = await favoritesResponse.json() as Array<{ id: number }>;
            if (active && tool) setSaved(favorites.some((item) => item.id === tool.id));
          }
        } else setSaved(false);
      })
      .catch(() => { if (active) setMember(false); });
    return () => { active = false; };
  }, [tool?.id]);
  const toggleFavorite = async () => {
    if (!tool || !member || favoriteBusy) return;
    setFavoriteBusy(true);
    setFavoriteError('');
    try {
      const response = await fetch(`/api/account/favorites/${tool.id}`, {
        method: saved ? 'DELETE' : 'PUT',
        credentials: 'include',
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Could not update favorites.');
      }
      setSaved(!saved);
    } catch (error) {
      setFavoriteError(error instanceof Error ? error.message : 'Could not update favorites.');
    } finally {
      setFavoriteBusy(false);
    }
  };
  const related = useMemo(() => {
    if (!query.data || !tool) return [];
    const terms = (value: string) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
    const sourceTerms = terms(`${tool.howItWorks} ${tool.bestFor} ${tool.description}`);
    return query.data
      .filter((item) => item.id !== tool.id)
      .map((item) => {
        const itemTerms = terms(`${item.howItWorks} ${item.bestFor} ${item.description}`);
        const overlap = [...sourceTerms].reduce((score, word) => score + Number(itemTerms.has(word)), 0);
        return { item, score: overlap + Number(item.categoryId === tool.categoryId) };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || Number(b.item.featured) - Number(a.item.featured))
      .slice(0, 3)
      .map(({ item }) => item);
  }, [query.data, tool]);
  if (query.isLoading) return <Shell><main className="mx-auto max-w-7xl px-4 py-12 md:px-8"><LoadingGrid /></main></Shell>;
  if (query.isError) return <Shell><main className="mx-auto max-w-3xl px-4 py-20 md:px-8"><QueryError retry={() => query.refetch()} /></main></Shell>;
  if (!tool) return <Shell><main className="mx-auto max-w-3xl px-4 py-20 md:px-8"><EmptyState search={slug} /></main></Shell>;
  return <Shell><main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
     <Link href="/directory" data-testid="link-back-home" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground transition-colors hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> Back to directory</Link>
     <section className="mt-8 grid gap-10 border-b border-border pb-12 lg:grid-cols-[1fr_420px] lg:items-start"><div><div className="flex items-center gap-3"><Logo tool={tool} size="lg" /><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-accent">{tool.categoryName}</div><h1 data-testid={`text-tool-name-${tool.id}`} className="mt-1 text-5xl font-semibold tracking-[-.075em] md:text-7xl">{tool.name}</h1></div></div><p className="mt-7 max-w-2xl text-xl leading-8 text-muted-foreground">{tool.shortDescription}</p><div className="mt-7 flex flex-wrap items-center gap-3"><VisitButton url={tool.websiteUrl} /><span className="flex items-center gap-2 border border-border px-4 py-3 font-mono text-xs text-muted-foreground"><Clock3 className="h-4 w-4 text-primary" /> {tool.pricing}</span>{member ? <button type="button" onClick={() => void toggleFavorite()} disabled={favoriteBusy} aria-pressed={saved} className={`inline-flex items-center gap-2 border px-4 py-3 text-xs font-medium transition-colors ${saved ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'}`}><Heart className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save tool'}</button> : <Link href="/account" className="inline-flex items-center gap-2 border border-border px-4 py-3 text-xs font-medium text-muted-foreground hover:border-primary hover:text-foreground"><Heart className="h-4 w-4" /> Sign in to save</Link>}</div>{favoriteError && <p role="alert" className="mt-3 text-xs text-destructive">{favoriteError}</p>}</div><PreviewPanel tool={tool} /></section>
     <section className="grid gap-12 py-12 lg:grid-cols-[1fr_330px]"><article className="max-w-2xl space-y-10"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">01 / What it is</div><p className="mt-4 text-lg leading-8 text-foreground/85">{tool.description}</p></div><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">02 / How it works</div><p className="mt-4 whitespace-pre-line text-lg leading-8 text-foreground/85">{tool.howItWorks}</p></div><div className="border-l-2 border-primary pl-5"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">03 / Why it made the guide</div><p className="mt-3 text-base leading-7 text-foreground/85">It gives {tool.bestFor?.toLowerCase() || 'curious builders'} a clear way to start, with enough context to decide whether it belongs in the workflow.</p></div></article><aside><div className="border border-border bg-secondary/50 p-6"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-accent">At a glance</div><dl className="mt-5 space-y-5 text-sm"><div><dt className="flex items-center gap-2 text-muted-foreground"><Hash className="h-3.5 w-3.5" /> Shelf</dt><dd className="mt-1 pl-5">{tool.categoryName}</dd></div><div><dt className="flex items-center gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5" /> Best for</dt><dd className="mt-1 pl-5 leading-6">{tool.bestFor || 'Curious builders'}</dd></div></dl></div><div className="mt-5 space-y-3 text-xs leading-5 text-muted-foreground"><div className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />Pricing and features can change; the visit link is the source of truth.</div><a href={tool.websiteUrl} target="_blank" rel="noreferrer" data-testid="link-external-source" className="flex items-center justify-between border-b border-border py-3 transition-colors hover:text-primary">Open source website <ExternalLink className="h-4 w-4" /></a></div></aside></section>
      {related.length > 0 && <section className="border-t border-border py-12"><div className="flex items-end justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Keep exploring</div><h2 className="mt-2 text-3xl font-semibold tracking-[-.06em]">Tools with a similar workflow.</h2></div><Link href="/directory" className="hidden text-xs text-muted-foreground hover:text-primary sm:block">Browse all tools</Link></div><div className="mt-6 grid gap-3 md:grid-cols-3">{related.map((item) => <Link key={item.id} href={`/tool/${item.slug}`} className="border border-border bg-card p-5 transition-colors hover:border-primary"><div className="font-mono text-[10px] uppercase tracking-[.12em] text-accent">{item.categoryName} · {item.pricing}</div><h3 className="mt-5 text-lg font-semibold tracking-[-.04em]">{item.name}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.shortDescription}</p><p className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{item.howItWorks}</p></Link>)}</div></section>}
  </main></Shell>;
}