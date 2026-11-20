import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

const field = 'w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-700';

export default function Login() {
  const { user, login, activate } = useAuth();
  const [mode, setMode] = useState<'login' | 'activate'>('login');
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(''); const [code, setCode] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    const u = username.trim().toLowerCase();
    if (mode === 'activate') {                        // client-side checks; the server re-checks everything
      if (password.length < 10) return setError('Choose a password of at least 10 characters.');
      if (password !== confirm) return setError('The two passwords do not match.');
    }
    setBusy(true);
    try { if (mode === 'login') await login(u, password); else await activate(u, code, password); }
    catch (err: any) { setError(err.message || 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-2xl font-semibold">Electrical Store</h1>
      <p className="mb-6 text-slate-600">{mode === 'login' ? 'Sign in to continue.' : 'Activate your account with the setup code from your Admin.'}</p>
      <form onSubmit={submit} className="space-y-3">
        <input className={field} placeholder="Username" autoCapitalize="none" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required />
        {mode === 'activate' && <input className={field} placeholder="Setup code (XXXX-XXXX-XXXX)" autoCapitalize="characters" value={code} onChange={e => setCode(e.target.value)} required />}
        <input className={field} type="password" placeholder={mode === 'login' ? 'Password' : 'Choose a password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required />
        {mode === 'activate' && <input className={field} type="password" placeholder="Repeat password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-md bg-slate-900 px-3 py-2 text-white disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Activate and sign in'}
        </button>
      </form>
      <button className="mt-4 text-sm text-slate-600 underline" onClick={() => { setMode(mode === 'login' ? 'activate' : 'login'); setError(''); }}>
        {mode === 'login' ? 'First time? Activate account' : 'Back to sign in'}
      </button>
    </main>
  );
}
