import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Account from './pages/Account';
import Inventory from './pages/Inventory';

// ═══ Session countdown: logs out cleanly when the 6-hour session ends ═══
function Countdown() {
  const { user, logout } = useAuth();
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => { const s = Math.floor((Date.parse(user!.expiresAt) - Date.now()) / 1000); setLeft(s); if (s <= 0) logout(); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [user]);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
  return <span className="text-xs text-slate-500">Session ends in {h}h {m}m</span>;
}

// ═══ App layout: top bar + page area. CUSTOMIZE: add menu links here as modules arrive ═══
function Layout() {
  const { user, logout } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) => 'rounded px-3 py-1 ' + (isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-200');
  return (
    <div className="mx-auto max-w-5xl px-4">
      <header className="flex flex-wrap items-center justify-between gap-2 py-3">
        <nav className="flex gap-1">
          <NavLink to="/" end className={link}>Dashboard</NavLink>
          <NavLink to="/inventory" className={link}>Inventory</NavLink>
          {user?.role === 'ADMIN' && <NavLink to="/users" className={link}>Users</NavLink>}
          <NavLink to="/account" className={link}>Account</NavLink>
        </nav>
        <div className="flex items-center gap-3"><Countdown /><span className="text-sm">{user?.username}</span>
          <button className="text-sm underline" onClick={logout}>Sign out</button></div>
      </header>
      <main className="py-4"><Outlet /></main>
    </div>
  );
}

// Guards are for convenience only; the SERVER enforces every permission.
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6 text-slate-600">Loading…</p>;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}
function AdminOnly() { return useAuth().user?.role === 'ADMIN' ? <Users /> : <Navigate to="/" replace />; }

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="users" element={<AdminOnly />} />
        <Route path="account" element={<Account />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
