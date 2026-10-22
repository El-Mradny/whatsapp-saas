import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

const links = [
  ['/', 'Dashboard', '▦'],
  ['/campaigns', 'Campaigns', '➤'],
  ['/templates', 'Templates', '📋'],
  ['/inbox', 'Inbox', '✉'],
  ['/contacts', 'Contacts', '☰'],
  ['/numbers', 'Numbers', '☎'],
  ['/profile', 'Profile', '◉'],
] as const;

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isInbox = location.pathname.startsWith('/inbox');

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">W</span> Wavely
        </div>
        <nav className="nav">
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span aria-hidden>{icon}</span> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div style={{ padding: '0 10px 8px' }}>
            <div style={{ fontWeight: 600 }}>{user?.name}</div>
            <div className="muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
          <button className="btn sm" style={{ marginLeft: 10 }} onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className={`main${isInbox ? ' main-inbox' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
