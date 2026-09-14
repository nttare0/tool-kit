import { Link } from 'wouter';
import { Shell } from '@/components/toolstack-ui';

export default function NotFound() {
  return <Shell><main className="mx-auto flex min-h-[70dvh] max-w-7xl items-center px-5 py-16 md:px-8"><div><span className="font-mono text-xs uppercase tracking-[.2em] text-primary">404 / loose peg</span><h1 className="mt-5 max-w-2xl text-6xl font-semibold tracking-[-.08em] md:text-8xl">This shelf is <em className="font-serif font-normal text-primary">empty.</em></h1><p className="mt-6 max-w-md text-muted-foreground">That address does not point to a tool in the current field guide.</p><Link href="/" data-testid="link-back-to-directory" className="mt-8 inline-flex rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Back to the directory</Link></div></main></Shell>;
}