import { useState, type FormEvent } from 'react';
import { call } from '../api/client';
import { deriveKey, randomSalt, ITERATIONS } from '../lib/crypto';
import { useAuth } from '../auth';

const field = 'w-full rounded-md border border-slate-300 px-3 py-2';

// Change your own password. Keys are derived in the browser; other sessions of this user are ended by the server.
export default function Account() {
  const { user } = useAuth();
  const [oldPw, setOld] = useState(''); const [newPw, setNew] = useState(''); const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    if (newPw.length < 10) return setMsg({ ok: false, text: 'New password must be at least 10 characters.' });
    if (newPw !== confirm) return setMsg({ ok: false, text: 'The two new passwords do not match.' });
    setBusy(true);
    try {
      const p = await call<{ salt: string; iterations: number }>('getLoginParams', { username: user!.username });
      const oldKey = await deriveKey(oldPw, p.salt, p.iterations);
      const newSalt = randomSalt(); const newKey = await deriveKey(newPw, newSalt, ITERATIONS);
      await call('changePassword', { oldKey, newKey, newSalt, iterations: ITERATIONS });
      setOld(''); setNew(''); setConfirm('');
      setMsg({ ok: true, text: 'Password changed. Your other sign-ins were ended.' });
    } catch (err: any) { setMsg({ ok: false, text: err.message }); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <h2 className="text-xl font-semibold">Change password</h2>
      <input className={field} type="password" placeholder="Current password" autoComplete="current-password" value={oldPw} onChange={e => setOld(e.target.value)} required />
      <input className={field} type="password" placeholder="New password (10+ characters)" autoComplete="new-password" value={newPw} onChange={e => setNew(e.target.value)} required />
      <input className={field} type="password" placeholder="Repeat new password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
      {msg && <p role="alert" className={'text-sm ' + (msg.ok ? 'text-green-700' : 'text-red-700')}>{msg.text}</p>}
      <button disabled={busy} className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{busy ? 'Please wait…' : 'Change password'}</button>
    </form>
  );
}
