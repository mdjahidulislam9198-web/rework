import { useEffect, useRef, useState } from 'react';
import { ApiError, call } from '../api/client';
import { useAuth } from '../auth';
import { bdt, parseBdt, parseQty, qtyFmt } from '../lib/money';
import PayLines, { emptyLine, toPayload, type Method, type PayLine } from '../components/PayLines';

type Prod = { productId: string; sku: string; name: string; unit: string; sellingPrice: number; qty: number };
type Cust = { customerId: string; name: string; phone: string; isWalkIn: boolean; outstanding: number };
type Line = { p: Prod; qty: string; price: string; disc: string };
const WALK = 'CUS-000001', box = 'rounded-md border border-slate-300 px-3 py-2', btn = 'rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-60';

// ═══ POINT OF SALE ═══  The server prices and totals everything; this screen only says WHAT was sold and HOW it was paid.
export default function Pos() {
  const admin = useAuth().user?.role === 'ADMIN';
  const [prods, setProds] = useState<Prod[]>([]); const [custs, setCusts] = useState<Cust[]>([]); const [methods, setMethods] = useState<Method[]>([]);
  const [q, setQ] = useState(''); const [cart, setCart] = useState<Line[]>([]); const [cid, setCid] = useState(WALK);
  const [invDisc, setInvDisc] = useState(''); const [due, setDue] = useState(''); const [pays, setPays] = useState<PayLine[]>([emptyLine()]);
  const [quote, setQuote] = useState<any>(null); const [err, setErr] = useState(''); const [done, setDone] = useState<any>(null); const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const loadProds = () => call<Prod[]>('listProducts', {}).then(setProds);
  useEffect(() => {
    loadProds(); call<Cust[]>('listCustomers', {}).then(setCusts);
    call<Method[]>('listPaymentMethods', {}).then(m => { setMethods(m); setPays([emptyLine(m[0]?.code)]); });
  }, []);

  // What the server needs to price the sale.
  function payload(): any | null {
    const items: any[] = [];
    for (const l of cart) {
      const qty = parseQty(l.qty); if (!qty) return null;
      const disc = l.disc.trim() ? parseBdt(l.disc) : 0; if (disc === null) return null;
      const it: any = { productId: l.p.productId, qty }; if (disc) it.discount = disc;
      if (admin) { const pr = parseBdt(l.price); if (pr !== null && pr !== l.p.sellingPrice) it.unitPrice = pr; }   // only an Admin may change a price
      items.push(it);
    }
    const inv = invDisc.trim() ? parseBdt(invDisc) : 0; if (inv === null) return null;
    const b: any = { customerId: cid, items }; if (inv) b.invoiceDiscount = inv;
    return b;
  }
  // Exact total from the server (VAT, discounts, rounding), refreshed shortly after every change.
  useEffect(() => {
    key.current = crypto.randomUUID();                       // any change = a new sale attempt, so a retry can never reuse an old key
    setQuote(null); if (!cart.length) return; const b = payload(); if (!b) return;
    const t = setTimeout(() => { call('quoteSale', b).then(r => { setQuote(r); setErr(''); }).catch((e: any) => setErr(e.message)); }, 400);
    return () => clearTimeout(t);
  }, [cart, cid, invDisc]);
  useEffect(() => { key.current = crypto.randomUUID(); }, [pays, due]);

  const matches = q.trim() ? prods.filter(p => (p.name + ' ' + p.sku).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const add = (p: Prod) => { setDone(null); setQ(''); setCart(c => { const i = c.findIndex(l => l.p.productId === p.productId);
    return i >= 0 ? c.map((l, j) => (j === i ? { ...l, qty: String((parseQty(l.qty) || 0) / 1000 + 1) } : l)) : [...c, { p, qty: '1', price: (p.sellingPrice / 100).toFixed(2), disc: '' }]; }); };
  const setLine = (i: number, k: 'qty' | 'price' | 'disc', v: string) => setCart(cart.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const pp = toPayload(pays), paid = pp.ok ? pp.total : 0, total = quote ? quote.total : null, dueAmt = total === null ? null : total - paid;

  async function sell() {
    setErr(''); const b = payload();
    if (!b) return setErr('Check quantities and discounts (numbers only).'); if (!pp.ok) return setErr(pp.error);
    setBusy(true);
    try {
      const r = await call('createSale', { ...b, payments: pp.lines, dueDate: due || undefined }, key.current);
      setDone(r); setCart([]); setInvDisc(''); setDue(''); setPays([emptyLine(methods[0]?.code)]); setCid(WALK); loadProds();
    } catch (e: any) {
      setErr(e.message + (e instanceof ApiError && e.code === 'NETWORK' ? ' Press Sell again once. The same key means it cannot be saved twice.' : ''));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Sell</h2>
      {done && <div className="rounded-md bg-green-50 p-3 text-green-900">Sale saved. Invoice <b>{done.invoiceNo}</b>: total {bdt(done.total)}, paid {bdt(done.paid)}{done.due > 0 && <>, <b>due {bdt(done.due)}</b> (by {done.dueDate})</>}.</div>}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <div className="relative"><input className={box + ' w-full'} placeholder="Search product by name or code…" value={q} onChange={e => setQ(e.target.value)} />
        {!!matches.length && <ul className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow">{matches.map(p => (
          <li key={p.productId}><button className="flex w-full justify-between px-3 py-2 text-left hover:bg-slate-100 disabled:opacity-50" disabled={p.qty <= 0} onClick={() => add(p)}>
            <span>{p.name} <span className="text-slate-500">{p.sku}</span></span><span>{bdt(p.sellingPrice)} · {qtyFmt(p.qty)} {p.unit}</span></button></li>))}</ul>}</div>
      {!!cart.length && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Item</th><th>Qty</th><th>Price ৳</th><th>Discount ৳</th><th>Line total</th><th></th></tr></thead>
        <tbody>{cart.map((l, i) => { const lt = quote?.lines?.[i]?.lineGross; return (<tr key={l.p.productId} className="border-b">
          <td className="p-2">{l.p.name}<div className="text-slate-500">{qtyFmt(l.p.qty)} {l.p.unit} in stock</div></td>
          <td><input className={box + ' w-20'} inputMode="decimal" value={l.qty} onChange={e => setLine(i, 'qty', e.target.value)} /></td>
          <td><input className={box + ' w-24'} inputMode="decimal" disabled={!admin} value={l.price} onChange={e => setLine(i, 'price', e.target.value)} title={admin ? '' : 'Only an Admin can change prices'} /></td>
          <td><input className={box + ' w-24'} inputMode="decimal" value={l.disc} onChange={e => setLine(i, 'disc', e.target.value)} /></td>
          <td>{lt === undefined ? '…' : bdt(lt)}</td><td><button className="underline" onClick={() => setCart(cart.filter((_, j) => j !== i))}>Remove</button></td></tr>); })}</tbody></table></div>}
      {!!cart.length && <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><label className="block text-sm text-slate-600">Customer</label>
          <select className={box + ' w-full'} value={cid} onChange={e => setCid(e.target.value)}>{custs.map(c => <option key={c.customerId} value={c.customerId}>{c.name}{c.phone ? ' · ' + c.phone : ''}{c.outstanding ? ' (owes ' + bdt(c.outstanding) + ')' : ''}</option>)}</select>
          <label className="block text-sm text-slate-600">Invoice discount ৳ (optional)</label><input className={box + ' w-full'} inputMode="decimal" value={invDisc} onChange={e => setInvDisc(e.target.value)} />
          {dueAmt !== null && dueAmt > 0 && <><label className="block text-sm text-slate-600">Due date (default: customer's credit days)</label><input type="date" className={box} value={due} onChange={e => setDue(e.target.value)} /></>}</div>
        <div className="space-y-2"><div className="text-lg">Total <b>{total === null ? '…' : bdt(total)}</b>{quote?.vatTotal > 0 && <span className="text-sm text-slate-500"> (incl. VAT {bdt(quote.vatTotal)})</span>}</div>
          <PayLines methods={methods} lines={pays} onChange={setPays} />
          <button type="button" className="text-sm underline" disabled={total === null} onClick={() => setPays([{ ...emptyLine(methods[0]?.code), amount: ((total || 0) / 100).toFixed(2) }])}>Customer pays the full amount</button>
          <div className="text-sm">Paid {bdt(paid)}{dueAmt !== null && (dueAmt > 0 ? <b className="text-amber-700"> · Due {bdt(dueAmt)} (credit)</b> : dueAmt < 0 ? <b className="text-red-700"> · Paid more than the total</b> : ' · Fully paid')}</div>
          <button className={btn} disabled={busy || total === null} onClick={sell}>{busy ? 'Saving…' : 'Sell'}</button></div></div>}
    </div>
  );
}
