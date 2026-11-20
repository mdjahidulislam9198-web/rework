// ═══ API LAYER: the ONLY place the frontend talks to the backend ═══
// Swap point: to move to Supabase later, re-implement call() and keep its signature.
// Request format is the one proven by the connectivity test: POST, text/plain, no custom headers.
export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
const API_URL = import.meta.env.VITE_API_URL as string;
const KEY = 'store.token';
export const session = {
  get: () => sessionStorage.getItem(KEY),          // cleared when the tab closes
  set: (t: string) => sessionStorage.setItem(KEY, t),
  clear: () => sessionStorage.removeItem(KEY),
};
let onAuthLost: () => void = () => {};
export const setAuthLostHandler = (f: () => void) => { onAuthLost = f; };

// requestKey: one per user action. If a write must be retried, pass the SAME key (duplicate protection).
export async function call<T = any>(action: string, payload: object = {}, requestKey: string = crypto.randomUUID()): Promise<T> {
  if (!API_URL) throw new ApiError('CONFIG', 'API address is not configured (VITE_API_URL).');
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 30000);
  let body: any;
  try {
    const r = await fetch(API_URL, {
      method: 'POST', redirect: 'follow', credentials: 'omit', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, token: session.get(), requestKey, apiVersion: '1.0' }),
    });
    body = await r.json();
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server. Check your connection and try again.');
  } finally { clearTimeout(timer); }
  if (!body.ok) {
    if (body.code === 'UNAUTHENTICATED' || body.code === 'SESSION_EXPIRED') { session.clear(); onAuthLost(); }
    throw new ApiError(body.code, body.message);
  }
  return body.data as T;
}
