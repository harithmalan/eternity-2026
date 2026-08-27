import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useProducts, useSettings } from '../hooks/useEternityData';
import { useCountdown, pad2 } from '../hooks/useCountdown';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'eternity:merch-popup';
const ARM_DELAY_MS = 10_000; // never within 10s of page load
const TIME_TRIGGER_MS = 30_000;
const SCROLL_TRIGGER = 0.45;

function alreadyShown() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markShown() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // private-mode / storage-disabled — best effort only, worst case it can show twice
  }
}

function formatEarlyBirdEnd(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'Asia/Colombo' })
    .format(new Date(iso))
    .toUpperCase();
}

export default function MerchPopup() {
  const location = useLocation();
  const { user, pendingGreetName } = useAuth();
  const { settings } = useSettings();
  const { products } = useProducts();

  const [open, setOpen] = useState(false);
  const [hasOrder, setHasOrder] = useState(false);
  const panelRef = useFocusTrap<HTMLDivElement>(open);
  const headingId = 'merch-popup-heading';

  const excludedRoute = location.pathname === '/my-orders' || location.hash === '#order';
  const greetingActive = pendingGreetName !== undefined;

  // Skip the popup entirely for a signed-in visitor who already has an
  // order — checked once per sign-in, never for a signed-out visitor.
  useEffect(() => {
    let alive = true;
    if (!user) {
      setHasOrder(false);
      return;
    }
    supabase
      .from('orders')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data, error }) => {
        if (!alive) return;
        setHasOrder(!error && !!data && data.length > 0);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (alreadyShown() || excludedRoute || hasOrder || greetingActive) return;

    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, ARM_DELAY_MS);

    const fire = () => {
      if (!armed || alreadyShown()) return;
      markShown();
      setOpen(true);
    };

    const timeTimer = window.setTimeout(fire, TIME_TRIGGER_MS);

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      if (scrollable <= 0) return;
      if (doc.scrollTop / scrollable >= SCROLL_TRIGGER) fire();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.clearTimeout(armTimer);
      window.clearTimeout(timeTimer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [excludedRoute, hasOrder, greetingActive]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const combo = products.find((p) => p.slug === 'combo');
  const countdownTarget = settings ? new Date(settings.early_bird_ends_at).getTime() : 0;
  const countdown = useCountdown(countdownTarget);

  if (!open) return null;

  const goToOrder = () => {
    setOpen(false);
    window.setTimeout(() => {
      document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  return (
    <div
      className="merch-popup show"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div ref={panelRef} tabIndex={-1} className="merch-popup-panel" role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <button className="merch-popup-x" onClick={() => setOpen(false)} aria-label="Close">×</button>

        <div className="merch-popup-art">
          <div className="merch-popup-tee">
            <img src="/img/tshirt-back.png" alt="" />
          </div>
        </div>

        <div className="merch-popup-body">
          {settings && <p className="eyebrow merch-popup-eyebrow">Early bird · Ends {formatEarlyBirdEnd(settings.early_bird_ends_at)}</p>}
          <h3 id={headingId} className="merch-popup-title">Wear the night.</h3>
          <p className="merch-popup-copy">
            All-over vortex print. Chrome Eternity mark across the back. Reserve now, collect before the show.
          </p>

          {combo && (
            <div className="merch-popup-price">
              <span className="now">Rs {combo.early_price.toLocaleString('en-LK')} <small>bundle</small></span>
              <span className="then">Rs {combo.regular_price.toLocaleString('en-LK')} later</span>
            </div>
          )}

          {settings && !countdown.expired && (
            <p className="merch-popup-countdown">
              {countdown.days > 0
                ? `${countdown.days}d ${pad2(countdown.hours)}h ${pad2(countdown.minutes)}m`
                : `${pad2(countdown.hours)}h ${pad2(countdown.minutes)}m ${pad2(countdown.seconds)}s`}{' '}
              left at this price
            </p>
          )}

          <button type="button" className="btn btn-gold merch-popup-cta" onClick={goToOrder}>
            Pre-order now
          </button>
          <button type="button" className="merch-popup-later" onClick={() => setOpen(false)}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
