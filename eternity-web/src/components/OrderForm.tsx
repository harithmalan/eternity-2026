import { Link } from 'react-router-dom';
import type { Settings } from '../lib/database.types';
import { useReveal } from '../hooks/useReveal';
import { useMagnetic } from '../hooks/usePointerFx';
import { useToast } from './Toast';
import Skeleton from './Skeleton';

export default function OrderForm({ settings, loading }: { settings: Settings | null; loading: boolean }) {
  const formReveal = useReveal();
  const bankReveal = useReveal(1);
  const { say } = useToast();
  const ctaBtn = useMagnetic<HTMLAnchorElement>();

  const copyAcc = () => {
    if (!settings) return;
    navigator.clipboard?.writeText(settings.bank_account_no).then(() => say('Account number copied'));
  };

  return (
    <section className="band band-line band-solid" id="order">
      <div className="shell">
        <div className="sec-head">
          <div>
            <p className="eyebrow">Pre-order</p>
            <h2 className="sec-title">Reserve <i>yours</i>.</h2>
          </div>
          <p className="sec-note">Sign in first, so we can email you when your payment is verified and your order is ready.</p>
        </div>

        <div className="form-grid">
          <div className={`panel ${formReveal.className}`} ref={formReveal.ref} style={formReveal.style}>
            <h3>Two minutes, start to finish</h3>
            <p className="hint">Sign in, tell us your batch and size, and reserve. You&apos;ll get your order code and deposit details straight after.</p>
            <Link ref={ctaBtn} to="/order" className="btn btn-gold magnetic" style={{ width: '100%', marginTop: 20, textAlign: 'center' }}>
              Reserve my order
            </Link>
          </div>

          <div className={`panel bank ${bankReveal.className}`} ref={bankReveal.ref} style={bankReveal.style}>
            <h3>Where to deposit</h3>
            <p className="hint">Bank transfer or over-the-counter deposit. Keep the slip — you&apos;ll upload it.</p>
            {loading ? (
              <div aria-hidden="true">
                <Skeleton width={90} height={9} style={{ marginTop: 16 }} />
                <Skeleton width={160} height={15} style={{ marginTop: 6 }} />
                <Skeleton width={90} height={9} style={{ marginTop: 16 }} />
                <Skeleton width={110} height={15} style={{ marginTop: 6 }} />
                <Skeleton width={90} height={9} style={{ marginTop: 16 }} />
                <Skeleton width={180} height={15} style={{ marginTop: 6 }} />
              </div>
            ) : settings && (
              <dl>
                <dt>Account name</dt><dd className="name">{settings.bank_account_name}</dd>
                <dt>Account number</dt>
                <dd className="copy-row"><span>{settings.bank_account_no}</span><button onClick={copyAcc}>Copy</button></dd>
                <dt>Bank</dt><dd className="name">{settings.bank_branch}</dd>
              </dl>
            )}
            <div className="warn"><b>Upload your slip within 24 hours.</b> Reservations without a slip are released so someone else can take the size.</div>
            <div className="warn" style={{ borderLeftColor: 'var(--dust-dim)', background: 'rgba(232,234,240,.04)' }}>
              Put your <b>order code</b> in the deposit reference if your bank allows it. It makes approval much faster.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
