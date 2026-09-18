import { Link } from 'wouter';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Shell } from '@/components/toolstack-ui';

const copy = {
  terms: {
    eyebrow: 'Terms / field notes',
    title: 'Use Toolstack as a guide, not a guarantee.',
    intro: 'Toolstack is an editorial directory of third-party software. Listings are provided to help you compare options; they are not endorsements, warranties, or professional advice.',
    sections: [
      ['Third-party services', 'Every external tool belongs to its own operator. Their pricing, availability, privacy practices, licenses, and terms can change without notice. Review the linked service before creating an account, uploading content, or paying for a plan.'],
      ['Content and trademarks', 'Tool names, logos, screenshots, and trademarks remain the property of their respective owners. Toolstack uses them for identification and commentary. If you own a listing and need an image, logo, or description corrected or removed, contact the site owner through the published website.'],
      ['Acceptable use', 'Do not use this directory to misrepresent a product, scrape or overload the service, bypass access controls, or submit content that is unlawful, deceptive, invasive, discriminatory, or infringing. Admin access is for maintaining the directory, not for uploading user data or secrets.'],
      ['Editorial limits', 'We aim for accurate, useful summaries, but no listing is guaranteed to be complete or current. Toolstack is not responsible for third-party products or for losses caused by relying on a listing.'],
    ],
  },
  privacy: {
    eyebrow: 'Privacy / field notes',
    title: 'Keep the directory small and intentional.',
    intro: 'Toolstack is designed to collect as little information as possible. Public browsing does not require an account.',
    sections: [
      ['Public browsing', 'Searches and page views are handled by the application to return directory results. The public directory does not ask visitors for names, passwords, or payment information.'],
      ['Admin accounts', 'Admin email addresses, password hashes, salts, and session records are stored in the application database. Passwords are never stored in plain text. Session cookies are HTTP-only and are used only to protect admin actions.'],
      ['Submitted images', 'An admin may add a logo or poster preview for a listing. Only submit images you have permission to use. Do not upload private, personal, confidential, or sensitive information.'],
      ['External links and screenshots', 'Toolstack links to third-party websites and may use a screenshot service to create a homepage preview. Those external services have their own privacy policies. Preview images should not be treated as a secure or private view of a website.'],
      ['Changes and contact', 'This page may be updated as the product changes. For removal, correction, or privacy requests, use the contact route provided by the relevant tool owner or the project maintainer.'],
    ],
  },
} as const;

export default function Legal({ kind }: { kind: 'terms' | 'privacy' }) {
  const page = copy[kind];
  return <Shell><main className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-20"><Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to directory</Link><div className="mt-14 max-w-3xl"><div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> {page.eyebrow}</div><h1 className="mt-5 text-5xl font-semibold leading-[.98] tracking-[-.075em] md:text-7xl">{page.title}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">{page.intro}</p></div><div className="mt-16 divide-y divide-border border-y border-border">{page.sections.map(([title, body]) => <section key={title} className="grid gap-4 py-7 md:grid-cols-[180px_1fr]"><h2 className="text-sm font-semibold">{title}</h2><p className="max-w-2xl text-sm leading-7 text-muted-foreground">{body}</p></section>)}</div></main></Shell>;
}