import { useEffect, useState } from 'react';
import { call } from '../api/client';
import { useAuth } from '../auth';
import { bdt, qtyFmt } from '../lib/money';

const box = 'rounded-md border border-slate-300 px-3 py-2';
const badge: Record<string, string> = { PAID: 'bg-green-100 text-green-800', PARTIAL: 'bg-amber-100 text-amber-800', UNPAID: 'bg-red-100 text-red-800' };

// ═══ Sales list and invoice detail. Admins can reverse a sale (needs a reason; receipts applied to it must be reversed first) ═══
export default function Sales() {
  const admin = useAuth().user?.role === 'ADMIN';
  const [list, setList] = useState<any[]>([]); const [search, setSearch] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  const load = () => call<any[]>('listSales', { search, from: from || undefined, to: to || undefined }).then(setList).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [search, from, to]);
  const open = (id: string) => call('getSale', { saleId: id }).then(setD).catch((e: any) => setErr(e.message));
  async function reverse() {
    const reason = window.prompt('Reason for reversing this sale (required):'); if (!reason) return;
    try { await call('reverseDocument', { txnId: d.sale.txnId, reason }); setD(null); load(); } catch (e: any) { setErr(e.message); }
  }
  return (
    <div className="space-y-4"><h2 className="text-xl font-semibold">Sales</h2>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <div className="flex flex-wrap gap-2"><input className={box} placeholder="Search invoice or customer" value={search} onChange={e => setSearch(e.target.value)} />
        <input type="date" className={box} value={from} onChange={e => setFrom(e.target.value)} /><input type="date" className={box} value={to} onChange={e => setTo(e.target.value)} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Invoice</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>{list.map(s => <tr key={s.saleId} className="cursor-pointer border-b hover:bg-slate-100" onClick={() => open(s.saleId)}><td className="p-2">{s.invoiceNo}</td><td>{s.date}</td><td>{s.customerName}</td><td>{bdt(s.total)}</td>
            <td><span className={'rounded px-1 ' + (badge[s.payStatus] || '')}>{s.payStatus}</span></td></tr>)}</tbody></table>
          {!list.length && <p className="p-3 text-slate-500">No sales found.</p>}</div>
        {d && <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
          <div><h3 className="text-lg font-semibold">{d.sale.invoiceNo}</h3><p className="text-sm text-slate-600">{d.sale.date} · {d.sale.customer?.name} · due {d.sale.dueDate}</p></div>
          <table className="w-full text-left text-sm"><tbody>{d.items.map((i: any, k: number) => <tr key={k} className="border-b"><td className="py-1">{i.name}</td><td>{qtyFmt(i.qty)} × {bdt(i.unitPrice)}</td><td className="text-right">{bdt(i.lineGross)}</td></tr>)}</tbody></table>
          <div className="text-sm">{d.sale.vatTotal > 0 && <div>VAT {bdt(d.sale.vatTotal)}</div>}{d.sale.discount > 0 && <div>Discount {bdt(d.sale.discount)}</div>}
            <div><b>Total {bdt(d.sale.total)}</b> · Paid {bdt(d.sale.paid)} · Due {bdt(d.sale.due)}</div>
            {admin && d.sale.cogsTotal !== undefined && <div className="text-slate-500">Cost {bdt(d.sale.cogsTotal)} · Profit {bdt(d.sale.netTotal - d.sale.cogsTotal)}</div>}</div>
          {d.payments.map((p: any) => <div key={p.paymentId} className="text-sm text-slate-600">{p.date}: {bdt(p.amount)} ({p.lines.map((l: any) => l.method + ' ' + bdt(l.amount)).join(', ')})</div>)}
          {admin && d.sale.status === 'POSTED' && <button className="text-sm underline" onClick={reverse}>Reverse this sale</button>}</div>}</div></div>
  );
}
