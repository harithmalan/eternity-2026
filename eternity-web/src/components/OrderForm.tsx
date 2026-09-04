import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useToast } from './Toast';
import PaymentCountdown from './PaymentCountdown';
import Skeleton from './Skeleton';
import { useMagnetic } from '../hooks/usePointerFx';
import { useReveal } from '../hooks/useReveal';
import type { AttendeeType, Batch, Center, Product, Settings } from '../lib/database.types';

const PHONE_RE = /^(?:0|\+94)7\d{8}$/;
const NIC_RE = /^(?:\d{9}[VX]|\d{12})$/;
const DRAFT_KEY = 'eternity:draft';

function normalizeNic(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

interface SizeOption {
  size: string;
  sort: number;
}

interface OrderResult {
  code: string;
  total: number;
  payment_due_at: string;
}

interface Draft {
  attendeeType: AttendeeType;
  fullName: string;
  saNumber: string;
  batch: string;
  nic: string;
  center: string;
  phone: string;
  productSlug: string;
  size: string | null;
  qty: number;
}

function currentPrice(p: Product, isEarlyBird: boolean) {
  return isEarlyBird ? p.early_price : p.regular_price;
}

export default function OrderForm({
  products,
  settings,
  batches,
  centers,
  productsLoading,
  settingsLoading,
  batchesLoading,
  centersLoading,
}: {
  products: Product[];
  settings: Settings | null;
  batches: Batch[];
  centers: Center[];
  productsLoading: boolean;
  settingsLoading: boolean;
  batchesLoading: boolean;
  centersLoading: boolean;
}) {
  // The bank panel is static, data-wise it only needs `settings` — it must
  // never wait on the form panel's own dependencies (products, batches,
  // sizes), so a slow or failed fetch on that side can't take it down too.
  const formLoading = productsLoading || batchesLoading || centersLoading;
  const { user, profile, saveProfile, signInWithGoogle } = useAuth();
  const { say } = useToast();
  const [searchParams] = useSearchParams();
  const formReveal = useReveal();
  const bankReveal = useReveal(1);
  const submitBtn = useMagnetic<HTMLButtonElement>();
  const shouldReduceMotion = !!useReducedMotion();

  const [attendeeType, setAttendeeType] = useState<AttendeeType>('student');
  const [fullName, setFullName] = useState('');
  const [saNumber, setSaNumber] = useState('');
  const [batch, setBatch] = useState('');
  const [nic, setNic] = useState('');
  const [nicTouched, setNicTouched] = useState(false);
  const [center, setCenter] = useState('Colombo');
  const [phone, setPhone] = useState('');
  const [productSlug, setProductSlug] = useState('combo');
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Switching attendee type must never let a value from the vanished field
  // group ride along — a leftover SA number can never reach the DB behind
  // an alumni order, not even for the instant before the next render.
  useEffect(() => {
    if (attendeeType === 'alumni') {
      setSaNumber('');
      setBatch('');
    } else {
      setNic('');
      setNicTouched(false);
    }
  }, [attendeeType]);

  const nicNormalized = normalizeNic(nic);
  const nicValid = NIC_RE.test(nicNormalized);

  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [sizesLoading, setSizesLoading] = useState(true);
  const [sizeError, setSizeError] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);

  const pendingOrderId = useRef<string | null>(null);
  const prefilled = useRef(false);

  // A "Choose the X" card sets ?product=slug — pick it up whenever it
  // changes, including a second click while already on this page.
  useEffect(() => {
    const p = searchParams.get('product');
    if (p) setProductSlug(p);
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    supabase
      .from('size_chart')
      .select('size, sort')
      .order('sort')
      .then(
        ({ data, error }) => {
          if (!alive) return;
          if (error) {
            setSizeError(true);
            console.error(error);
          } else {
            setSizes(data ?? []);
          }
          setSizesLoading(false);
        },
        // A network-level failure rejects instead of resolving with `error`
        // — without this second handler the promise above never settles the
        // loading state, and the size field is stuck showing skeletons forever.
        (err) => {
          if (!alive) return;
          setSizeError(true);
          console.error(err);
          setSizesLoading(false);
        }
      );
    return () => {
      alive = false;
    };
  }, []);

  // A sign-in redirect (see `submit`) leaves the tab entirely — restore
  // whatever was typed before it left, then get out of the profile
  // pre-fill's way below so it doesn't clobber the restored draft.
  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    sessionStorage.removeItem(DRAFT_KEY);
    try {
      const draft = JSON.parse(raw) as Draft;
      setAttendeeType(draft.attendeeType ?? 'student');
      setFullName(draft.fullName ?? '');
      setSaNumber(draft.saNumber ?? '');
      setBatch(draft.batch ?? '');
      setNic(draft.nic ?? '');
      setCenter(draft.center || 'Colombo');
      setPhone(draft.phone ?? '');
      setProductSlug(draft.productSlug ?? 'combo');
      setSize(draft.size ?? null);
      setQty(draft.qty ?? 1);
      prefilled.current = true;
    } catch {
      // Malformed draft — nothing worth restoring.
    }
  }, []);

  // Pre-fill from the profile once it's loaded — but don't clobber whatever
  // the student has already typed (or a just-restored draft) if this fires
  // again after a save.
  useEffect(() => {
    if (!profile || prefilled.current) return;
    prefilled.current = true;
    setFullName(profile.full_name ?? '');
    setSaNumber(profile.sa_number ?? '');
    setPhone(profile.phone ?? '');
    setBatch(profile.batch ?? '');
    setCenter(profile.center || 'Colombo');
  }, [profile]);

  const product = useMemo(() => products.find((p) => p.slug === productSlug), [products, productSlug]);
  const isEarlyBird = settings ? Date.now() < new Date(settings.early_bird_ends_at).getTime() : true;
  const needsTee = product?.includes_tee ?? false;
  const total = product ? currentPrice(product, isEarlyBird) * qty : 0;

  // A stale size from a previous tee/bundle pick must never survive a
  // switch to the wristband — there's no size field left to hold it.
  useEffect(() => {
    if (!needsTee) setSize(null);
  }, [needsTee]);

  const phoneValid = PHONE_RE.test(phone.trim());

  const copyAcc = () => {
    if (!settings) return;
    navigator.clipboard?.writeText(settings.bank_account_no).then(() => say('Account number copied'));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!product) return;
    if (!fullName.trim() || !center) {
      setSubmitError('Fill in every field before reserving.');
      return;
    }
    if (attendeeType === 'alumni') {
      if (!nicNormalized) {
        setNicTouched(true);
        setSubmitError('Enter your NIC to reserve as alumni.');
        return;
      }
      if (!nicValid) {
        setNicTouched(true);
        setSubmitError('Enter a valid NIC — 9 digits + V/X, or 12 digits.');
        return;
      }
    } else if (!saNumber.trim() || !batch) {
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

    // Signed out: this button only starts sign-in. Save what's already been
    // typed so it survives the OAuth round trip, then send them off — the
    // draft-restore effect above puts it all back the moment they land here.
    if (!user) {
      const draft: Draft = {
        attendeeType,
        fullName: fullName.trim(),
        saNumber: saNumber.trim(),
        batch,
        nic,
        center,
        phone: phone.trim(),
        productSlug,
        size,
        qty,
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setSubmitting(true);
      const { error } = await signInWithGoogle('/#order');
      if (error) {
        sessionStorage.removeItem(DRAFT_KEY);
        setSubmitError(error);
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    await saveProfile({
      full_name: fullName.trim(),
      sa_number: saNumber.trim() || null,
      phone: phone.trim(),
      batch: batch || null,
      center,
    });

    let orderId = pendingOrderId.current;
    if (!orderId) {
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          full_name: fullName.trim(),
          attendee_type: attendeeType,
          sa_number: attendeeType === 'alumni' ? null : saNumber.trim(),
          batch: attendeeType === 'alumni' ? null : batch,
          nic: attendeeType === 'alumni' ? nicNormalized : null,
          center,
          phone: phone.trim(),
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

  return (
    <section className="band band-line band-solid" id="order">
      <div className="shell">
        <div className="sec-head">
          <div>
            <p className="eyebrow">Pre-order</p>
            <h2 className="sec-title">Reserve <i>yours</i>.</h2>
          </div>
          <p className="sec-note">Fill this in and reserve — you&apos;ll get your order code and deposit details straight after.</p>
        </div>

        <div className="form-grid">
          {formLoading ? (
            <div className="panel" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="field" key={i}>
                  <Skeleton width={120} height={9} style={{ marginBottom: 8 }} />
                  <Skeleton height={40} />
                </div>
              ))}
              <Skeleton height={44} style={{ marginTop: 20, borderRadius: 999 }} />
            </div>
          ) : orderResult ? (
            <div className={`panel ${formReveal.className}`} ref={formReveal.ref} style={formReveal.style}>
              <p className="eyebrow">Reserved</p>
              <h3 style={{ marginTop: 10 }}>Order {orderResult.code}</h3>
              <PaymentCountdown dueAt={orderResult.payment_due_at} />
              <div className="total-line">
                <span>Total to deposit</span>
                <strong>Rs {orderResult.total.toLocaleString('en-LK')}</strong>
              </div>
              {attendeeType === 'alumni' && (
                <div className="warn">
                  Your Eternity tee is your invitation. Once we verify your deposit, an entry pass appears here — bring it on your phone on the 18th.
                </div>
              )}
              <Link className="btn btn-gold magnetic" style={{ width: '100%', marginTop: 20, textAlign: 'center' }} to="/my-orders">
                Upload your slip
              </Link>
            </div>
          ) : (
            <div className={`panel ${formReveal.className}`} ref={formReveal.ref} style={formReveal.style}>
              <form onSubmit={submit}>
                <h3>Your details</h3>
                <p className="hint">Please fill these correctly — we use them to find you at collection.</p>

                <div className="field">
                  <label>I am a <span className="req">*</span></label>
                  {/* A fresh graduate still has an SA/UOB number — they take the
                      student path below and pick a "Graduate 2026"-style batch
                      from the existing Batch dropdown instead of a separate
                      attendee type. */}
                  <div className="attendee-toggle" role="group" aria-label="Attendee type">
                    <button type="button" aria-pressed={attendeeType === 'student'} onClick={() => setAttendeeType('student')}>
                      Current student
                    </button>
                    <button type="button" aria-pressed={attendeeType === 'alumni'} onClick={() => setAttendeeType('alumni')}>
                      Alumni
                    </button>
                  </div>
                </div>

                <div className="field-row">
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

                <AnimatePresence initial={false}>
                  {attendeeType === 'alumni' ? (
                    <motion.div
                      key="alumni-fields"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
                    >
                      <div className="field">
                        <label>NIC <span className="req">*</span></label>
                        <input
                          type="text"
                          required
                          placeholder="912345678V"
                          value={nic}
                          onChange={(e) => setNic(e.target.value)}
                          onBlur={() => setNicTouched(true)}
                        />
                        <p className="field-helper">Old format 912345678V or new format 199123456789</p>
                        {nicTouched && nic && !nicValid && (
                          <p className="avail-warn" style={{ color: 'var(--dust)' }}>Enter a valid NIC — 9 digits + V/X, or 12 digits.</p>
                        )}
                        <p className="field-privacy-note">
                          Alumni have no student ID, so we use this to issue your entry pass. It is visible only to
                          the committee and is deleted after the event.
                        </p>
                      </div>
                      <div className="field">
                        <label>Center <span className="req">*</span></label>
                        <select required value={center} onChange={(e) => setCenter(e.target.value)}>
                          <option value="" disabled>Select your center</option>
                          {centers.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="student-fields"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
                    >
                      <div className="field-row">
                        <div className="field">
                          <label>SA / UOB number <span className="req">*</span></label>
                          <input type="text" required placeholder="SA00000" value={saNumber} onChange={(e) => setSaNumber(e.target.value)} />
                        </div>
                        <div className="field">
                          <label>Batch <span className="req">*</span></label>
                          <select required value={batch} onChange={(e) => setBatch(e.target.value)}>
                            <option value="" disabled>Select your batch</option>
                            {batches.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="field">
                        <label>Center <span className="req">*</span></label>
                        <select required value={center} onChange={(e) => setCenter(e.target.value)}>
                          <option value="" disabled>Select your center</option>
                          {centers.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="field">
                  <label>What you&apos;re ordering <span className="req">*</span></label>
                  <select value={productSlug} onChange={(e) => setProductSlug(e.target.value)}>
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
                    {sizeError ? (
                      <p className="auth-error">Couldn&apos;t load sizes — refresh the page</p>
                    ) : sizesLoading ? (
                      // Purely a loading placeholder shape — 9 is just today's
                      // real row count in size_chart, not a cap on how many
                      // sizes can actually load; the real buttons below always
                      // come straight from the query, never from this number.
                      <div className="sizes" aria-hidden="true">
                        {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} width={52} height={38} />)}
                      </div>
                    ) : (
                      <div className="sizes">
                        {sizes.map((s) => (
                          <button
                            key={s.size}
                            type="button"
                            aria-pressed={size === s.size}
                            onClick={() => setSize(s.size)}
                          >
                            {s.size}
                          </button>
                        ))}
                      </div>
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
                  {user
                    ? submitting ? 'Reserving…' : 'Reserve my order'
                    : submitting ? 'Redirecting…' : 'Sign in to reserve'}
                </button>
                {!user && (
                  <p className="draft-note">We only need this so we can email you when your payment is verified.</p>
                )}
                {submitError && <p className="auth-error">{submitError}</p>}
              </form>
            </div>
          )}

          <div className={`panel bank ${bankReveal.className}`} ref={bankReveal.ref} style={bankReveal.style}>
            <h3>Where to deposit</h3>
            <p className="hint">Bank transfer or over-the-counter deposit. Keep the slip — you&apos;ll upload it.</p>
            {settingsLoading ? (
              <div aria-hidden="true">
                <Skeleton width={90} height={9} style={{ marginTop: 16 }} />
                <Skeleton width={160} height={15} style={{ marginTop: 6 }} />
                <Skeleton width={90} height={9} style={{ marginTop: 16 }} />
                <Skeleton width={110} height={15} style={{ marginTop: 6 }} />
                <Skeleton width={90} height={9} style={{ marginTop: 16 }} />
                <Skeleton width={180} height={15} style={{ marginTop: 6 }} />
              </div>
            ) : settings ? (
              <dl>
                <dt>Account name</dt><dd className="name">{settings.bank_account_name}</dd>
                <dt>Account number</dt>
                <dd className="copy-row"><span>{settings.bank_account_no}</span><button onClick={copyAcc}>Copy</button></dd>
                <dt>Bank</dt><dd className="name">{settings.bank_branch}</dd>
              </dl>
            ) : (
              <p className="auth-error">Couldn&apos;t load deposit details — message the committee below.</p>
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
