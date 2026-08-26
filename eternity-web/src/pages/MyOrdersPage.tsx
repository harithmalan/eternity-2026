import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useMyOrders, type OrderWithItems } from '../hooks/useMyOrders';
import PaymentCountdown from '../components/PaymentCountdown';
import { useToast } from '../components/Toast';
import Skeleton from '../components/Skeleton';
import type { OrderStatus } from '../lib/database.types';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'awaiting_payment', label: 'Reserved' },
  { status: 'slip_uploaded', label: 'Slip received' },
  { status: 'approved', label: 'Payment verified' },
  { status: 'ready_for_collection', label: 'Ready to collect' },
  { status: 'collected', label: 'Collected' },
];

function stepIndex(status: OrderStatus): number {
  // A rejected order did reach "slip received" before it was kicked back.
  if (status === 'rejected') return 1;
  return STEPS.findIndex((s) => s.status === status);
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' } as const;

export default function MyOrdersPage() {
  const { user } = useAuth();
  const { orders, loading, refetch } = useMyOrders(user?.id);
  const { say } = useToast();

  if (loading) {
    return (
      <section className="band">
        <div className="shell">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Your orders</p>
              <h2 className="sec-title">Track your <i>reservation</i>.</h2>
            </div>
          </div>
          <div className="order-card" aria-hidden="true">
            <div className="order-head">
              <Skeleton width={110} height={22} />
              <Skeleton width={70} height={18} />
            </div>
            <Skeleton className="skeleton-text" width="60%" />
            <Skeleton height={40} style={{ marginTop: 24 }} />
          </div>
        </div>
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <section className="band">
        <div className="shell">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Your orders</p>
              <h2 className="sec-title">No orders <i>yet</i>.</h2>
            </div>
          </div>
          <Link className="btn btn-gold" to="/#order">Pre-order merch</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="band">
      <div className="shell">
        <div className="sec-head">
          <div>
            <p className="eyebrow">Your orders</p>
            <h2 className="sec-title">Track your <i>reservation</i>.</h2>
          </div>
        </div>
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} onUploaded={refetch} say={say} />
        ))}
      </div>
    </section>
  );
}

function OrderCard({
  order,
  onUploaded,
  say,
}: {
  order: OrderWithItems;
  onUploaded: () => void;
  say: (msg: string) => void;
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const current = stepIndex(order.status);
  const canUpload = order.status === 'awaiting_payment' || order.status === 'rejected';

  const onFile = async (file: File) => {
    if (!user) return;
    if (!(file.type in ACCEPTED)) {
      say('Upload a JPG, PNG or PDF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      say('That file is over 5MB.');
      return;
    }

    setUploading(true);
    const ext = ACCEPTED[file.type as keyof typeof ACCEPTED];
    const path = `${user.id}/${order.code}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('slips').upload(path, file, { upsert: true });
    if (uploadError) {
      say(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        slip_path: path,
        slip_uploaded_at: new Date().toISOString(),
        status: 'slip_uploaded',
        rejection_reason: null,
      })
      .eq('id', order.id);

    setUploading(false);
    if (updateError) {
      say(updateError.message);
      return;
    }
    say('Slip uploaded — the committee will verify it soon.');
    onUploaded();
  };

  return (
    <div className="order-card">
      <div className="order-head">
        <h3 className="order-code">{order.code}</h3>
        <span className="order-total">Rs {order.total.toLocaleString('en-LK')}</span>
      </div>
      <p className="order-items">
        {order.items.map((i) => `${i.product_name}${i.size ? ` (${i.size})` : ''} ×${i.qty}`).join(', ')}
      </p>

      <div className="timeline">
        {STEPS.map((s, i) => (
          <div key={s.status} className={`timeline-step${i < current ? ' done' : ''}${i === current ? ' current' : ''}`}>
            <div className="dot" />
            <div className="label">{s.label}</div>
          </div>
        ))}
      </div>

      {order.status === 'rejected' && (
        <div className="order-rejected">
          <b>Rejected.</b> {order.rejection_reason || 'The committee could not verify your slip.'} Upload a new one below.
        </div>
      )}

      {(order.status === 'awaiting_payment' || order.status === 'rejected') && (
        <PaymentCountdown dueAt={order.payment_due_at} />
      )}

      {canUpload && (
        <div className="slip-upload">
          <input
            ref={fileRef}
            id={`slip-${order.id}`}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = '';
            }}
          />
          <label className="btn btn-ghost" htmlFor={`slip-${order.id}`} style={{ cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? 'Uploading…' : order.status === 'rejected' ? 'Re-upload slip' : 'Upload slip'}
          </label>
          <span className="slip-status">JPG, PNG or PDF · max 5MB</span>
        </div>
      )}
    </div>
  );
}
