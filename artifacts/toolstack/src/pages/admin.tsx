import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Activity, Check, Edit3, FolderPlus, LogOut, Plus, Save, Sparkles, Star, Trash2, Users, X } from 'lucide-react';
import type { Category, Tool } from '@workspace/api-client-react';
import { BrandMark, LoadingGrid, Logo, QueryError, Shell } from '@/components/toolstack-ui';

type AuthStatus = { configured: boolean; authenticated: boolean; admin: { email: string } | null };
type ToolForm = { name: string; shortDescription: string; description: string; howItWorks: string; bestFor: string; websiteUrl: string; logoUrl: string; previewUrl: string; categoryId: number | string; pricing: string; featured: boolean; status: string };
type CategoryForm = { name: string; description: string; accent: string };
type Submission = { id: number; userEmail: string; userName: string; name: string; shortDescription: string; description: string; howItWorks: string; bestFor: string; websiteUrl: string; logoUrl: string | null; previewUrl: string | null; pricing: string; suggestedCategories: Array<{ name: string; description: string }>; status: string; reviewNote: string | null; createdAt: string };
type ManagedUser = { id: number; email: string; displayName: string; profession: string; status: string; createdAt: string; submissionCount: number; pendingCount: number };
type ActivityItem = { id: number; actorType: string; actorEmail: string; action: string; targetType: string; targetId: number | null; details: string; createdAt: string };
type Suggestion = { name: string; shortDescription: string; description: string; howItWorks: string; bestFor: string; pricing: string; categorySuggestions: Array<{ name: string; description: string }> };
type Tab = 'tools' | 'categories' | 'submissions' | 'users' | 'activity' | 'settings';

const blankTool: ToolForm = { name: '', shortDescription: '', description: '', howItWorks: '', bestFor: '', websiteUrl: '', logoUrl: '', previewUrl: '', categoryId: 0, pricing: 'Free', featured: false, status: 'published' };
const blankCategory: CategoryForm = { name: '', description: '', accent: '#D8FF63' };
const inputClass = 'h-10 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary';
const areaClass = 'min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary';

async function adminRequest<T>(path: string, body?: object, method?: string): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Could not complete the request.');
  return data as T;
}

function makePreviewUrl(websiteUrl: string) {
  try {
    const url = new URL(websiteUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return `https://api.microlink.io/?url=${encodeURIComponent(url.toString())}&screenshot=true&meta=false&embed=screenshot.url`;
  } catch {
    return '';
  }
}

function AuthGate({ status, onAuthenticated }: { status: AuthStatus; onAuthenticated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await adminRequest(status.configured ? 'auth/login' : 'auth/setup', { email, password });
      onAuthenticated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };
  return <Shell><main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12 md:px-8"><form onSubmit={submit} className="w-full border border-border bg-card p-7 md:p-9">
    <BrandMark /><div className="mt-10 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{status.configured ? 'Restricted workspace' : 'One-time first admin setup'}</div><h1 className="mt-3 text-3xl font-semibold tracking-[-.06em]">{status.configured ? 'Admin sign in.' : 'Create the first admin.'}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{status.configured ? 'Only an admin account can open this workspace.' : 'This one-time setup is available only before an admin account exists.'}</p>
    <label className="mt-6 block text-xs text-muted-foreground">Email<input type="email" autoComplete="email" required className={`${inputClass} mt-1.5`} value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="mt-4 block text-xs text-muted-foreground">Password (8+ characters)<input type="password" minLength={8} autoComplete={status.configured ? 'current-password' : 'new-password'} required className={`${inputClass} mt-1.5`} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    {message && <p role="alert" className="mt-4 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</p>}<button disabled={busy} className="mt-7 h-11 w-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Working…' : status.configured ? 'Sign in' : 'Create admin account'}</button>
  </form></main></Shell>;
}

export default function Admin() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authError, setAuthError] = useState('');
  const refreshAuth = () => adminRequest<AuthStatus>('auth/status').then(setAuth).catch((error) => setAuthError(error instanceof Error ? error.message : 'Could not check admin access.'));
  useEffect(() => { void refreshAuth(); }, []);
  if (authError) return <Shell><main className="mx-auto max-w-3xl px-4 py-20 md:px-8"><QueryError retry={() => { setAuthError(''); void refreshAuth(); }} /></main></Shell>;
  if (!auth) return <Shell><main className="mx-auto max-w-7xl px-4 py-12 md:px-8"><LoadingGrid /></main></Shell>;
  if (!auth.authenticated) return <AuthGate status={auth} onAuthenticated={() => { void refreshAuth(); }} />;
  return <AdminWorkspace adminEmail={auth.admin?.email || ''} onLogout={async () => { await adminRequest('auth/logout', {}, 'POST').catch(() => undefined); setAuth({ ...auth, authenticated: false, admin: null }); }} />;
}

function AdminWorkspace({ adminEmail, onLogout }: { adminEmail: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('tools');
  const [tools, setTools] = useState<Tool[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [coreLoading, setCoreLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [toolForm, setToolForm] = useState<ToolForm>(blankTool);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(blankCategory);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [toolOpen, setToolOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [suggestedCategories, setSuggestedCategories] = useState<Suggestion['categorySuggestions']>([]);
  const [submissionCategories, setSubmissionCategories] = useState<Record<number, number>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });

  const loadCore = async () => {
    setCoreLoading(true);
    try {
      const [nextTools, nextCategories] = await Promise.all([
        adminRequest<Tool[]>('tools?status=all'),
        adminRequest<Category[]>('categories'),
      ]);
      setTools(nextTools);
      setCategories(nextCategories);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the admin workspace.');
    } finally {
      setCoreLoading(false);
    }
  };
  const loadSection = async (section: Tab) => {
    if (!['submissions', 'users', 'activity'].includes(section)) return;
    setSectionLoading(true);
    try {
      if (section === 'submissions') setSubmissions(await adminRequest<Submission[]>('admin/submissions'));
      if (section === 'users') setUsers(await adminRequest<ManagedUser[]>('admin/users'));
      if (section === 'activity') setActivities(await adminRequest<ActivityItem[]>('admin/activity'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this section.');
    } finally {
      setSectionLoading(false);
    }
  };
  useEffect(() => { void loadCore(); }, []);
  useEffect(() => { void loadSection(tab); }, [tab]);
  useEffect(() => {
    const generated = makePreviewUrl(toolForm.websiteUrl);
    if (!generated || (toolForm.previewUrl && !toolForm.previewUrl.startsWith('https://api.microlink.io/')) || generated === toolForm.previewUrl) return;
    const timer = window.setTimeout(() => setToolForm((old) => ({ ...old, previewUrl: generated })), 450);
    return () => window.clearTimeout(timer);
  }, [toolForm.websiteUrl, toolForm.previewUrl]);

  const openTool = (tool?: Tool) => {
    setEditingTool(tool || null);
    setToolForm(tool ? {
      name: tool.name, shortDescription: tool.shortDescription, description: tool.description,
      howItWorks: tool.howItWorks, bestFor: tool.bestFor || '', websiteUrl: tool.websiteUrl,
      logoUrl: tool.logoUrl || '', previewUrl: tool.previewUrl || '', categoryId: tool.categoryId,
      pricing: tool.pricing, featured: tool.featured, status: tool.status,
    } : { ...blankTool, categoryId: categories[0]?.id || 0 });
    setSuggestedCategories([]);
    setAiError('');
    setToolOpen(true);
  };

  const readPreview = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) {
      setError('Choose an image under 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setToolForm((old) => ({ ...old, previewUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const saveTool = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = { ...toolForm, categoryId: Number(toolForm.categoryId), logoUrl: toolForm.logoUrl || null, previewUrl: toolForm.previewUrl || null };
      await adminRequest(editingTool ? `tools/${editingTool.id}` : 'tools', data, editingTool ? 'PATCH' : 'POST');
      setNotice(editingTool ? 'Tool updated.' : 'Tool added to the public directory.');
      setToolOpen(false);
      await loadCore();
      void loadSection('activity');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this tool.');
    } finally {
      setBusy(false);
    }
  };

  const suggestTool = async () => {
    setAiBusy(true);
    setAiError('');
    try {
      const result = await adminRequest<Suggestion>('ai/suggest-tool', { name: toolForm.name, websiteUrl: toolForm.websiteUrl });
      setToolForm((old) => ({ ...old, ...result, websiteUrl: old.websiteUrl }));
      setSuggestedCategories(result.categorySuggestions || []);
      setNotice('AI draft added to the form. Verify every claim and pricing detail before publishing.');
    } catch (suggestError) {
      setAiError(suggestError instanceof Error ? suggestError.message : 'Could not get AI suggestions.');
    } finally {
      setAiBusy(false);
    }
  };

  const addSuggestedCategory = async (suggestion: { name: string; description: string }) => {
    const existing = categories.find((category) => category.name.toLowerCase() === suggestion.name.toLowerCase());
    if (existing) {
      setToolForm((old) => ({ ...old, categoryId: existing.id }));
      setSuggestedCategories((old) => old.filter((item) => item.name !== suggestion.name));
      setNotice(`Selected existing category “${existing.name}”.`);
      return;
    }
    try {
      const created = await adminRequest<Category>('categories', { ...suggestion, accent: '#D8FF63' });
      setCategories((old) => [...old, created].sort((a, b) => a.name.localeCompare(b.name)));
      setToolForm((old) => ({ ...old, categoryId: created.id }));
      setSuggestedCategories((old) => old.filter((item) => item.name !== suggestion.name));
      setNotice(`Added category “${created.name}”. Review it before using it.`);
    } catch (categoryError) {
      setAiError(categoryError instanceof Error ? categoryError.message : 'Could not add that category.');
    }
  };

  const saveCategory = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminRequest(editingCategory ? `categories/${editingCategory.id}` : 'categories', categoryForm, editingCategory ? 'PATCH' : 'POST');
      setCategoryOpen(false);
      setNotice('Category saved.');
      await loadCore();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this category.');
    } finally {
      setBusy(false);
    }
  };

  const reviewSubmission = async (submission: Submission, status: 'approved' | 'rejected') => {
    try {
      await adminRequest(`admin/submissions/${submission.id}`, {
        status,
        reviewNote: reviewNotes[submission.id] || '',
        categoryId: submissionCategories[submission.id] || categories[0]?.id,
      }, 'PATCH');
      setNotice(status === 'approved' ? `${submission.name} is now live in the public directory.` : `${submission.name} was declined; the submitter will see your note in their account.`);
      await loadSection('submissions');
      if (status === 'approved') await loadCore();
      void loadSection('activity');
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not update this submission.');
    }
  };

  const toggleUser = async (user: ManagedUser) => {
    const status = user.status === 'active' ? 'suspended' : 'active';
    try {
      await adminRequest(`admin/users/${user.id}`, { status }, 'PATCH');
      setNotice(`${user.email} is now ${status}.`);
      await loadSection('users');
      void loadSection('activity');
    } catch (userError) {
      setError(userError instanceof Error ? userError.message : 'Could not update this account.');
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminRequest('admin/password', passwordForm, 'POST');
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setNotice('Admin password changed.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Could not change password.');
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<[Tab, string, typeof Users]> = [
    ['tools', `Tools (${tools.length})`, Plus],
    ['categories', `Categories (${categories.length})`, FolderPlus],
    ['submissions', `Submissions (${submissions.filter((item) => item.status === 'pending').length || '…'})`, Check],
    ['users', 'Users', Users],
    ['activity', 'Activity', Activity],
    ['settings', 'Settings', Sparkles],
  ];
  const field = (label: string, value: string | number, onChange: (value: string) => void, options: { area?: boolean; required?: boolean; type?: string } = {}) => <label className="block text-xs text-muted-foreground"><span className="mb-1.5 block text-[11px] font-medium text-foreground">{label}</span>{options.area ? <textarea value={value} required={options.required} onChange={(e) => onChange(e.target.value)} className={areaClass} /> : <input type={options.type || 'text'} value={value} required={options.required} onChange={(e) => onChange(e.target.value)} className={inputClass} />}</label>;

  return <Shell><main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
    <header className="flex flex-col justify-between gap-6 border-b border-border pb-8 sm:flex-row sm:items-end"><div><span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Private admin / {adminEmail}</span><h1 className="mt-3 text-4xl font-semibold tracking-[-.07em]">Manage Toolstack.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Review submissions, manage accounts, edit the directory, and track activity.</p></div><button type="button" onClick={onLogout} className="inline-flex items-center gap-2 self-start text-xs text-muted-foreground hover:text-foreground sm:self-auto"><LogOut className="h-3.5 w-3.5" /> Log out</button></header>
    {(error || notice) && <div role={error ? 'alert' : 'status'} className={`mt-5 border px-4 py-3 text-sm ${error ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border bg-secondary text-muted-foreground'}`}>{error || notice}<button type="button" onClick={() => { setError(''); setNotice(''); }} className="float-right ml-4 underline">Dismiss</button></div>}
    <nav aria-label="Admin sections" className="mt-7 flex gap-5 overflow-x-auto border-b border-border">{tabs.map(([key, label, Icon]) => <button type="button" key={key} onClick={() => { setTab(key); setError(''); }} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-1 pb-3 text-xs ${tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</nav>

    {coreLoading ? <div className="py-8"><LoadingGrid /></div> : <>
      {tab === 'tools' && <section className="mt-7"><div className="flex items-center justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Public directory</div><h2 className="mt-2 text-2xl font-semibold">Tools</h2></div><button type="button" onClick={() => openTool()} className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add tool</button></div><div className="mt-5 overflow-x-auto border border-border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-secondary text-[11px] text-muted-foreground"><tr><th className="px-4 py-3">Tool</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Featured</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{tools.map((tool) => <tr key={tool.id} className="border-t border-border hover:bg-secondary/40"><td className="px-4 py-3"><div className="flex items-center gap-3"><Logo tool={tool} size="sm" /><div><div className="font-medium">{tool.name}</div><div className="max-w-[300px] truncate text-xs text-muted-foreground">{tool.shortDescription}</div></div></div></td><td className="px-4 py-3 text-xs text-muted-foreground">{tool.categoryName}</td><td className="px-4 py-3"><button type="button" onClick={async () => { await adminRequest(`tools/${tool.id}`, { status: tool.status === 'published' ? 'draft' : 'published' }, 'PATCH'); await loadCore(); }} className="border border-border px-2.5 py-1 text-[10px] uppercase">{tool.status}</button></td><td className="px-4 py-3"><button type="button" aria-label="Toggle featured" onClick={async () => { await adminRequest(`tools/${tool.id}`, { featured: !tool.featured }, 'PATCH'); await loadCore(); }} className={tool.featured ? 'text-primary' : 'text-muted-foreground'}><Star className="h-4 w-4" fill={tool.featured ? 'currentColor' : 'none'} /></button></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => openTool(tool)} aria-label={`Edit ${tool.name}`} className="mr-3 text-muted-foreground hover:text-foreground"><Edit3 className="inline h-4 w-4" /></button><button type="button" onClick={async () => { if (window.confirm(`Delete ${tool.name}?`)) { await adminRequest(`tools/${tool.id}`, undefined, 'DELETE'); await loadCore(); setNotice(`${tool.name} deleted.`); } }} aria-label={`Delete ${tool.name}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="inline h-4 w-4" /></button></td></tr>)}</tbody></table>{!tools.length && <p className="p-8 text-center text-sm text-muted-foreground">No tools yet.</p>}</div></section>}

      {tab === 'categories' && <section className="mt-7"><div className="flex items-center justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Directory structure</div><h2 className="mt-2 text-2xl font-semibold">Categories</h2></div><button type="button" onClick={() => { setEditingCategory(null); setCategoryForm(blankCategory); setCategoryOpen(true); }} className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Add category</button></div><div className="mt-5 grid gap-4 md:grid-cols-2">{categories.map((category) => <article key={category.id} className="border border-border bg-card p-5"><div className="flex items-start justify-between gap-3"><div><span className="mb-3 inline-block h-3 w-3" style={{ backgroundColor: category.accent || '#000' }} /><h3 className="text-xl font-semibold">{category.name}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{category.description}</p></div><span className="text-xs text-muted-foreground">{category.toolCount} tools</span></div><div className="mt-5 flex gap-4"><button type="button" onClick={() => { setEditingCategory(category); setCategoryForm({ name: category.name, description: category.description, accent: category.accent || '#000000' }); setCategoryOpen(true); }} className="text-xs text-muted-foreground hover:text-foreground">Edit</button><button type="button" onClick={async () => { if (window.confirm(`Delete ${category.name}?`)) { try { await adminRequest(`categories/${category.id}`, undefined, 'DELETE'); await loadCore(); } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Could not delete category.'); } } }} className="text-xs text-muted-foreground hover:text-destructive">Delete</button></div></article>)}</div></section>}

      {tab === 'submissions' && <section className="mt-7"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Moderation queue</div><h2 className="mt-2 text-2xl font-semibold">Tool submissions</h2><p className="mt-2 text-sm text-muted-foreground">Only approval publishes a user-submitted tool to the directory.</p></div>{sectionLoading ? <div className="py-8"><LoadingGrid /></div> : <div className="mt-5 grid gap-4">{submissions.map((submission) => <article key={submission.id} className="grid gap-5 border border-border bg-card p-5 lg:grid-cols-[260px_1fr]"><div className="overflow-hidden border border-border bg-secondary"><div className="aspect-[16/10]">{submission.previewUrl ? <img src={submission.previewUrl} alt={`${submission.name} website screenshot`} width={1280} height={800} loading="lazy" className="h-full w-full object-cover object-top" /> : <div className="grid h-full place-items-center font-mono text-[10px] text-muted-foreground">No preview</div>}</div><div className="flex items-center justify-between px-3 py-2 text-[10px] uppercase text-muted-foreground"><span>{submission.status}</span><span>{new Date(submission.createdAt).toLocaleDateString()}</span></div></div><div><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-[10px] uppercase tracking-[.12em] text-primary">Submitted by {submission.userName} · {submission.userEmail}</div><h3 className="mt-2 text-xl font-semibold">{submission.name}</h3><a href={submission.websiteUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-muted-foreground underline underline-offset-2">{submission.websiteUrl}</a></div><span className="border border-border px-2.5 py-1 font-mono text-[10px] uppercase">{submission.status}</span></div><p className="mt-4 text-sm leading-6">{submission.shortDescription}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{submission.description}</p><div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><p><strong>How it works: </strong>{submission.howItWorks}</p><p><strong>Best for: </strong>{submission.bestFor || 'Not specified'}</p><p><strong>Pricing: </strong>{submission.pricing}</p></div>{submission.status !== 'approved' && <div className="mt-5 grid gap-3 border-t border-border pt-4 md:grid-cols-[1fr_1.4fr_auto_auto] md:items-end"><label className="block text-xs text-muted-foreground">Publish in category<select value={submissionCategories[submission.id] || categories[0]?.id || ''} onChange={(e) => setSubmissionCategories((old) => ({ ...old, [submission.id]: Number(e.target.value) }))} className={`${inputClass} mt-1.5`}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="block text-xs text-muted-foreground">Review note for submitter<input value={reviewNotes[submission.id] ?? submission.reviewNote ?? ''} onChange={(e) => setReviewNotes((old) => ({ ...old, [submission.id]: e.target.value }))} className={`${inputClass} mt-1.5`} placeholder="Optional feedback" /></label><button type="button" onClick={() => void reviewSubmission(submission, 'rejected')} className="h-10 border border-border px-4 text-xs hover:border-destructive hover:text-destructive">Decline</button><button type="button" onClick={() => void reviewSubmission(submission, 'approved')} disabled={!categories.length} className="inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-40"><Check className="h-4 w-4" /> Approve & publish</button></div>}{submission.status === 'approved' && submission.reviewNote && <p className="mt-4 border-l-2 border-primary pl-3 text-sm text-muted-foreground">{submission.reviewNote}</p>}</div></article>)}{!submissions.length && <div className="border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No tool suggestions have been submitted yet.</div>}</div>}</section>}

      {tab === 'users' && <section className="mt-7"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Member accounts</div><h2 className="mt-2 text-2xl font-semibold">Users</h2><p className="mt-2 text-sm text-muted-foreground">Review account activity and suspend or restore access when needed.</p></div>{sectionLoading ? <div className="py-8"><LoadingGrid /></div> : <div className="mt-5 overflow-x-auto border border-border"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-secondary text-[11px] text-muted-foreground"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Submissions</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Access</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-t border-border"><td className="px-4 py-3"><div className="font-medium">{user.displayName}</div><div className="text-xs text-muted-foreground">{user.email}</div></td><td className="px-4 py-3 text-xs text-muted-foreground">{user.profession || 'Not set'}</td><td className="px-4 py-3 text-xs">{user.submissionCount} total · {user.pendingCount} pending</td><td className="px-4 py-3 text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td><td className="px-4 py-3"><span className={`font-mono text-[10px] uppercase ${user.status === 'active' ? 'text-primary' : 'text-destructive'}`}>{user.status}</span></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => void toggleUser(user)} className="border border-border px-3 py-1.5 text-[10px] uppercase">{user.status === 'active' ? 'Suspend' : 'Restore'}</button></td></tr>)}</tbody></table>{!users.length && <p className="p-8 text-center text-sm text-muted-foreground">No member accounts yet.</p>}</div>}</section>}

      {tab === 'activity' && <section className="mt-7"><div className="flex items-center gap-3"><Activity className="h-5 w-5 text-primary" /><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Audit trail</div><h2 className="mt-1 text-2xl font-semibold">Recent activity</h2></div></div>{sectionLoading ? <div className="py-8"><LoadingGrid /></div> : <div className="mt-5 divide-y divide-border border border-border">{activities.map((item) => <article key={item.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="text-sm"><span className="font-medium">{item.actorEmail}</span><span className="text-muted-foreground"> · {item.action.replaceAll('_', ' ')}{item.details ? ` · ${item.details}` : ''}</span></div><div className="mt-1 text-[10px] font-mono uppercase text-muted-foreground">{item.actorType} / {item.targetType}{item.targetId ? ` #${item.targetId}` : ''}</div></div><time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time></article>)}{!activities.length && <p className="p-8 text-center text-sm text-muted-foreground">Activity will appear here as people use Toolstack.</p>}</div>}</section>}

      {tab === 'settings' && <section className="mt-7 grid gap-6 lg:grid-cols-2"><div className="border border-border bg-card p-6"><div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Admin security</div><h2 className="mt-2 text-2xl font-semibold">Change password</h2><form onSubmit={changePassword} className="mt-5 space-y-4"><label className="block text-xs text-muted-foreground">Current password<input required type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className={`${inputClass} mt-1.5`} /></label><label className="block text-xs text-muted-foreground">New password (8+ characters)<input required minLength={8} type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className={`${inputClass} mt-1.5`} /></label><button disabled={busy} className="bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Update password'}</button></form></div><div className="border border-border bg-primary/5 p-6"><Users className="h-5 w-5 text-primary" /><h2 className="mt-4 text-xl font-semibold">Admin controls stay private</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Only authenticated admins can view submissions, member details, activity history, and draft tools. New member-submitted listings remain hidden until approval.</p></div></section>}
    </>}

    {toolOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 sm:p-6"><form onSubmit={saveTool} className="mx-auto my-5 max-w-5xl border border-border bg-card p-5 shadow-2xl md:p-8"><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{editingTool ? 'Edit public listing' : 'New public listing'}</span><h2 className="mt-2 text-2xl font-semibold">{editingTool ? editingTool.name : 'Add a tool'}</h2><p className="mt-2 text-sm text-muted-foreground">Use AI to draft the fields, then verify details before saving.</p></div><button type="button" aria-label="Close tool form" onClick={() => setToolOpen(false)} className="border border-border p-2"><X className="h-4 w-4" /></button></div><div className="mt-6 grid gap-4 md:grid-cols-2">
      <label className="block text-xs text-muted-foreground">Tool name<input required value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} className={`${inputClass} mt-1.5`} /></label>
      <label className="block text-xs text-muted-foreground">Website URL<input required type="url" value={toolForm.websiteUrl} onChange={(e) => setToolForm({ ...toolForm, websiteUrl: e.target.value })} className={`${inputClass} mt-1.5`} /></label>
      <div className="md:col-span-2"><button type="button" onClick={() => void suggestTool()} disabled={aiBusy || !toolForm.websiteUrl} className="inline-flex items-center gap-2 border border-primary/40 bg-primary/5 px-4 py-2.5 text-xs font-semibold hover:bg-primary/10 disabled:opacity-40"><Sparkles className="h-4 w-4 text-primary" />{aiBusy ? 'Drafting fields…' : 'AI suggest details and categories'}</button>{aiError && <p role="alert" className="mt-2 text-xs text-destructive">{aiError}</p>}</div>
      {field('Short description', toolForm.shortDescription, (v) => setToolForm({ ...toolForm, shortDescription: v }), { required: true })}
      {field('Best for', toolForm.bestFor, (v) => setToolForm({ ...toolForm, bestFor: v }))}
      {field('Description', toolForm.description, (v) => setToolForm({ ...toolForm, description: v }), { area: true, required: true })}
      {field('How it works', toolForm.howItWorks, (v) => setToolForm({ ...toolForm, howItWorks: v }), { area: true, required: true })}
      {field('Pricing', toolForm.pricing, (v) => setToolForm({ ...toolForm, pricing: v }), { required: true })}
      {field('Logo URL (optional)', toolForm.logoUrl, (v) => setToolForm({ ...toolForm, logoUrl: v }))}
      <label className="block text-xs text-muted-foreground"><span className="mb-1.5 block text-[11px] font-medium text-foreground">Category</span><select required value={toolForm.categoryId} onChange={(e) => setToolForm({ ...toolForm, categoryId: e.target.value })} className={inputClass}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="block text-xs text-muted-foreground"><span className="mb-1.5 block text-[11px] font-medium text-foreground">Website screenshot</span><input type="file" accept="image/*" onChange={readPreview} className="block w-full border border-dashed border-border bg-background p-2 text-xs" /><span className="mt-2 block">A screenshot link is created automatically from the website unless you upload one.</span></label>
      <label className="flex items-center gap-3 self-end text-sm"><input type="checkbox" checked={toolForm.featured} onChange={(e) => setToolForm({ ...toolForm, featured: e.target.checked })} className="h-4 w-4 accent-primary" /> Feature as an editor’s pick</label>
    </div>
    {suggestedCategories.length > 0 && <div className="mt-5 border border-border bg-background p-4"><div className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">AI category ideas · review before adding</div><div className="mt-3 flex flex-wrap gap-2">{suggestedCategories.map((item) => <button key={item.name} type="button" onClick={() => void addSuggestedCategory(item)} className="border border-border px-3 py-2 text-left text-xs hover:border-primary"><span className="font-medium">{item.name}</span><span className="ml-2 text-muted-foreground">Add</span></button>)}</div></div>}
    {toolForm.previewUrl && <div className="relative mt-5 overflow-hidden border border-border bg-secondary"><div className="grid min-h-32 place-items-center font-mono text-[10px] uppercase tracking-[.12em] text-muted-foreground">Website screenshot preview</div><img src={toolForm.previewUrl} alt="Website screenshot preview" width={1280} height={800} className="absolute inset-0 max-h-72 min-h-32 w-full bg-secondary object-cover object-top" onError={(e) => { e.currentTarget.style.display = 'none'; }} /></div>}
    {error && <p role="alert" className="mt-4 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <button disabled={busy} type="submit" className="mt-6 inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" />{busy ? 'Saving…' : editingTool ? 'Save changes' : 'Publish tool'}</button>
    </form></div>}

    {categoryOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><form onSubmit={saveCategory} className="w-full max-w-lg border border-border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{editingCategory ? 'Edit category' : 'New category'}</div><h2 className="mt-2 text-2xl font-semibold">Shape a shelf</h2></div><button type="button" aria-label="Close category form" onClick={() => setCategoryOpen(false)}><X className="h-4 w-4" /></button></div><div className="mt-6 space-y-4">{field('Name', categoryForm.name, (v) => setCategoryForm({ ...categoryForm, name: v }), { required: true })}{field('Description', categoryForm.description, (v) => setCategoryForm({ ...categoryForm, description: v }), { area: true, required: true })}<label className="block text-xs text-muted-foreground">Accent color<input type="color" value={categoryForm.accent} onChange={(e) => setCategoryForm({ ...categoryForm, accent: e.target.value })} className="mt-1.5 h-10 w-full border border-border bg-background p-1" /></label></div>{error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}<button disabled={busy} className="mt-6 inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"><FolderPlus className="h-4 w-4" />{busy ? 'Saving…' : 'Save category'}</button></form></div>}
  </main></Shell>;
}