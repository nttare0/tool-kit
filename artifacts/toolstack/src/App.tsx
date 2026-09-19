import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Home from '@/pages/home';
import Directory from '@/pages/directory';
import ToolDetail from '@/pages/tool-detail';
import Admin from '@/pages/admin';
import Legal from '@/pages/legal';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();

  useEffect(() => {
    const pathname = location.split('?')[0];
    const isAdmin = pathname === '/admin';
    const isDirectory = pathname === '/directory';
    const isNotFound = pathname === '/404';
    const isLegal = pathname === '/terms' || pathname === '/privacy';
    const slug = pathname.startsWith('/tool/') ? decodeURIComponent(pathname.slice('/tool/'.length)) : '';
    const title = isAdmin
      ? 'Admin workspace — Toolstack'
      : isDirectory
        ? 'Directory — Find useful software | Toolstack'
      : isNotFound
        ? 'Page not found — Toolstack'
        : isLegal
          ? `${location === '/terms' ? 'Terms of use' : 'Privacy'} — Toolstack`
        : slug
          ? `${slug.replace(/-/g, ' ')} — Toolstack field note`
          : 'Toolstack — Find the right tool for the work';
    const description = isAdmin
      ? 'Manage Toolstack tools, categories, publishing status, and featured discoveries.'
      : isDirectory
        ? 'Search and compare carefully edited tools for design, development, AI, productivity, and media.'
      : isNotFound
        ? 'That Toolstack page is not in the current field guide.'
        : isLegal
          ? 'Read how Toolstack presents curated software listings, external links, and preview images.'
        : 'Toolstack is a carefully edited field guide to useful AI, design, development, productivity, and media tools.';
    document.title = title;
    const setMeta = (selector: string, content: string) => {
      const element = document.querySelector<HTMLMetaElement>(selector);
      if (element) element.content = content;
    };
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[property="og:url"]', `${window.location.origin}${location}`);
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${window.location.origin}${location}`;
    const structured = document.querySelector<HTMLScriptElement>('#toolstack-structured-data');
    if (structured) {
      structured.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Toolstack',
        description,
        url: `${window.location.origin}${location}`,
        potentialAction: {
          '@type': 'SearchAction',
      target: `${window.location.origin}/directory?search={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      });
    }
  }, [location]);

  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/directory" component={Directory} />
         <Route path="/tool/:slug" component={ToolDetail} />
         <Route path="/admin" component={Admin} />
         <Route path="/terms" component={() => <Legal kind="terms" />} />
         <Route path="/privacy" component={() => <Legal kind="privacy" />} />
         <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
