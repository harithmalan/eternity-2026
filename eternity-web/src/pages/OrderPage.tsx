import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useBatches, useProducts, useSettings } from '../hooks/useEternityData';
import { useSizeAvailability } from '../hooks/useSizeAvailability';
import { useToast } from '../components/Toast';
import PaymentCountdown from '../components/PaymentCountdown';
import Skeleton from '../components/Skeleton';
import { useMagnetic } from '../hooks/usePointerFx';
import type { Product } from '../lib/database.types';

const PHONE_RE = /^(?:0|\+94)7\d{8}$/;

interface OrderResult {
  code: string;
  total: number;
  payment_due_at: string;
}

function currentPrice(p: Product, isEarlyBird: boolean) {
  return isEarlyBird ? p.early_price : p.regular_price;
}

export default function OrderPage() {
  const { user, profile, saveProfile } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const { settings, loading: settingsLoading } = useSettings();
  const { batches, loading: batchesLoading } = useBatches();
  const { availability, refetch: refetchAvailability } = useSizeAvailability();
  const formLoading = productsLoading || settingsLoading || batchesLoading;
  const { say } = useToast();
  const [searchParams] = useSearchParams();

  const [fullName, setFullName] = useState('');
  const [saNumber, setSaNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [batch, setBatch] = useState('');
  const [productSlug, setProductSlug] = useState(searchParams.get('product') || 'combo');
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);

  const pendingOrderId = useRef<string | null>(null);
  const submitBtn = useMagnetic<HTMLButtonElement>();

  // Pre-fill from the profile once it's loaded — but don't clobber whatever
  // the student has already typed if this fires again after a save.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!profile || prefilled.current) return;
    prefilled.current = true;
    setFullName(profile.full_name ?? '');
    setSaNumber(profile.sa_number ?? '');
    setPhone(profile.phone ?? '');
    setBatch(profile.batch ?? '');
  }, [profile]);

  const product = useMemo(() => products.find((p) => p.slug === productSlug), [products, productSlug]);
  const isEarlyBird = settings ? Date.now() < new Date(settings.early_bird_ends_at).getTime() : true;
  const needsTee = product?.includes_tee ?? false;
  const total = product ? currentPrice(product, isEarlyBird) * qty : 0;

  const sizeList = useMemo(
    () => Object.values(availability).sort((a, b) => a.sort - b.sort),
    [availability]
  );
  const selectedAvailability = size ? availability[size] : undefined;

  const phoneValid = PHONE_RE.test(phone.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!user || !product) return;
    if (!fullName.trim() || !saNumber.trim() || !batch) {
      setSubmitError('Fill in every field before reserving.');
      return;
    }
    if (!phoneValid) {
      setPhoneTouched(true);
      setSubmitError('Enter a valid Sri Lankan mobile number.');
      return;
    }
    if (needsTee && !size) {
      setSubmitError('Pick a t-shirt size.');
      return;
    }

    setSubmitting(true);

    // Someone may have taken the last one while this student was typing —
    // re-check right before we actually try to reserve it.
    if (needsTee && size) {
      const fresh = await refetchAvailability();
      const freshRow = fresh.find((r) => r.size === size);
      if (freshRow?.sold_out) {
        setSubmitError(`Size ${size} is sold out.`);
        setSize(null);
        setSubmitting(false);
        return;
      }
    }

    await saveProfile({ full_name: fullName.trim(), sa_number: saNumber.trim(), phone: phone.trim(), batch });

    let orderId = pendingOrderId.current;
    if (!orderId) {
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          full_name: fullName.trim(),
          sa_number: saNumber.trim(),
          phone: phone.trim(),
          batch,
          email: user.email ?? '',
        })
        .select('id')
        .single();

      if (orderError || !orderRow) {
        setSubmitError(orderError?.message ?? 'Could not start your order. Try again.');
        setSubmitting(false);
        return;
      }
      orderId = orderRow.id;
      pendingOrderId.current = orderId;
    }

    // The database stamps unit_price/product_name/line_total — we only ever
    // send what the student picked.
    const { error: itemError } = await supabase.from('order_items').insert({
      order_id: orderId,
      product_id: product.id,
      size: needsTee ? size : null,
      qty,
    });

    if (itemError) {
      setSubmitError(itemError.message);
      await refetchAvailability();
      setSize(null);
      setSubmitting(false);
      return;
    }

    const { data: finalOrder } = await supabase
      .from('orders')
      .select('code, total, payment_due_at')
      .eq('id', orderId)
      .single();

    setSubmitting(false);
    if (finalOrder) setOrderResult(finalOrder);
  };

  const copyAcc = () => {
    if (!settings) return;
    navigator.clipboard?.writeText(settings.bank_account_no).then(() => say('Account number copied'));
  };

  if (orderResult) {
    return (
      <section className="band">
        <div className="shell">
          <div className="form-grid">
            <div className="panel">
              <p className="eyebrow">Reserved</p>
              <h3 style={{ marginTop: 10 }}>Order {orderResult.code}</h3>
              <PaymentCountdown dueAt={orderResult.payment_due_at} />
              <div className="total-line">
                <span>Total to deposit</span>
                <strong>Rs {orderResult.total.toLocaleString('en-LK')}</strong>
              </div>
              <Link className="btn btn-gold magnetic" style={{ width: '100%', marginTop: 20, textAlign: 'center' }} to="/my-orders">
                Upload your slip
              </Link>
            </div>

            {settings && (
              <div className="panel bank">
                <h3>Where to deposit</h3>
                <p className="hint">Bank transfer or over-the-counter deposit. Keep the slip — you&apos;ll upload it.</p>
                <dl>
                  <dt>Account name</dt><dd className="name">{settings.bank_account_name}</dd>
                  <dt>Account number</dt>
                  <dd className="copy-row"><span>{settings.bank_account_no}</span><button onClick={copyAcc}>Copy</button></dd>
                  <dt>Bank</dt><dd className="name">{settings.bank_branch}</dd>
                </dl>
                <div className="warn"><b>Upload your slip within 24 hours.</b> Reservations without a slip are released so someone else can take the size.</div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (formLoading) {
    return (
      <section className="band">
        <div className="shell">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Pre-order</p>
              <h2 className="sec-title">Reserve <i>yours</i>.</h2>
            </div>
          </div>
          <div className="panel" style={{ maxWidth: 560 }} aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="field" key={i}>
                <Skeleton width={120} height={9} style={{ marginBottom: 8 }} />
                <Skeleton height={40} />
              </div>
            ))}
            <Skeleton height={44} style={{ marginTop: 20, borderRadius: 999 }} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="band">
      <div className="shell">
        <div className="sec-head">
          <div>
            <p className="eyebrow">Pre-order</p>
            <h2 className="sec-title">Reserve <i>yours</i>.</h2>
          </div>
          <p className="sec-note">We use these details to find you at collection — please get them right.</p>
        </div>

        <form className="panel" onSubmit={submit} style={{ maxWidth: 560 }}>
          <div className="field">
            <label>Full name <span className="req">*</span></label>
            <input
              type="text"
              required
              placeholder="As it appears on your student record"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>SA / UOB number <span className="req">*</span></label>
              <input type="text" required placeholder="SA00000" value={saNumber} onChange={(e) => setSaNumber(e.target.value)} />
            </div>
            <div className="field">
              <label>Contact number <span className="req">*</span></label>
              <input
                type="tel"
                required
                placeholder="07X XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhoneTouched(true)}
              />
              {phoneTouched && phone && !phoneValid && (
                <p className="avail-warn" style={{ color: 'var(--dust)' }}>Use 07XXXXXXXX or +947XXXXXXXX.</p>
              )}
            </div>
          </div>
          <div className="field">
            <label>Batch <span className="req">*</span></label>
            <select required value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="" disabled>Select your batch</option>
              {batches.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
            </select>
          </div>
          <div className="field">
            <label>What you&apos;re ordering <span className="req">*</span></label>
            <select value={productSlug} onChange={(e) => { setProductSlug(e.target.value); setSize(null); }}>
              {products.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} — Rs {currentPrice(p, isEarlyBird).toLocaleString('en-LK')}
                </option>
              ))}
            </select>
          </div>
          {needsTee && (
            <div className="field">
              <label>T-shirt size <span className="req">*</span></label>
              <div className="sizes">
                {sizeList.map((s) => (
                  <button
                    key={s.size}
                    type="button"
                    disabled={s.sold_out}
                    aria-pressed={size === s.size}
                    onClick={() => setSize(s.size)}
                  >
                    {s.size}
                    {s.sold_out && <span className="avail-note">Sold out</span>}
                  </button>
                ))}
              </div>
              {selectedAvailability && selectedAvailability.remaining >= 1 && selectedAvailability.remaining <= 9 && (
                <p className="avail-warn">Only {selectedAvailability.remaining} left</p>
              )}
            </div>
          )}
          <div className="field">
            <label>Quantity</label>
            <select value={qty} onChange={(e) => setQty(+e.target.value)}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>

          <div className="total-line">
            <span>{isEarlyBird ? 'Early bird total' : 'Regular total'}</span>
            <strong>Rs {total.toLocaleString('en-LK')}</strong>
          </div>

          <button ref={submitBtn} type="submit" className="btn btn-gold magnetic" style={{ width: '100%', marginTop: 20 }} disabled={submitting}>
            {submitting ? 'Reserving…' : 'Reserve my order'}
          </button>
          {submitError && <p className="auth-error">{submitError}</p>}
        </form>
      </div>
    </section>
  );
}
