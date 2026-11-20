import { useEffect, useState, type FormEvent } from 'react';
import { call } from '../api/client';

type U = { id: string; username: string; fullName: string; role: string; isActive: boolean; activated: boolean; locked: boolean };
const field = 'rounded-md border border-slate-300 px-3 py-2';

// Admin screen: create users, reset passwords (new one-time code), activate/deactivate.
export default function Users() {
  const [users, setUsers] = useState<U[]>([]); const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [username, setUsername] = useState(''); const [fullName, setFullName] = useState(''); const [role, setRole] = useState('STAFF');

  const load = () => call<U[]>('listUsers').then(setUsers).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  async function run(fn: () => Promise<any>, show?: (r: any) => string) {
    setError(''); setNotice('');
    try { const r = await fn(); if (show) setNotice(show(r)); await load(); } catch (e: any) { setError(e.message); }
  }
  const codeMsg = (name: string) => (r: any) => `Setup code for ${name}: ${r.setupCode}  (shown once, valid 24 hours). Give it to the user privately.`;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Users</h2>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-md bg-amber-100 p-3 font-mono text-sm">{notice}</p>}
      <form className="flex flex-wrap gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => call('createUser', { username, fullName, role }), codeMsg(username)); setUsername(''); setFullName(''); }}>
        <input className={field} placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
        <input className={field} placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} required />
        <select className={field} value={role} onChange={e => setRole(e.target.value)}><option>STAFF</option><option>ADMIN</option></select>
        <button className="rounded-md bg-slate-900 px-4 py-2 text-white">Add user</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b"><th className="p-2">User</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id} className="border-b">
              <td className="p-2">{u.fullName}<div className="text-slate-500">{u.username}</div></td>
              <td>{u.role}</td>
              <td>{!u.isActive ? 'Disabled' : u.locked ? 'Locked' : u.activated ? 'Active' : 'Waiting for activation'}</td>
              <td className="space-x-3 whitespace-nowrap p-2">
                <button className="underline" onClick={() => run(() => call('resetSetupCode', { userId: u.id }), codeMsg(u.username))}>Reset password</button>
                <button className="underline" onClick={() => run(() => call('setUserActive', { userId: u.id, isActive: !u.isActive }))}>{u.isActive ? 'Disable' : 'Enable'}</button>
              </td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
