import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Edit3, FolderPlus, ImagePlus, LogOut, Plus, Save, Star, Trash2, X } from 'lucide-react';
import { useCreateCategory, useCreateTool, useDeleteCategory, useDeleteTool, useListCategories, useListTools, useUpdateCategory, useUpdateTool } from '@workspace/api-client-react';
import type { Category, Tool } from '@workspace/api-client-react';
import { BrandMark, LoadingGrid, Logo, QueryError, Shell } from '@/components/toolstack-ui';

type AuthStatus = { configured: boolean; authenticated: boolean; admin: { email: string } | null };
type ToolForm = { name: string; shortDescription: string; description: string; howItWorks: string; bestFor: string; websiteUrl: string; logoUrl: string; previewUrl: string; categoryId: number | string; pricing: string; featured: boolean; status: string };
type CategoryForm = { name: string; description: string; accent: string };

const blankTool: ToolForm = { name: '', shortDescription: '', description: '', howItWorks: '', bestFor: '', websiteUrl: '', logoUrl: '', previewUrl: '', categoryId: 0, pricing: 'Free', featured: false, status: 'published' };
const blankCategory: CategoryForm = { name: '', description: '', accent: '#000000' };

function Field({ label, value, onChange, area = false, required = false, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; area?: boolean; required?: boolean; type?: string }) {
  const props = { value, required, type, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), placeholder: label };
  return <label className="block text-xs text-muted-foreground"><span className="mb-1.5 block text-[11px] font-medium text-foreground">{label}</span>{area ? <textarea {...props} rows={3} className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground" /> : <input {...props} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-foreground" />}</label>;
}

async function authRequest(path: string, body?: object) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Could not complete request');
  return data;
}

function AuthGate({ status, onAuthenticated }: { status: AuthStatus; onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'setup' | 'login'>(status.configured ? 'login' : 'setup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await authRequest(mode, { email, password });
      onAuthenticated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete request');
    } finally {
      setBusy(false);
    }
  };
  return <Shell><main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12 md:px-8"><form onSubmit={submit} className="w-full border border-border bg-card p-7 md:p-9"><BrandMark /><div className="mt-10 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{mode === 'setup' ? 'First-time setup' : 'Private workspace'}</div><h1 className="mt-3 text-3xl font-semibold tracking-[-.06em]">{mode === 'setup' ? 'Create your admin login.' : 'Welcome back.'}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{mode === 'setup' ? 'This creates the first admin account and stores it securely in SQLite.' : 'Log in to manage tools, categories, publishing, and preview images.'}</p><div className="mt-7 space-y-4"><Field label="Email" value={email} onChange={setEmail} type="email" required /><Field label="Password (8+ characters)" value={password} onChange={setPassword} type="password" required /></div>{message && <p className="mt-4 text-xs text-red-600">{message}</p>}<button disabled={busy} className="mt-7 h-11 w-full rounded-md bg-black px-4 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50">{busy ? 'Working…' : mode === 'setup' ? 'Create admin account' : 'Log in'}</button>{status.configured && <button type="button" onClick={() => setMode(mode === 'login' ? 'setup' : 'login')} className="mt-4 w-full text-xs text-muted-foreground underline underline-offset-4">{mode === 'login' ? 'First admin setup' : 'Back to login'}</button>}</form></main></Shell>;
}

export default function Admin() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<'tools' | 'categories'>('tools');
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [toolOpen, setToolOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [toolForm, setToolForm] = useState<ToolForm>(blankTool);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(blankCategory);
  const [notice, setNotice] = useState('');

  const refreshAuth = () => authRequest('status').then(setAuth).catch((error) => setAuthError(error instanceof Error ? error.message : 'Could not load login'));
  useEffect(() => { refreshAuth(); }, []);

  const queryEnabled = Boolean(auth?.authenticated);
  const toolsQuery = useListTools({ status: 'all' }, { query: { enabled: queryEnabled, queryKey: ['admin-tools', queryEnabled] } });
  const catsQuery = useListCategories({ query: { enabled: queryEnabled, queryKey: ['admin-categories', queryEnabled] } });
  const createTool = useCreateTool(); const updateTool = useUpdateTool(); const deleteTool = useDeleteTool();
  const createCategory = useCreateCategory(); const updateCategory = useUpdateCategory(); const deleteCategory = useDeleteCategory();
  const tools = toolsQuery.data || []; const categories = catsQuery.data || [];
  const busy = createTool.isPending || updateTool.isPending || createCategory.isPending || updateCategory.isPending;
  const publishedCount = useMemo(() => tools.filter((item) => item.status === 'published').length, [tools]);

  if (authError) return <Shell><main className="mx-auto max-w-3xl px-4 py-20 md:px-8"><QueryError retry={() => { setAuthError(''); refreshAuth(); }} /></main></Shell>;
  if (!auth) return <Shell><main className="mx-auto max-w-7xl px-4 py-12 md:px-8"><LoadingGrid /></main></Shell>;
  if (!auth.authenticated) return <AuthGate status={auth} onAuthenticated={refreshAuth} />;
  if (toolsQuery.isLoading || catsQuery.isLoading) return <Shell><main className="mx-auto max-w-7xl px-4 py-12 md:px-8"><LoadingGrid /></main></Shell>;
  if (toolsQuery.isError || catsQuery.isError) return <Shell><main className="mx-auto max-w-3xl px-4 py-20 md:px-8"><QueryError retry={() => { toolsQuery.refetch(); catsQuery.refetch(); }} /></main></Shell>;

  const refresh = () => { toolsQuery.refetch(); catsQuery.refetch(); };
  const openTool = (tool?: Tool) => { setToolOpen(true); setEditingTool(tool || null); setToolForm(tool ? { name: tool.name, shortDescription: tool.shortDescription, description: tool.description, howItWorks: tool.howItWorks, bestFor: tool.bestFor || '', websiteUrl: tool.websiteUrl, logoUrl: tool.logoUrl || '', previewUrl: tool.previewUrl || '', categoryId: tool.categoryId, pricing: tool.pricing, featured: tool.featured, status: tool.status } : { ...blankTool, categoryId: categories[0]?.id || 0 }); };
  const openCategory = (category?: Category) => { setCategoryOpen(true); setEditingCategory(category || null); setCategoryForm(category ? { name: category.name, description: category.description, accent: category.accent || '#000000' } : { ...blankCategory }); };
  const setTool = (key: keyof ToolForm, value: unknown) => setToolForm((old) => ({ ...old, [key]: value }));
  const setCategory = (key: keyof CategoryForm, value: string) => setCategoryForm((old) => ({ ...old, [key]: value }));
  const readPreview = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) { setNotice('Choose an image under 3 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setTool('previewUrl', String(reader.result));
    reader.readAsDataURL(file);
  };
  const saveTool = (event: FormEvent) => {
    event.preventDefault();
    const data = { ...toolForm, categoryId: Number(toolForm.categoryId), featured: Boolean(toolForm.featured), logoUrl: toolForm.logoUrl || null, previewUrl: toolForm.previewUrl || null };
    const done = () => { setEditingTool(null); setToolOpen(false); setNotice('Tool saved.'); refresh(); };
    editingTool ? updateTool.mutate({ id: editingTool.id, data }, { onSuccess: done, onError: (error) => setNotice(error.message) }) : createTool.mutate({ data }, { onSuccess: done, onError: (error) => setNotice(error.message) });
  };
  const saveCategory = (event: FormEvent) => {
    event.preventDefault();
    const done = () => { setEditingCategory(null); setCategoryOpen(false); setNotice('Category saved.'); refresh(); };
    editingCategory ? updateCategory.mutate({ id: editingCategory.id, data: categoryForm }, { onSuccess: done, onError: (error) => setNotice(error.message) }) : createCategory.mutate({ data: categoryForm }, { onSuccess: done, onError: (error) => setNotice(error.message) });
  };
  const logout = async () => { await authRequest('logout', {}).catch(() => undefined); setAuth({ ...auth, authenticated: false, admin: null }); };

  return <Shell><main className="mx-auto max-w-7xl px-4 py-8 md:px-8"><div className="flex flex-col justify-between gap-6 border-b border-border pb-8 md:flex-row md:items-end"><div><span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Admin / {auth.admin?.email}</span><h1 className="mt-3 text-4xl font-semibold tracking-[-.07em]">Manage the directory.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Add tools, keep descriptions useful, and give every listing a clear home-page preview.</p></div><div className="flex items-center gap-3"><span className="border border-border px-3 py-2 font-mono text-[10px] text-muted-foreground">{publishedCount} published</span><button type="button" onClick={logout} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><LogOut className="h-3.5 w-3.5" /> Log out</button></div></div>
    {notice && <div className="mt-5 border border-border bg-secondary px-4 py-3 text-xs text-muted-foreground">{notice}</div>}
    <div className="mt-8 flex items-center justify-between gap-4"><div className="flex gap-5 border-b border-border"><button type="button" data-testid="button-tab-tools" onClick={() => setTab('tools')} className={`border-b-2 px-1 pb-3 text-sm ${tab === 'tools' ? 'border-black text-foreground' : 'border-transparent text-muted-foreground'}`}>Tools <span className="ml-1 text-xs">({tools.length})</span></button><button type="button" data-testid="button-tab-categories" onClick={() => setTab('categories')} className={`border-b-2 px-1 pb-3 text-sm ${tab === 'categories' ? 'border-black text-foreground' : 'border-transparent text-muted-foreground'}`}>Categories <span className="ml-1 text-xs">({categories.length})</span></button></div><button type="button" data-testid={`button-add-${tab}`} onClick={() => tab === 'tools' ? openTool() : openCategory()} className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white"><Plus className="h-4 w-4" /> Add {tab === 'tools' ? 'tool' : 'category'}</button></div>
    {tab === 'tools' ? <div className="mt-5 overflow-x-auto border border-border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-secondary text-[11px] text-muted-foreground"><tr><th className="px-5 py-4">Tool</th><th className="px-5 py-4">Shelf</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Featured</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody>{tools.map((tool) => <tr key={tool.id} data-testid={`row-tool-${tool.id}`} className="border-t border-border hover:bg-secondary/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><Logo tool={tool} size="sm" /><div><div className="font-medium">{tool.name}</div><div className="max-w-[280px] truncate text-xs text-muted-foreground">{tool.shortDescription}</div></div></div></td><td className="px-5 py-4 text-xs text-muted-foreground">{tool.categoryName}</td><td className="px-5 py-4"><button type="button" onClick={() => updateTool.mutate({ id: tool.id, data: { status: tool.status === 'published' ? 'draft' : 'published' } }, { onSuccess: refresh })} className="border border-border px-2.5 py-1 text-[10px] uppercase">{tool.status}</button></td><td className="px-5 py-4"><button type="button" aria-label="Toggle featured" onClick={() => updateTool.mutate({ id: tool.id, data: { featured: !tool.featured } }, { onSuccess: refresh })} className={tool.featured ? 'text-black' : 'text-muted-foreground'}><Star className="h-4 w-4" fill={tool.featured ? 'currentColor' : 'none'} /></button></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => openTool(tool)} className="mr-3 text-muted-foreground hover:text-foreground"><Edit3 className="inline h-4 w-4" /></button><button type="button" onClick={() => { if (window.confirm(`Delete ${tool.name}?`)) deleteTool.mutate({ id: tool.id }, { onSuccess: refresh }); }} className="text-muted-foreground hover:text-red-600"><Trash2 className="inline h-4 w-4" /></button></td></tr>)}</tbody></table></div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{categories.map((category) => <div key={category.id} data-testid={`card-category-${category.id}`} className="border border-border bg-card p-5"><div className="flex items-start justify-between"><div><span className="mb-3 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: category.accent || '#000' }} /><h2 className="text-xl font-semibold">{category.name}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{category.description}</p></div><span className="text-xs text-muted-foreground">{category.toolCount} tools</span></div><div className="mt-5 flex gap-3"><button type="button" onClick={() => openCategory(category)} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><Edit3 className="h-3.5 w-3.5" /> Edit</button><button type="button" onClick={() => { if (window.confirm(`Delete ${category.name}?`)) deleteCategory.mutate({ id: category.id }, { onSuccess: refresh }); }} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button></div></div>)}</div>}
  </main>{toolOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/20 p-4"><form onSubmit={saveTool} className="mx-auto my-8 max-w-4xl border border-border bg-card p-6 shadow-xl md:p-8"><div className="flex justify-between"><div><span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{editingTool ? 'Edit tool' : 'New tool'}</span><h2 className="mt-2 text-2xl font-semibold">{editingTool ? editingTool.name : 'Add a tool'}</h2></div><button type="button" onClick={() => setToolOpen(false)}><X className="text-muted-foreground" /></button></div><div className="mt-7 grid gap-4 md:grid-cols-2"><Field label="Name" value={toolForm.name} onChange={(v) => setTool('name', v)} required /><Field label="Website URL" value={toolForm.websiteUrl} onChange={(v) => setTool('websiteUrl', v)} required /><Field label="Short description" value={toolForm.shortDescription} onChange={(v) => setTool('shortDescription', v)} required /><Field label="Logo URL (optional)" value={toolForm.logoUrl} onChange={(v) => setTool('logoUrl', v)} /><Field label="Description" value={toolForm.description} onChange={(v) => setTool('description', v)} area required /><Field label="How it works" value={toolForm.howItWorks} onChange={(v) => setTool('howItWorks', v)} area required /><Field label="Best for" value={toolForm.bestFor} onChange={(v) => setTool('bestFor', v)} /><Field label="Pricing" value={toolForm.pricing} onChange={(v) => setTool('pricing', v)} required /><label className="block text-xs text-muted-foreground"><span className="mb-1.5 block text-[11px] font-medium text-foreground">Category</span><select value={toolForm.categoryId} onChange={(e) => setTool('categoryId', e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-xs text-muted-foreground"><span className="mb-1.5 block text-[11px] font-medium text-foreground">Homepage preview / poster</span><input type="file" accept="image/*" onChange={readPreview} className="block w-full rounded-md border border-dashed border-border bg-background p-2 text-xs" /><span className="mt-2 block">Upload an image under 3 MB, or use the preview URL below.</span></label><Field label="Preview URL (optional)" value={toolForm.previewUrl} onChange={(v) => setTool('previewUrl', v)} /><label className="flex items-center gap-3 self-end text-sm"><input type="checkbox" checked={toolForm.featured} onChange={(e) => setTool('featured', e.target.checked)} className="h-4 w-4 accent-black" /> Feature on the homepage</label></div>{toolForm.previewUrl && <div className="mt-5 overflow-hidden border border-border"><img src={toolForm.previewUrl} alt="Selected homepage preview" className="max-h-56 w-full object-cover" /></div>}<button disabled={busy} type="submit" className="mt-7 inline-flex items-center gap-2 rounded-md bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50"><Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save tool'}</button></form></div>}{categoryOpen && <div className="fixed inset-0 z-50 bg-black/20 p-4"><form onSubmit={saveCategory} className="mx-auto my-20 max-w-lg border border-border bg-card p-6 shadow-xl"><div className="flex justify-between"><div><span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{editingCategory ? 'Edit category' : 'New category'}</span><h2 className="mt-2 text-2xl font-semibold">Shape a shelf</h2></div><button type="button" onClick={() => setCategoryOpen(false)}><X className="text-muted-foreground" /></button></div><div className="mt-7 space-y-4"><Field label="Name" value={categoryForm.name} onChange={(v) => setCategory('name', v)} required /><Field label="Description" value={categoryForm.description} onChange={(v) => setCategory('description', v)} area required /><Field label="Accent color" value={categoryForm.accent} onChange={(v) => setCategory('accent', v)} /></div><button disabled={busy} type="submit" className="mt-7 inline-flex items-center gap-2 rounded-md bg-black px-5 py-3 text-sm font-medium text-white"><FolderPlus className="h-4 w-4" /> Save category</button></form></div>}</Shell>;
}