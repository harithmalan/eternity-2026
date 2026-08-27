import Countdown from './Countdown';
import { useMagnetic } from '../hooks/usePointerFx';

export default function Hero() {
  const goldBtn = useMagnetic<HTMLAnchorElement>();

  return (
    <header className="hero">
      <div className="hero-texture" aria-hidden="true" />
      <div className="hero-inner">
        <p className="eyebrow">SCU Get Together 2026</p>
        <div>
          <span className="free-pill"><span className="dot" />Free entry · 18 September</span>
        </div>
        <img className="crest" src="/img/horizon.png" alt="" />
        <img className="wordmark" src="/img/eternity-logo.png" alt="Eternity" fetchPriority="high" />
        <p className="hero-sub">
           “Night to cherish and celebrate the”</p>
          <p className="hero-sub">legacy of <i>25 years </i>
        </p>

        <div className="coords">
          <div className="coord"><div className="k">Date</div><div className="v">18 Sep 2026</div></div>
          <div className="coord"><div className="k">Time</div><div className="v">3:00 PM</div></div>
          <div className="coord"><div className="k">Entry</div><div className="v">Free</div></div>
          <div className="coord"><div className="k">Venue</div><div className="v">AirForce Grounds</div></div>
        </div>

        <Countdown />

        <div className="hero-actions">
          <a ref={goldBtn} className="btn btn-gold magnetic" href="#merch">Pre-order merch</a>
          <a className="btn btn-ghost" href="#order">How it works</a>
        </div>
      </div>
      <div className="scroll-hint"><span />Scroll</div>
    </header>
  );
}
