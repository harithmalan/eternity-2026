import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LockedAction from './LockedAction';
import { useAuth } from '../lib/auth';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { user, openSignIn, signOut } = useAuth();

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
        <a href="#merch"><button>Merch</button></a>
        <a href="#sizes"><button>Size guide</button></a>
        <a href="#order"><button>Pre-order</button></a>
        <LockedAction feature="lineup">
          <Link to="/lineup"><button>Line-up</button></Link>
        </LockedAction>
        <LockedAction feature="gallery">
          <Link to="/gallery"><button>Gallery</button></Link>
        </LockedAction>
        <a href="#contact"><button>Contact</button></a>
      </div>

      {user ? (
        <div className="nav-account">
          <button className="nav-signout" onClick={signOut}>Sign out</button>
          <Link to="/my-orders" className="nav-cta">My orders</Link>
        </div>
      ) : (
        <button className="nav-cta" onClick={openSignIn}>Sign in</button>
      )}
    </nav>
  );
}
