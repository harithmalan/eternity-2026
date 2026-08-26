import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product, Settings } from '../lib/database.types';
import { useReveal } from '../hooks/useReveal';
import { useMagnetic, useTilt } from '../hooks/usePointerFx';
import { useCountdown, pad2 } from '../hooks/useCountdown';
import { mergeRefs } from '../hooks/mergeRefs';
import Skeleton from './Skeleton';

interface MerchGridProps {
  products: Product[];
  settings: Settings | null;
  loading: boolean;
}

function earlyBirdEndLabel(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'Asia/Colombo' }).format(
    new Date(iso)
  );
}

export default function MerchGrid({ products, settings, loading }: MerchGridProps) {
  const head = useReveal();
  const alertReveal = useReveal();
  const earlyBirdEndsAt = settings ? new Date(settings.early_bird_ends_at).getTime() : Infinity;
  const { days, hours, expired } = useCountdown(earlyBirdEndsAt);
  const isEarlyBird = settings ? Date.now() < earlyBirdEndsAt : true;

  const byslug = useMemo(() => {
    const map: Record<string, Product> = {};
    products.forEach((p) => { map[p.slug] = p; });
    return map;
  }, [products]);

  return (
    <section className="band band-line band-solid" id="merch">
      <div className="shell">
        <div className={`sec-head ${head.className}`} ref={head.ref} style={head.style}>
          <div>
            <p className="eyebrow">Open now — pre-order</p>
            <h2 className="sec-title">Wear the <i>night</i>.</h2>
          </div>
          <p className="sec-note">Printed to order. Reserve now, deposit within 24 hours, collect on campus before the show.</p>
        </div>

        {settings && (
          <div className={`price-alert ${alertReveal.className}`} ref={alertReveal.ref} style={alertReveal.style}>
            <span className="tag">Early bird</span>
            <p><b>Early bird ends after {earlyBirdEndLabel(settings.early_bird_ends_at)}.</b> Reserve before then to lock these prices.</p>
            <span className="mini">
              {expired ? 'Early bird has closed' : `${days}d ${pad2(hours)}h left at early bird`}
            </span>
          </div>
        )}

        <div className="goods">
          {loading ? (
            <>
              <GoodSkeleton />
              <GoodSkeleton />
              <GoodSkeleton />
            </>
          ) : (
            <>
              {byslug.tee && <TeeCard product={byslug.tee} isEarlyBird={isEarlyBird} index={0} />}
              {byslug.combo && <ComboCard product={byslug.combo} isEarlyBird={isEarlyBird} index={1} />}
              {byslug.band && <BandCard product={byslug.band} isEarlyBird={isEarlyBird} index={2} />}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function GoodSkeleton() {
  return (
    <article className="good" aria-hidden="true">
      <div className="good-top">
        <Skeleton width="55%" height={24} />
        <Skeleton width={60} height={12} />
      </div>
      <Skeleton className="skeleton-text" width="90%" />
      <Skeleton className="skeleton-text" width="70%" style={{ marginBottom: 18 }} />
      <div className="stage"><Skeleton width="100%" height={220} /></div>
      <div className="pricing">
        <Skeleton width={80} height={28} />
        <Skeleton width={70} height={28} />
      </div>
      <Skeleton height={44} style={{ marginTop: 18, borderRadius: 999 }} />
    </article>
  );
}

function Pricing({ product, isEarlyBird }: { product: Product; isEarlyBird: boolean }) {
  const now = isEarlyBird ? product.early_price : product.regular_price;
  const then = isEarlyBird ? product.regular_price : null;
  const save = product.regular_price - product.early_price;
  return (
    <div className="pricing">
      <div className="now"><small>RS</small>{now.toLocaleString('en-LK')}</div>
      {then !== null ? (
        <div className="then">{then.toLocaleString('en-LK')} later<b>Save {save.toLocaleString('en-LK')}</b></div>
      ) : (
        <div className="then">Early bird closed</div>
      )}
    </div>
  );
}

function TeeCard({ product, isEarlyBird, index }: { product: Product; isEarlyBird: boolean; index: number }) {
  const reveal = useReveal(index);
  const tilt = useTilt<HTMLDivElement>();
  const [view, setView] = useState<'front' | 'back'>('front');
  const [front, back] = product.images;

  return (
    <article className={`good tilt ${reveal.className}`} ref={mergeRefs(reveal.ref, tilt)} style={reveal.style}>
      <div className="good-top"><h3>{product.name}</h3><span className="sku">{product.sku}</span></div>
      <p className="blurb">{product.description}</p>
      <div className="stage">
        <img src={`/img/${view === 'front' ? front : back}`} alt={`${product.name}, ${view}`} loading="lazy" decoding="async" />
      </div>
      <div className="views">
        <button aria-pressed={view === 'front'} onClick={() => setView('front')}>Front</button>
        <button aria-pressed={view === 'back'} onClick={() => setView('back')}>Back</button>
      </div>
      <Pricing product={product} isEarlyBird={isEarlyBird} />
      <Link to={`/order?product=${product.slug}`} className="btn btn-ghost">Choose the tee</Link>
    </article>
  );
}

function ComboCard({ product, isEarlyBird, index }: { product: Product; isEarlyBird: boolean; index: number }) {
  const reveal = useReveal(index);
  const tilt = useTilt<HTMLDivElement>();
  const goldBtn = useMagnetic<HTMLAnchorElement>();
  const [, back, band] = product.images;

  return (
    <article
      className={`good hero-item tilt ${reveal.className}`}
      ref={mergeRefs(reveal.ref, tilt)}
      style={reveal.style}
    >
      <span className="ribbon">Best value</span>
      <div className="good-top"><h3>{product.name}</h3><span className="sku">{product.sku}</span></div>
      <p className="blurb">{product.description}</p>
      <div className="stage duo">
        <img src={`/img/${back}`} alt="Eternity tee" loading="lazy" decoding="async" />
        <img src={`/img/${band}`} alt="Eternity wristband" style={{ maxHeight: 128 }} loading="lazy" decoding="async" />
      </div>
      <Pricing product={product} isEarlyBird={isEarlyBird} />
      <Link ref={goldBtn} to={`/order?product=${product.slug}`} className="btn btn-gold magnetic">Choose the bundle</Link>
    </article>
  );
}

function BandCard({ product, isEarlyBird, index }: { product: Product; isEarlyBird: boolean; index: number }) {
  const reveal = useReveal(index);
  const tilt = useTilt<HTMLDivElement>();
  const [band] = product.images;

  return (
    <article className={`good tilt ${reveal.className}`} ref={mergeRefs(reveal.ref, tilt)} style={reveal.style}>
      <div className="good-top"><h3>{product.name}</h3><span className="sku">{product.sku}</span></div>
      <p className="blurb">{product.description}</p>
      <div className="stage">
        <img src={`/img/${band}`} alt="Eternity wristband" style={{ maxHeight: 178 }} loading="lazy" decoding="async" />
      </div>
      <Pricing product={product} isEarlyBird={isEarlyBird} />
      <Link to={`/order?product=${product.slug}`} className="btn btn-ghost">Choose the band</Link>
    </article>
  );
}
