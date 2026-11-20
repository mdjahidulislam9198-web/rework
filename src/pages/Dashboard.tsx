import { useEffect, useState } from 'react';
import { call } from '../api/client';
import { useAuth } from '../auth';

// Placeholder: the real dashboard cards arrive in Phase 6.
export default function Dashboard() {
  const { user } = useAuth();
  const [server, setServer] = useState('checking…');
  useEffect(() => { call<{ apiVersion: string }>('ping').then(r => setServer('connected, API v' + r.apiVersion)).catch(e => setServer('error: ' + e.message)); }, []);
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Welcome, {user?.fullName}</h2>
      <p className="text-slate-600">Server: {server}</p>
      <p className="text-slate-600">Inventory, Sales, Purchases and Accounting modules are added in the next phases.</p>
    </div>
  );
}
