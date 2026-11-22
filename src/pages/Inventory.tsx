import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, call } from '../api/client';
import { useAuth } from '../auth';
import { bdt, parseBdt, parseQty, qtyFmt } from '../lib/money';

type P = { productId: string; sku: string; name: string; category: string; brand: string; unit: string; sellingPrice: number; qty: number; minStock: number; low: boolean; isActive: boolean; purchasePrice?: number; value?: number; avgCost?: number };
const box = 'rounded-md border border-slate-300 px-3 py-2', btn = 'rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-60';
const REASONS: [string, string][] = [['DAMAGED', 'Damaged'], ['LOST', 'Lost / theft'], ['EXPIRED', 'Expired / obsolete'], ['COUNT_CORRECTION', 'Count correction'], ['FOUND', 'Found stock'], ['OTHER', 'Other']];
const empty = { id: '', sku: '', name: '', category: '', brand: '', unit: 'pcs', purchase: '', selling: '', min: '' };

// ═══ Tab 1: product list, search, low stock, add/edit (Admin) ═══
function Products({ admin }: { admin: boolean }) {
  const [list, setList] = useState<P[]>([]); const [search, setSearch] = useState(''); const [low, setLow] = useState(false); const [inactive, setInactive] = useState(false);
  const [f, setF] = useState(empty); const [err, setErr] = useState('');
  const load = () => call<P[]>('listProducts', { search, lowOnly: low, includeInactive: inactive }).then(setList).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [search, low, inactive]);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault(); setErr('');
    const selling = parseBdt(f.selling), purchase = f.purchase ? parseBdt(f.purchase) : 0, min = f.min ? parseQty(f.min) : 0;
    if (selling === null || purchase === null || min === null) return setErr('Prices need up to 2 decimals, stock levels up to 3.');
    try {
      const body = { sku: f.sku, name: f.name, category: f.category, brand: f.brand, unit: f.unit, sellingPrice: selling, purchasePrice: purchase, minStock: min };
      await call(f.id ? 'updateProduct' : 'createProduct', f.id ? { productId: f.id, ...body } : body);
      setF(empty); load();
    } catch (x: any) { setErr(x.message); }
  }
  const edit = (p: P) => setF({ id: p.productId, sku: p.sku, name: p.name, category: p.category, brand: p.brand, unit: p.unit, purchase: ((p.purchasePrice || 0) / 100).toFixed(2), selling: (p.sellingPrice / 100).toFixed(2), min: String(p.minStock / 1000) });
  const toggle = (p: P) => call('setProductActive', { productId: p.productId, isActive: !p.isActive }).then(load).catch(x => setErr(x.message));

  return (
    <div className="space-y-4">
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {admin && <form onSubmit={save} className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-4">
        <h3 className="col-span-full font-medium">{f.id ? 'Edit product' : 'Add product'}</h3>
        <input className={box} placeholder="SKU / code" value={f.sku} onChange={set('sku')} required />
        <input className={box + ' col-span-1 sm:col-span-2'} placeholder="Name" value={f.name} onChange={set('name')} required />
        <input className={box} placeholder="Unit (pcs, m, kg…)" value={f.unit} onChange={set('unit')} required />
        <input className={box} placeholder="Category" value={f.category} onChange={set('category')} />
        <input className={box} placeholder="Brand" value={f.brand} onChange={set('brand')} />
        <input className={box} placeholder="Purchase price ৳" inputMode="decimal" value={f.purchase} onChange={set('purchase')} />
        <input className={box} placeholder="Selling price ৳" inputMode="decimal" value={f.selling} onChange={set('selling')} required />
        <input className={box} placeholder="Minimum stock" inputMode="decimal" value={f.min} onChange={set('min')} />
        <div className="col-span-full flex gap-2"><button className={btn}>{f.id ? 'Save changes' : 'Add product'}</button>{f.id && <button type="button" className="underline" onClick={() => setF(empty)}>Cancel</button>}</div>
      </form>}
      <div className="flex flex-wrap items-center gap-3">
        <input className={box} placeholder="Search name or code" value={search} onChange={e => setSearch(e.target.value)} />
        <label className="text-sm"><input type="checkbox" checked={low} onChange={e => setLow(e.target.checked)} /> Low stock only</label>
        {admin && <label className="text-sm"><input type="checkbox" checked={inactive} onChange={e => setInactive(e.target.checked)} /> Show disabled</label>}
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr className="border-b"><th className="p-2">Product</th><th>Stock</th><th>Selling</th>{admin && <><th>Purchase</th><th>Avg cost</th><th>Value</th><th></th></>}</tr></thead>
        <tbody>{list.map(p => (<tr key={p.productId} className={'border-b ' + (p.isActive ? '' : 'opacity-50')}>
          <td className="p-2">{p.name}<div className="text-slate-500">{p.sku}{p.category ? ' · ' + p.category : ''}{p.brand ? ' · ' + p.brand : ''}</div></td>
          <td>{qtyFmt(p.qty)} {p.unit} {p.low && <span className="ml-1 rounded bg-red-100 px-1 text-red-800">Low</span>}</td>
          <td>{bdt(p.sellingPrice)}</td>
          {admin && <><td>{bdt(p.purchasePrice || 0)}</td><td>{bdt(p.avgCost || 0)}</td><td>{bdt(p.value || 0)}</td>
            <td className="space-x-3 whitespace-nowrap p-2"><button className="underline" onClick={() => edit(p)}>Edit</button><button className="underline" onClick={() => toggle(p)}>{p.isActive ? 'Disable' : 'Enable'}</button></td></>}
        </tr>))}</tbody></table>
        {!list.length && <p className="p-3 text-slate-500">No products found.</p>}
      </div>
    </div>
  );
}

// ═══ Tab 2: stock adjustment (Admin). Reason + note are mandatory; the server posts the accounting entry ═══
function Adjust() {
  const [list, setList] = useState<P[]>([]); const [pid, setPid] = useState(''); const [qty, setQty] = useState(''); const [cost, setCost] = useState('');
  const [reason, setReason] = useState('DAMAGED'); const [note, setNote] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const key = useRef(crypto.randomUUID());               // one key per attempt: a retry after a network failure cannot double-post
  useEffect(() => { call<P[]>('listProducts', {}).then(setList); }, []);
  const p = list.find(x => x.productId === pid), q = parseQty(qty, true);
  const needCost = !!p && q !== null && q > 0 && (p.qty === 0 || !p.value);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    if (!p || q === null || q === 0) return setErr('Choose a product and enter a quantity such as -3 or 2.5.');
    const unitCost = needCost ? parseBdt(cost) : undefined;
    if (needCost && !unitCost) return setErr('Enter the unit cost in ৳.');
    try {
      const r = await call<{ adjustmentId: string; totalValueChange: number }>('adjustStock', { reasonCode: reason, reasonNote: note, items: [{ productId: pid, qtyChange: q, unitCost }] }, key.current);
      setMsg(`Posted ${r.adjustmentId}. Stock value changed by ${bdt(r.totalValueChange)}.`); setQty(''); setCost(''); setNote('');
      key.current = crypto.randomUUID(); call<P[]>('listProducts', {}).then(setList);
    } catch (x: any) { setErr(x.message); if (!(x instanceof ApiError) || x.code !== 'NETWORK') key.current = crypto.randomUUID(); }
  }
  return (
    <form onSubmit={submit} className="max-w-md space-y-3">
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}{msg && <p className="text-sm text-green-700">{msg}</p>}
      <select className={box + ' w-full'} value={pid} onChange={e => setPid(e.target.value)} required><option value="">Choose product…</option>{list.map(x => <option key={x.productId} value={x.productId}>{x.name} ({x.sku}), {qtyFmt(x.qty)} {x.unit}</option>)}</select>
      <input className={box + ' w-full'} placeholder="Quantity change: -3 to remove, 2 to add" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} required />
      {needCost && <input className={box + ' w-full'} placeholder={`Unit cost ৳ (no stock to average from)`} inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} />}
      <select className={box + ' w-full'} value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <textarea className={box + ' w-full'} placeholder="Explain what happened (required, 5+ characters)" value={note} onChange={e => setNote(e.target.value)} required minLength={5} />
      <button className={btn}>Post adjustment</button>
    </form>
  );
}

// ═══ Tab 3: inventory valuation report (Admin) ═══
type R = { asOf: string; totalValue: number; ledgerValue: number; matches: boolean; rows: { productId: string; sku: string; name: string; unit: string; qty: number; avgCost: number; value: number; sellingPrice: number; minStock: number; low: boolean }[] };
function Valuation() {
  const [asOf, setAsOf] = useState(''); const [r, setR] = useState<R | null>(null); const [err, setErr] = useState('');
  const run = () => { setErr(''); call<R>('inventoryValuation', asOf ? { asOf } : {}).then(setR).catch(e => setErr(e.message)); };
  useEffect(run, []);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><label className="text-sm">As of</label><input type="date" className={box} value={asOf} onChange={e => setAsOf(e.target.value)} /><button className={btn} onClick={run}>Show</button></div>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {r && <>
        <p className="text-sm">Total stock value <b>{bdt(r.totalValue)}</b> as of {r.asOf}. Ledger (Inventory account): {bdt(r.ledgerValue)}{' '}
          <span className={r.matches ? 'text-green-700' : 'font-semibold text-red-700'}>{r.matches ? '✓ matches' : '✗ DIFFERS: run reconciliation'}</span></p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Product</th><th>Qty</th><th>Avg cost</th><th>Value</th><th>Selling</th><th>Min</th></tr></thead>
          <tbody>{r.rows.map(x => <tr key={x.productId} className="border-b"><td className="p-2">{x.name}<div className="text-slate-500">{x.sku}</div></td><td>{qtyFmt(x.qty)} {x.unit} {x.low && <span className="rounded bg-red-100 px-1 text-red-800">Low</span>}</td><td>{bdt(x.avgCost)}</td><td>{bdt(x.value)}</td><td>{bdt(x.sellingPrice)}</td><td>{qtyFmt(x.minStock)}</td></tr>)}</tbody></table></div></>}
    </div>
  );
}

export default function Inventory() {
  const admin = useAuth().user?.role === 'ADMIN';
  const [tab, setTab] = useState<'p' | 'a' | 'v'>('p');
  const t = (k: 'p' | 'a' | 'v', label: string) => <button key={k} onClick={() => setTab(k)} className={'rounded px-3 py-1 ' + (tab === k ? 'bg-slate-900 text-white' : 'hover:bg-slate-200')}>{label}</button>;
  return (<div className="space-y-4"><h2 className="text-xl font-semibold">Inventory</h2>
    <div className="flex gap-1">{t('p', 'Products')}{admin && t('a', 'Adjust stock')}{admin && t('v', 'Valuation')}</div>
    {tab === 'p' ? <Products admin={admin} /> : tab === 'a' ? <Adjust /> : <Valuation />}</div>);
}
