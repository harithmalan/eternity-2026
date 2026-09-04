import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ATTENDEE_LABEL } from './OrderFilterBar';
import type { AdminOrderRow, Order } from '../lib/database.types';

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  slip_uploaded: 'Slip uploaded',
  approved: 'Approved',
  rejected: 'Rejected',
  ready_for_collection: 'Ready for collection',
  collected: 'Collected',
  cancelled: 'Cancelled',
};

interface Props {
  order: AdminOrderRow | null;
  onClose: () => void;
  onChanged: () => void;
}

export default function OrderDrawer({ order, onClose, onChanged }: Props) {
  const { user } = useAuth();
  const [rendered, setRendered] = useState<AdminOrderRow | null>(null);
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [slipError, setSlipError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const show = !!order;

  useEffect(() => {
    if (order) {
      setRendered(order);
      setRejecting(false);
      setReason('');
      setSlipUrl(null);
      setSlipError(null);
      if (order.slip_path) {
        supabase.storage
          .from('slips')
          .createSignedUrl(order.slip_path, 60)
          .then(({ data, error }) => {
            if (error) setSlipError(error.message);
            else setSlipUrl(data?.signedUrl ?? null);
          });
      }
    } else {
      const t = setTimeout(() => setRendered(null), 300);
      return () => clearTimeout(t);
    }
  }, [order]);

  if (!rendered) {
    return <div className={`drawer-overlay${show ? ' show' : ''}`} onClick={onClose} />;
  }

  const act = async (patch: Partial<Order>) => {
    setBusy(true);
    await supabase.from('orders').update(patch).eq('code', rendered.code);
    setBusy(false);
    onChanged();
    onClose();
  };

  const approve = () => act({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id });
  const markReady = () => act({ status: 'ready_for_collection', ready_at: new Date().toISOString() });
  const markCollected = () => act({ status: 'collected', collected_at: new Date().toISOString() });
  const reject = () => {
    if (!reason.trim()) return;
    act({
      status: 'rejected',
      rejection_reason: reason.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id,
    });
  };

  return (
    <>
      <div className={`drawer-overlay${show ? ' show' : ''}`} onClick={onClose} />
      <div className={`drawer${show ? ' show' : ''}`}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">{STATUS_LABEL[rendered.status] ?? rendered.status}</p>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 24, margin: '6px 0 0' }}>{rendered.code}</h2>
          </div>
          <button className="drawer-close" onClick={onClose}>Close</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-col">
            <p className="eyebrow" style={{ marginBottom: 12 }}>Deposit slip</p>
            <div className="slip-frame">
              {!rendered.slip_path && <p className="page-note">No slip uploaded yet.</p>}
              {rendered.slip_path && slipError && <p className="page-note">Couldn&apos;t load slip: {slipError}</p>}
              {rendered.slip_path && !slipError && !slipUrl && <p className="page-note">Loading…</p>}
              {slipUrl && (
                rendered.slip_path?.toLowerCase().endsWith('.pdf') ? (
                  <a className="btn btn-ghost" href={slipUrl} target="_blank" rel="noopener noreferrer">Open PDF slip</a>
                ) : (
                  <img src={slipUrl} alt="Payment slip" />
                )
              )}
            </div>
          </div>

          <div className="drawer-col">
            <p className="eyebrow" style={{ marginBottom: 12 }}>Order details</p>
            <dl style={{ margin: 0, fontSize: 13 }}>
              <Detail label="Name" value={rendered.full_name} />
              <Detail label="Attendee type" value={ATTENDEE_LABEL[rendered.attendee_type]} />
              {rendered.attendee_type === 'alumni' ? (
                <>
                  <Detail label="NIC" value={rendered.nic ?? '—'} />
                  <Detail label="Entry pass" value={rendered.pass_code ?? 'Not issued yet'} />
                  <Detail
                    label="Checked in"
                    value={rendered.checked_in_at ? new Date(rendered.checked_in_at).toLocaleString('en-LK') : 'Not yet'}
                  />
                </>
              ) : (
                <>
                  <Detail label="SA / UOB number" value={rendered.sa_number ?? '—'} />
                  <Detail label="Batch" value={rendered.batch ?? '—'} />
                </>
              )}
              <Detail label="Center" value={rendered.center ?? '—'} />
              <Detail label="Phone" value={rendered.phone} />
              <Detail label="Email" value={rendered.email} />
              <Detail label="Items" value={rendered.items ?? '—'} />
              <Detail label="Total" value={`Rs ${Number(rendered.total).toLocaleString('en-LK')}`} emphasis />
              <Detail label="Reserved" value={new Date(rendered.created_at).toLocaleString('en-LK')} />
              {rendered.reviewed_at && <Detail label="Reviewed" value={new Date(rendered.reviewed_at).toLocaleString('en-LK')} />}
              {rendered.ready_at && <Detail label="Ready since" value={new Date(rendered.ready_at).toLocaleString('en-LK')} />}
              {rendered.collected_at && <Detail label="Collected" value={new Date(rendered.collected_at).toLocaleString('en-LK')} />}
            </dl>

            {rendered.status === 'rejected' && rendered.rejection_reason && (
              <div className="badge badge-warn" style={{ display: 'block', marginTop: 16, whiteSpace: 'normal' }}>
                {rendered.rejection_reason}
              </div>
            )}
          </div>
        </div>

        {rejecting ? (
          <div className="drawer-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="field" style={{ marginBottom: 10 }}>
              <label>Reason for rejecting <span style={{ color: 'var(--gold)' }}>*</span></label>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shown to the student, plainly — no need to soften it." />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setRejecting(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-danger" onClick={reject} disabled={busy || !reason.trim()}>Confirm rejection</button>
            </div>
          </div>
        ) : (
          <div className="drawer-actions">
            <button className="btn btn-gold" disabled={busy || rendered.status === 'approved'} onClick={approve}>Approve</button>
            <button className="btn btn-danger" disabled={busy || rendered.status === 'rejected'} onClick={() => setRejecting(true)}>Reject</button>
            <button className="btn btn-ghost" disabled={busy || rendered.status === 'ready_for_collection'} onClick={markReady}>Mark ready</button>
            <button className="btn btn-ghost" disabled={busy || rendered.status === 'collected'} onClick={markCollected}>Mark collected</button>
          </div>
        )}
      </div>
    </>
  );
}

function Detail({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <dt style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dust-dim)' }}>{label}</dt>
      <dd style={{ margin: '4px 0 0', color: emphasis ? 'var(--gold)' : 'var(--chrome)', fontFamily: emphasis ? 'var(--f-mono)' : undefined }}>{value}</dd>
    </div>
  );
}
