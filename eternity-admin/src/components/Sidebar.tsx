import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/orders', label: 'Orders' },
  { to: '/export', label: 'Export' },
  { to: '/reveals', label: 'Reveals' },
  { to: '/artists', label: 'Artists' },
  { to: '/features', label: 'Features' },
  { to: '/products', label: 'Products' },
  { to: '/stock', label: 'Stock' },
  { to: '/emails', label: 'Emails' },
];

export default function Sidebar() {
  const { user, isSuperadmin, signOut } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img className="mark" src="/img/eternity-logo.png" alt="Eternity" />
        <span className="name">Committee</span>
        <img className="uni" src="/img/UniLogo.png" alt="" />
      </div>
      <nav className="sidebar-nav">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            {l.label}
          </NavLink>
        ))}
        {isSuperadmin && (
          <NavLink to="/members" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            Members
          </NavLink>
        )}
      </nav>
      <div className="sidebar-foot">
        <p className="sidebar-user">{user?.email}</p>
        <button className="sidebar-signout" onClick={signOut}>Sign out</button>
      </div>
    </aside>
  );
}
