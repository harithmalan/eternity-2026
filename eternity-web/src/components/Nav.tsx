import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import LockedAction from './LockedAction';
import NavAccount from './NavAccount';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { subscribeLaunchVisualPhase } from '../lib/launchVisuals';

function statusDesc(kind: 'alumni_rsvp' | 'sliit_student', status?: string): string {
  if (status === 'pending') return 'Pending review';
  if (status === 'approved') return 'Approved — view your pass';
  if (status === 'rejected') return 'Rejected — resubmit';
  return kind === 'alumni_rsvp'
    ? 'Free entry — no tee required'
    : 'Free entry with your student ID';
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { user, openSignIn } = useAuth();
  const [launchHidden, setLaunchHidden] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRegs, setUserRegs] = useState<{ kind: string; status: string }[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => subscribeLaunchVisualPhase((phase) => setLaunchHidden(phase !== 'none')), []);

  useEffect(() => {
    if (!user) {
      setUserRegs([]);
      return;
    }
    let alive = true;
    const loadRegs = async () => {
      const { data } = await supabase
        .from('registrations')
        .select('kind, status')
        .eq('user_id', user.id);
      if (alive && data) setUserRegs(data);
    };
    loadRegs();

    const channel = supabase
      .channel(`nav-user-regs-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations', filter: `user_id=eq.${user.id}` },
        loadRegs
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dropdownOpen]);

  const alumniStatus = userRegs.find((r) => r.kind === 'alumni_rsvp')?.status;
  const sliitStatus = userRegs.find((r) => r.kind === 'sliit_student')?.status;

  const alumniDesc = statusDesc('alumni_rsvp', alumniStatus);
  const sliitDesc = statusDesc('sliit_student', sliitStatus);

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}${launchHidden ? ' launch-hidden' : ''}`} id="nav">
      <div className="nav-marks">
        <img src="/img/sis-logo.png" alt="SLIIT City Uni Student Interactive Society" />
        <div className="nav-rule" />
        <img className="uni" src="/img/UniLogo.png" alt="SLIIT City Uni" />
      </div>

      <div className="nav-links">
        <a href="#merch">Merch</a>
        <Link to="/feed">Latest</Link>
        <a href="#sizes">Size guide</a>
        <a href="#order">Pre-order</a>
        <LockedAction feature="lineup">
          <Link to="/lineup">Line-up</Link>
        </LockedAction>
        <LockedAction feature="gallery">
          <Link to="/gallery">Gallery</Link>
        </LockedAction>

        <div
          className="nav-free-wrap"
          ref={dropdownRef}
          onMouseEnter={() => setDropdownOpen(true)}
          onMouseLeave={() => setDropdownOpen(false)}
        >
          <button
            className={`nav-free-trigger${dropdownOpen ? ' open' : ''}`}
            onClick={() => setDropdownOpen((v) => !v)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            FREE ENTRY <span className="caret">▾</span>
          </button>

          {dropdownOpen && (
            <div className="nav-free-dropdown" role="menu">
              <Link
                to="/alumni"
                className="nav-free-row"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
              >
                <span className="nav-free-label">ALUMNI</span>
                <span className="nav-free-desc">{alumniDesc}</span>
              </Link>
              <Link
                to="/sliit-students"
                className="nav-free-row"
                role="menuitem"
                onClick={() => setDropdownOpen(false)}
              >
                <span className="nav-free-label">SLIIT STUDENTS</span>
                <span className="nav-free-desc">{sliitDesc}</span>
              </Link>
            </div>
          )}
        </div>

        <a href="#contact">Contact</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="nav-mobile-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          Menu ▾
        </button>

        {user ? <NavAccount /> : <button className="nav-cta" onClick={() => openSignIn()}>Sign in</button>}
      </div>

      {mobileOpen && (
        <div className="nav-mobile-drawer">
          <button className="nav-mobile-close" onClick={() => setMobileOpen(false)}>
            Close ✕
          </button>

          <div className="nav-mobile-links">
            <a href="#merch" onClick={() => setMobileOpen(false)}>Merch</a>
            <Link to="/feed" onClick={() => setMobileOpen(false)}>Latest</Link>
            <a href="#sizes" onClick={() => setMobileOpen(false)}>Size guide</a>
            <a href="#order" onClick={() => setMobileOpen(false)}>Pre-order</a>
            <LockedAction feature="lineup">
              <Link to="/lineup" onClick={() => setMobileOpen(false)}>Line-up</Link>
            </LockedAction>
            <LockedAction feature="gallery">
              <Link to="/gallery" onClick={() => setMobileOpen(false)}>Gallery</Link>
            </LockedAction>
            <a href="#contact" onClick={() => setMobileOpen(false)}>Contact</a>
          </div>

          <div className="nav-mobile-section">
            <div className="nav-mobile-section-title">FREE ENTRY</div>
            <Link
              to="/alumni"
              className="nav-mobile-free-row"
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-free-label">ALUMNI</span>
              <span className="nav-free-desc">{alumniDesc}</span>
            </Link>
            <Link
              to="/sliit-students"
              className="nav-mobile-free-row"
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-free-label">SLIIT STUDENTS</span>
              <span className="nav-free-desc">{sliitDesc}</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

