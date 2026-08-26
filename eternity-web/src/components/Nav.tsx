import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LockedAction from './LockedAction';
import NavAccount from './NavAccount';
import { useAuth } from '../lib/auth';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { user, openSignIn } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`} id="nav">
      <div className="nav-marks">
        <img src="/img/sis-logo.png" alt="SLIIT City Uni Student Interactive Society" />
        <div className="nav-rule" />
        <img className="uni" src="/img/UniLogo.png" alt="SLIIT City Uni" />
      </div>
      <div className="nav-links">
        <a href="#merch">Merch</a>
        <a href="#sizes">Size guide</a>
        <a href="#order">Pre-order</a>
        <LockedAction feature="lineup">
          <Link to="/lineup">Line-up</Link>
        </LockedAction>
        <LockedAction feature="gallery">
          <Link to="/gallery">Gallery</Link>
        </LockedAction>
        <a href="#contact">Contact</a>
      </div>

      {user ? <NavAccount /> : <button className="nav-cta" onClick={openSignIn}>Sign in</button>}
    </nav>
  );
}
