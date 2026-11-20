// ═══ AUTH STATE: who is logged in, login / activate / logout ═══
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { call, session, setAuthLostHandler } from './api/client';
import { deriveKey, randomSalt, ITERATIONS } from './lib/crypto';

export type User = { id: string; username: string; fullName: string; role: 'ADMIN' | 'STAFF'; expiresAt: string };
type Ctx = {
  user: User | null; loading: boolean;
  login: (u: string, p: string) => Promise<void>;
  activate: (u: string, code: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {                                   // restore session after a page refresh
    setAuthLostHandler(() => setUser(null));
    if (!session.get()) { setLoading(false); return; }
    call<User>('me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const p = await call<{ salt: string; iterations: number }>('getLoginParams', { username });
    const key = await deriveKey(password, p.salt, p.iterations);
    const r = await call<{ token: string; expiresAt: string; user: Omit<User, 'expiresAt'> }>('login', { username, key });
    session.set(r.token);
    setUser({ ...r.user, expiresAt: r.expiresAt });
  }
  async function activate(username: string, setupCode: string, password: string) {
    const salt = randomSalt();
    const key = await deriveKey(password, salt, ITERATIONS);
    await call('activateAccount', { username, setupCode, key, salt, iterations: ITERATIONS });
    await login(username, password);
  }
  async function logout() {
    try { await call('logout'); } catch { /* already expired is fine */ }
    session.clear(); setUser(null);
  }
  return <AuthCtx.Provider value={{ user, loading, login, activate, logout }}>{children}</AuthCtx.Provider>;
}
