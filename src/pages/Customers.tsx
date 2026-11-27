import { useEffect, useRef, useState, type FormEvent } from 'react';
import { call } from '../api/client';
import { useAuth } from '../auth';
import { bdt, parseBdt } from '../lib/money';
import PayLines, { emptyLine, toPayload, type Method, type PayLine } from '../components/PayLines';

const box = 'rounded-md border border-slate-300 px-3 py-2', btn = 'rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-60';
type C = { customerId: string; name: string; phone: string; address: string; creditDays: number; outstanding: number; isWalkIn: boolean; isActive: boolean };

// ═══ One customer: open invoices, receive a payment (auto = oldest first, or choose invoices), history ═══
function Detail({ id, admin, onChange }: { id: string; admin: boolean; onChange: () => void }) {
  const [d, setD] = useState<any>(null); const [methods, setMethods] = useState<Method[]>([]); const [pays, setPays] = useState<PayLine[]>([emptyLine()]);
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO'); const [alloc, setAlloc] = useState<Record<string, string>>({}); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const key = useRef(crypto.randomUUID());
  const load = () => call('getCustomer', { customerId: id }).then(setD).catch((e: any) => setErr(e.message));
  useEffect(() => { setD(null); setMsg(''); load(); call<Method[]>('listPaymentMethods', {}).then(m => { setMethods(m); setPays([emptyLine(m[0]?.code)]); }); }, [id]);
  useEffect(() => { key.current = crypto.randomUUID(); }, [pays, mode, alloc]);
  if (!d) return <p className="text-slate-500">{err || 'Loading…'}</p>;

  async function receive(e: FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    const pp = toPayload(pays); if (!pp.ok) return setErr(pp.error); if (!pp.total) return setErr('Enter the amount received.');
    const body: any = { customerId: id, lines: pp.lines, mode };
    if (mode === 'MANUAL') body.allocations = Object.entries(alloc).filter(([, v]) => v.trim()).map(([billId, v]) => ({ billId, amount: parseBdt(v) }));
    try { const r: any = await call('receivePayment', body, key.current); setMsg(`Received ${bdt(r.total)} (${r.paymentId}).`); setAlloc({}); setPays([emptyLine(methods[0]?.code)]); load(); onChange(); }
    catch (x: any) { setErr(x.message); }
  }
  async function reverse(txnId: string) {
    const reason = window.prompt('Reason for reversing this receipt (required):'); if (!reason) return;
    try { await call('reverseDocument', { txnId, reason }); load(); onChange(); } catch (x: any) { setErr(x.message); }
  }
  const c = d.customer;
  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <div><h3 className="text-lg font-semibold">{c.name}</h3><p className="text-sm text-slate-600">{c.phone} {c.address && '· ' + c.address} · credit {c.creditDays} days</p><p>Outstanding: <b>{bdt(c.outstanding)}</b></p></div>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}{msg && <p className="text-sm text-green-700">{msg}</p>}
      {!!d.openBills.length && <form onSubmit={receive} className="space-y-3 rounded-md bg-slate-50 p-3"><h4 className="font-medium">Receive payment</h4>
        <PayLines methods={methods} lines={pays} onChange={setPays} />
        <div className="text-sm"><label><input type="radio" checked={mode === 'AUTO'} onChange={() => setMode('AUTO')} /> Oldest invoice first</label>{' '}<label className="ml-4"><input type="radio" checked={mode === 'MANUAL'} onChange={() => setMode('MANUAL')} /> I choose the invoices</label></div>
        <button className={btn}>Receive</button></form>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Open invoice</th><th>Date</th><th>Due</th><th>Total</th><th>Outstanding</th>{mode === 'MANUAL' && <th>Pay ৳</th>}</tr></thead>
        <tbody>{d.openBills.map((b: any) => <tr key={b.billId} className="border-b"><td className="p-2">{b.invoiceNo}{b.docType === 'OPENING' && ' (opening)'}</td><td>{b.date}</td><td>{b.dueDate}</td><td>{bdt(b.total)}</td><td>{bdt(b.open)}</td>
          {mode === 'MANUAL' && <td><input className={box + ' w-24'} inputMode="decimal" value={alloc[b.billId] || ''} onChange={e => setAlloc({ ...alloc, [b.billId]: e.target.value })} /></td>}</tr>)}</tbody></table>
        {!d.openBills.length && <p className="p-2 text-slate-500">No open invoices.</p>}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><h4 className="font-medium">Recent invoices</h4><ul className="text-sm">{d.sales.slice(0, 8).map((s: any) => <li key={s.saleId}>{s.date} · {s.invoiceNo} · {bdt(s.total)} {s.due > 0 && <span className="text-amber-700">(due {bdt(s.due)})</span>}</li>)}</ul></div>
        <div><h4 className="font-medium">Recent payments</h4><ul className="text-sm">{d.payments.slice(0, 8).map((p: any) => <li key={p.paymentId}>{p.date} · {bdt(p.total)} {p.initial ? '(at sale)' : admin && <button className="ml-2 underline" onClick={() => reverse(p.txnId)}>Reverse</button>}</li>)}</ul></div></div>
    </div>
  );
}

export default function Customers() {
  const admin = useAuth().user?.role === 'ADMIN';
  const [list, setList] = useState<C[]>([]); const [search, setSearch] = useState(''); const [sel, setSel] = useState(''); const [err, setErr] = useState('');
  const [f, setF] = useState({ name: '', phone: '', address: '', days: '' });
  const load = () => call<C[]>('listCustomers', { search }).then(setList).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [search]);
  async function add(e: FormEvent) {
    e.preventDefault(); setErr('');
    try { const c: any = await call('createCustomer', { name: f.name, phone: f.phone, address: f.address, ...(f.days ? { creditDays: Number(f.days) } : {}) }); setF({ name: '', phone: '', address: '', days: '' }); load(); setSel(c.customerId); }
    catch (x: any) { setErr(x.message); }
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-4"><h2 className="text-xl font-semibold">Customers</h2>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <form onSubmit={add} className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-3">
        <input className={box} placeholder="Name" value={f.name} onChange={set('name')} required /><input className={box} placeholder="Phone (01XXXXXXXXX)" value={f.phone} onChange={set('phone')} />
        <input className={box} placeholder="Address" value={f.address} onChange={set('address')} /><input className={box + ' w-32'} placeholder="Credit days" inputMode="numeric" value={f.days} onChange={set('days')} />
        <button className={btn}>Add customer</button></form>
      <input className={box} placeholder="Search name or phone" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Customer</th><th>Phone</th><th>Owes</th></tr></thead>
          <tbody>{list.map(c => <tr key={c.customerId} className={'cursor-pointer border-b hover:bg-slate-100 ' + (sel === c.customerId ? 'bg-slate-100' : '')} onClick={() => setSel(c.customerId)}><td className="p-2">{c.name}</td><td>{c.phone}</td><td>{c.outstanding ? bdt(c.outstanding) : '-'}</td></tr>)}</tbody></table></div>
        {sel && <Detail id={sel} admin={admin} onChange={load} />}</div></div>
  );
}
