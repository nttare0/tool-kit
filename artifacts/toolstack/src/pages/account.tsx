import { useEffect, useState } from 'react';
import { CheckCircle2, CircleUserRound, LockKeyhole, LogOut, Plus, Send, ShieldCheck } from 'lucide-react';
import { useListCategories } from '@workspace/api-client-react';
import type { Category } from '@workspace/api-client-react';
import { Shell } from '@/components/toolstack-ui';

type User = { id: number; email: string; displayName: string; profession: string };
type Submission = { id: number; name: string; websiteUrl: string; status: 'pending' | 'approved' | 'rejected'; reviewNote?: string | null; createdAt: string; previewUrl?: string | null };
type Profile = { user: User; categoryIds: number[] };
type Mode = 'login' | 'register';
type Area = 'profile' | 'submissions' | 'new' | 'security';

async function request<T>(path: string, body?: object, method?: string): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Could not complete this request.');
  return data as T;
}

const control = 'mt-1.5 h-11 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';
const areaControl = 'mt-1.5 min-h-28 w-full resize-y border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';

export default function Account() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [area, setArea] = useState<Area>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authForm, setAuthForm] = useState({ displayName: '', email: '', password: '', profession: '' });
  const [toolForm, setToolForm] = useState({ name: '', websiteUrl: '', shortDescription: '', description: '', howItWorks: '', bestFor: '', pricing: 'Check pricing', logoUrl: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const categories = useListCategories();

  const loadAccount = async () => {
    try {
      const status = await request<{ user: User | null }>('auth/user/status');
      setUser(status.user);
      if (status.user) {
        const [nextProfile, nextSubmissions] = await Promise.all([
          request<Profile>('account/profile'),
          request<Submission[]>('account/submissions'),
        ]);
        setProfile(nextProfile);
        setSubmissions(nextSubmissions);
      } else {
        setProfile(null);
        setSubmissions([]);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load your account.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAccount(); }, []);

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = mode === 'login'
        ? await request<{ user: User }>('auth/user/login', { email: authForm.email, password: authForm.password })
        : await request<{ user: User }>('auth/register', authForm);
      setUser(result.user);
      const [nextProfile, nextSubmissions] = await Promise.all([
        request<Profile>('account/profile'),
        request<Submission[]>('account/submissions'),
      ]);
      setProfile(nextProfile);
      setSubmissions(nextSubmissions);
      setMessage(mode === 'register' ? 'Your account is ready. Choose your interests and start submitting tools.' : 'You are signed in.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await request<Profile>('account/profile', {
        displayName: profile.user.displayName,
        profession: profile.user.profession,
        categoryIds: profile.categoryIds,
      }, 'PATCH');
      setProfile(result);
      setUser(result.user);
      setMessage('Your profile and interests have been saved.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  const submitTool = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const submission = await request<Submission>('submissions', toolForm);
      setSubmissions((items) => [submission, ...items]);
      setToolForm({ name: '', websiteUrl: '', shortDescription: '', description: '', howItWorks: '', bestFor: '', pricing: 'Check pricing', logoUrl: '' });
      setArea('submissions');
      setMessage('Submission received. It is waiting for admin review; you can check its status here.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not submit this tool.');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request('account/password', passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setMessage('Your password has been changed.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await request('auth/user/logout', {}).catch(() => undefined);
    setUser(null);
    setProfile(null);
    setSubmissions([]);
    setMessage('You are signed out.');
    setError('');
  };

  if (loading) return <Shell><main className="mx-auto max-w-7xl px-4 py-20 md:px-8"><div className="h-64 animate-pulse border border-border bg-card" /></main></Shell>;
  if (!user || !profile) return <Shell><main className="mx-auto flex min-h-[65vh] max-w-7xl items-center justify-center px-4 py-12 md:px-8"><form onSubmit={submitAuth} className="w-full max-w-lg border border-border bg-card p-6 md:p-9">
    <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center border border-border bg-background"><CircleUserRound className="h-5 w-5 text-primary" /></span><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Toolstack member</div><h1 className="mt-1 text-2xl font-semibold tracking-[-.05em]">{mode === 'login' ? 'Your account' : 'Create your account'}</h1></div></div>
    <p className="mt-4 text-sm leading-6 text-muted-foreground">Save your interests, submit useful tools, and follow each review from your personal space.</p>
    {mode === 'register' && <label className="mt-5 block text-xs text-muted-foreground">Name<input className={control} autoComplete="name" required value={authForm.displayName} onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })} /></label>}
    <label className="mt-5 block text-xs text-muted-foreground">Email<input className={control} type="email" autoComplete="email" required value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /></label>
    {mode === 'register' && <label className="mt-4 block text-xs text-muted-foreground">Your role or focus<select className={control} value={authForm.profession} onChange={(e) => setAuthForm({ ...authForm, profession: e.target.value })}><option value="">Choose one</option><option>Developer</option><option>Designer</option><option>Writer</option><option>Marketer</option><option>Founder</option><option>Student</option><option>Other</option></select></label>}
    <label className="mt-4 block text-xs text-muted-foreground">Password (8+ characters)<input className={control} type="password" minLength={8} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} /></label>
    {error && <p role="alert" className="mt-4 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="mt-4 border border-primary/30 bg-primary/5 px-3 py-2 text-sm">{message}</p>}
    <button disabled={busy} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
    <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="mt-4 w-full text-sm text-muted-foreground underline underline-offset-4">{mode === 'login' ? 'New here? Create a personal account' : 'Already have an account? Sign in'}</button>
  </form></main></Shell>;

  const nav: Array<[Area, string]> = [['profile', 'Profile'], ['submissions', `My submissions (${submissions.length})`], ['new', 'Submit a tool'], ['security', 'Security']];
  return <Shell><main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
    <header className="flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end"><div><div className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Personal space</div><h1 className="mt-2 text-4xl font-semibold tracking-[-.07em]">Hello, {user.displayName}.</h1><p className="mt-2 text-sm text-muted-foreground">Your profile, tool submissions, and review updates stay private to your account.</p></div><button type="button" onClick={logout} className="inline-flex items-center gap-2 self-start border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground sm:self-auto"><LogOut className="h-3.5 w-3.5" /> Sign out</button></header>
    {(message || error) && <div role={error ? 'alert' : 'status'} className={`mt-5 border px-4 py-3 text-sm ${error ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-primary/30 bg-primary/5'}`}>{error || message}</div>}
    <nav aria-label="Account sections" className="mt-7 flex gap-5 overflow-x-auto border-b border-border">{nav.map(([key, label]) => <button key={key} type="button" onClick={() => { setArea(key); setError(''); setMessage(''); }} className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm ${area === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>)}</nav>

    {area === 'profile' && <form onSubmit={saveProfile} className="mt-8 grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><section><div className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Personal details</div><label className="mt-5 block text-xs text-muted-foreground">Display name<input className={control} value={profile.user.displayName} onChange={(e) => setProfile({ ...profile, user: { ...profile.user, displayName: e.target.value } })} required minLength={2} /></label><label className="mt-4 block text-xs text-muted-foreground">Email address<input className={`${control} opacity-70`} value={profile.user.email} readOnly /></label><label className="mt-4 block text-xs text-muted-foreground">I mostly work as<select className={control} value={profile.user.profession} onChange={(e) => setProfile({ ...profile, user: { ...profile.user, profession: e.target.value } })}><option value="">Choose a role</option><option>Developer</option><option>Designer</option><option>Writer</option><option>Marketer</option><option>Founder</option><option>Student</option><option>Other</option></select></label></section><section><div className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Topics you care about</div><p className="mt-2 text-sm text-muted-foreground">Choose categories to personalize your Toolstack profile.</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{(categories.data || []).map((category: Category) => <label key={category.id} className="flex items-center gap-3 border border-border bg-card p-3 text-sm"><input type="checkbox" checked={profile.categoryIds.includes(category.id)} onChange={(e) => setProfile({ ...profile, categoryIds: e.target.checked ? [...profile.categoryIds, category.id] : profile.categoryIds.filter((id) => id !== category.id) })} className="h-4 w-4 accent-primary" /><span><span className="block font-medium">{category.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{category.description}</span></span></label>)}</div><button disabled={busy} className="mt-6 inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Save profile</button></section></form>}

    {area === 'submissions' && <section className="mt-8"><div className="flex items-end justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground">Your history</div><h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">Tool submissions</h2></div><button type="button" onClick={() => setArea('new')} className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Submit another</button></div>{submissions.length ? <div className="mt-5 grid gap-3">{submissions.map((submission) => <article key={submission.id} className="flex flex-col justify-between gap-4 border border-border bg-card p-5 sm:flex-row sm:items-center"><div><h3 className="font-semibold">{submission.name}</h3><a href={submission.websiteUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-muted-foreground underline underline-offset-2">{submission.websiteUrl}</a><p className="mt-2 text-xs text-muted-foreground">Submitted {new Date(submission.createdAt).toLocaleDateString()}</p>{submission.reviewNote && <p className="mt-3 border-l-2 border-primary pl-3 text-sm text-muted-foreground">Admin note: {submission.reviewNote}</p>}</div><span className={`inline-flex w-fit items-center gap-2 border px-3 py-2 text-[10px] font-mono uppercase tracking-[.12em] ${submission.status === 'pending' ? 'border-amber-500/40 text-amber-700 dark:text-amber-300' : submission.status === 'approved' ? 'border-primary/50 text-primary' : 'border-destructive/40 text-destructive'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{submission.status === 'pending' ? 'Waiting for review' : submission.status}</span></article>)}</div> : <div className="mt-5 border border-dashed border-border p-12 text-center"><p className="font-medium">No submissions yet</p><p className="mt-2 text-sm text-muted-foreground">Submit a tool you think belongs in the directory.</p></div>}</section>}

    {area === 'new' && <section className="mt-8 max-w-4xl"><div className="border border-border bg-primary/5 p-5"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Every tool is reviewed before it goes public</div><p className="mt-2 text-sm leading-6 text-muted-foreground">Your submission will appear as waiting for review. An admin can approve it for the public directory or decline it with a note you can read here.</p></div><form onSubmit={submitTool} className="mt-6 border border-border bg-card p-5 md:p-7"><h2 className="text-xl font-semibold tracking-[-.04em]">Suggest a tool</h2><div className="mt-6 grid gap-4 md:grid-cols-2">
      <label className="block text-xs text-muted-foreground">Tool name<input className={control} required value={toolForm.name} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} /></label>
      <label className="block text-xs text-muted-foreground">Website URL<input type="url" className={control} required placeholder="https://…" value={toolForm.websiteUrl} onChange={(e) => setToolForm({ ...toolForm, websiteUrl: e.target.value })} /></label>
      <label className="block text-xs text-muted-foreground md:col-span-2">Short description<input className={control} required value={toolForm.shortDescription} onChange={(e) => setToolForm({ ...toolForm, shortDescription: e.target.value })} /></label>
      <label className="block text-xs text-muted-foreground">What it does<textarea className={areaControl} required value={toolForm.description} onChange={(e) => setToolForm({ ...toolForm, description: e.target.value })} /></label>
      <label className="block text-xs text-muted-foreground">How it works<textarea className={areaControl} required value={toolForm.howItWorks} onChange={(e) => setToolForm({ ...toolForm, howItWorks: e.target.value })} /></label>
      <label className="block text-xs text-muted-foreground">Best for<input className={control} value={toolForm.bestFor} onChange={(e) => setToolForm({ ...toolForm, bestFor: e.target.value })} /></label>
      <label className="block text-xs text-muted-foreground">Pricing information<input className={control} required value={toolForm.pricing} onChange={(e) => setToolForm({ ...toolForm, pricing: e.target.value })} /></label>
      <label className="block text-xs text-muted-foreground md:col-span-2">Logo URL (optional)<input type="url" className={control} value={toolForm.logoUrl} onChange={(e) => setToolForm({ ...toolForm, logoUrl: e.target.value })} /></label>
    </div><button disabled={busy} className="mt-6 inline-flex items-center gap-2 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /> {busy ? 'Sending…' : 'Submit for review'}</button></form></section>}

    {area === 'security' && <form onSubmit={changePassword} className="mt-8 max-w-lg border border-border bg-card p-6"><div className="flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Change password</h2></div><label className="mt-6 block text-xs text-muted-foreground">Current password<input className={control} type="password" autoComplete="current-password" required value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} /></label><label className="mt-4 block text-xs text-muted-foreground">New password (8+ characters)<input className={control} type="password" autoComplete="new-password" minLength={8} required value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} /></label><button disabled={busy} className="mt-6 bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Saving…' : 'Update password'}</button></form>}
  </main></Shell>;
}