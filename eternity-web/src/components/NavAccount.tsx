import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { avatarUrlFrom, firstNameFrom, fullNameFrom, useAuth } from '../lib/auth';

function initialsFrom(name: string | null, email: string | null): string {
  const source = (name ?? email ?? '').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Avatar + name in the nav, opening a dropdown with account details and sign-out — replaces the old bare sign-out/my-orders pair. */
export default function NavAccount() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const avatarUrl = avatarUrlFrom(user);
  const fullName = fullNameFrom(user);
  const firstName = firstNameFrom(user) ?? 'Account';
  const initials = initialsFrom(fullName, user.email ?? null);

  return (
    <div className="nav-account" ref={rootRef}>
      <button className="nav-avatar-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="true">
        {avatarUrl && !avatarFailed ? (
          <img className="nav-avatar" src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} />
        ) : (
          <span className="nav-avatar nav-avatar-initials" aria-hidden="true">{initials}</span>
        )}
        <span className="nav-first-name">{firstName}</span>
      </button>

      {open && (
        <div className="nav-dropdown" role="menu">
          <p className="nav-dropdown-name">{fullName ?? firstName}</p>
          <p className="nav-dropdown-email">{user.email}</p>
          <div className="nav-dropdown-rule" />
          <Link className="nav-dropdown-item" to="/my-orders" role="menuitem" onClick={() => setOpen(false)}>My orders</Link>
          <button className="nav-dropdown-item" role="menuitem" onClick={() => { setOpen(false); signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
