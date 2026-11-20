// ═══ Password key derivation (runs in the browser; the password never leaves it) ═══
// PBKDF2-SHA256, 600,000 iterations (OWASP 2023). Must match the backend's MIN_ITERATIONS and key format.
const enc = new TextEncoder();
export const ITERATIONS = 600000;

export function randomSalt(): string {            // 16 random bytes as 32 hex chars
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
}
export async function deriveKey(password: string, saltHex: string, iterations: number): Promise<string> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(saltHex), iterations }, base, 256);
  let s = ''; new Uint8Array(bits).forEach(c => (s += String.fromCharCode(c)));
  return btoa(s);                                  // 44-char base64, the format the server expects
}
