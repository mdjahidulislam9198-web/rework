import { parseBdt } from '../lib/money';

// ═══ Split-payment rows: one row per payment method (cash, bank, bKash, Nagad). Shared by POS and Receive payment ═══
export type PayLine = { method: string; amount: string; ref: string };
export type Method = { code: string; label: string };
export const emptyLine = (method = 'CASH'): PayLine => ({ method, amount: '', ref: '' });

// Converts the typed rows to what the server expects (integer poisha). Blank rows are ignored.
export function toPayload(lines: PayLine[]): { ok: true; lines: { method: string; amount: number; reference: string }[]; total: number } | { ok: false; error: string } {
  const out: { method: string; amount: number; reference: string }[] = []; let total = 0;
  for (const l of lines) {
    if (!l.amount.trim()) continue;
    const a = parseBdt(l.amount);
    if (!a) return { ok: false, error: 'Payment amounts must be above zero with up to 2 decimals.' };
    out.push({ method: l.method, amount: a, reference: l.ref }); total += a;
  }
  return { ok: true, lines: out, total };
}

const box = 'rounded-md border border-slate-300 px-3 py-2';
export default function PayLines({ methods, lines, onChange }: { methods: Method[]; lines: PayLine[]; onChange: (l: PayLine[]) => void }) {
  const set = (i: number, k: keyof PayLine, v: string) => onChange(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select className={box} value={l.method} onChange={e => set(i, 'method', e.target.value)}>{methods.map(m => <option key={m.code} value={m.code}>{m.label}</option>)}</select>
          <input className={box + ' w-32'} placeholder="Amount ৳" inputMode="decimal" value={l.amount} onChange={e => set(i, 'amount', e.target.value)} />
          <input className={box + ' w-44'} placeholder="Reference (optional)" value={l.ref} onChange={e => set(i, 'ref', e.target.value)} />
          {lines.length > 1 && <button type="button" className="text-sm underline" onClick={() => onChange(lines.filter((_, j) => j !== i))}>Remove</button>}
        </div>
      ))}
      <button type="button" className="text-sm underline" onClick={() => onChange([...lines, emptyLine(methods[0]?.code)])}>+ Add another payment method</button>
    </div>
  );
}
