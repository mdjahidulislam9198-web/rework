// ═══ Money and quantity helpers: the browser shows/enters decimals; the server only ever sees integers ═══
// Money = integer poisha (1 BDT = 100). Quantity = integer thousandths (1.5 = 1500).
export const bdt = (p: number) => '৳' + (p / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const qtyFmt = (m: number) => (m / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 });
export function parseBdt(s: string): number | null {          // "1,234.5" → 123450; invalid → null
  const t = s.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [i, f = ''] = t.split('.');
  return Number(i) * 100 + Number((f + '00').slice(0, 2));
}
export function parseQty(s: string, signed = false): number | null {   // "2.5" → 2500; "-3" (if signed) → -3000
  const t = s.trim();
  if (!(signed ? /^-?\d+(\.\d{1,3})?$/ : /^\d+(\.\d{1,3})?$/).test(t)) return null;
  const [i, f = ''] = t.replace('-', '').split('.');
  const v = Number(i) * 1000 + Number((f + '000').slice(0, 3));
  return t.startsWith('-') ? -v : v;
}
