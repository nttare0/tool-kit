import { Link } from 'wouter';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Shell } from '@/components/toolstack-ui';

const source = 'https://github.com/awesome-selfhosted/awesome-selfhosted-data';
const commit = '80a6ccd60c105a81f7a02b9b731922e76f2aae48';
export default function Credits() {
  return <Shell><main className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-20">
    <Link href="/directory" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to directory</Link>
    <h1 className="mt-10 text-4xl font-semibold tracking-tight">Catalog sources & credits</h1>
    <section className="mt-8 space-y-5 border-y border-border py-8 text-sm leading-7">
      <h2 className="text-xl font-semibold">Awesome-Selfhosted</h2>
      <p>Our additional 1,000-tool catalog is adapted from <a className="underline underline-offset-4" href={source}>Awesome-Selfhosted data</a> by the Awesome-Selfhosted contributors, licensed under <a className="underline underline-offset-4" href="https://creativecommons.org/licenses/by-sa/3.0/">Creative Commons Attribution-ShareAlike 3.0 Unported</a>. These adapted catalog summaries remain available under that license. This does not change the separate licenses of the software being listed.</p>
      <p className="text-muted-foreground">Changes: selected 1,000 non-archived entries, excluded duplicates from the starter catalog, and mapped source tags into Toolstack categories. Original source descriptions were retained. Each imported listing includes its source record in the overview.</p>
      <p className="break-all text-muted-foreground">Source snapshot: <a className="underline underline-offset-4" href={`${source}/tree/${commit}`}>{commit}</a>.</p>
      <a className="inline-flex items-center gap-2 font-medium underline underline-offset-4" href="https://github.com/nttare0/tool-kit/blob/arena/7ae75625-tool-kit/artifacts/api-server/src/data/additional-tool-catalog.json">View the adapted dataset <ExternalLink className="h-4 w-4" /></a>
      <p className="text-muted-foreground">Listings are informational, not endorsements. Availability, pricing, maintenance, and hosting requirements may change. Links and screenshots are not individually verified. Names and trademarks belong to their owners.</p>
    </section>
  </main></Shell>;
}
