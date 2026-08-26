import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useBandAvailability, useSettings, useSizeAvailability } from '../hooks/useAdminData';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import BarChart from '../components/BarChart';
import type { Order } from '../lib/database.types';

const PRINT_RUN = 275;

export default function Stock() {
  const { data: sizes, loading: sizesLoading, refetch: refetchSizes } = useSizeAvailability();
  const { data: band, loading: bandLoading, refetch: refetchBand } = useBandAvailability();
  const { settings, loading: settingsLoading, refetch: refetchSettings } = useSettings();

  if (sizesLoading || bandLoading || settingsLoading || !settings) return <p className="page-note">Loading…</p>;

  const totalCap = sizes.reduce((sum, s) => sum + s.cap, 0);
  const totalTaken = sizes.reduce((sum, s) => sum + s.taken, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Print run</p>
          <h1 className="page-title">Stock</h1>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">Allocated / print run</div>
          <div className={`v${totalCap > PRINT_RUN ? ' gold' : ''}`}>{totalCap} / {PRINT_RUN}</div>
        </div>
        <div className="stat-card">
          <div className="k">Tees reserved</div>
          <div className="v">{totalTaken}</div>
        </div>
        <div className="stat-card">
          <div className="k">Wristbands reserved</div>
          <div className="v">{band?.taken ?? 0} / {band?.cap ?? 0}</div>
        </div>
      </div>

      <div className="panel">
        <h3>Tee sizes</h3>
        <p className="hint">Capacity counts every non-rejected, non-cancelled order — including ones still awaiting payment.</p>
        <BarChart rows={sizes.map((s) => ({ label: s.size, value: s.taken, max: Math.max(s.cap, s.taken, 1), soldOut: s.sold_out }))} />
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sizes.map((s) => (
            <SizeCapRow key={s.size} size={s.size} cap={s.cap} taken={s.taken} onSaved={refetchSizes} />
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Wristbands</h3>
        <p className="hint">One shared cap — wristbands aren't sized.</p>
        <BandCapRow cap={settings.band_capacity} taken={band?.taken ?? 0} onSaved={() => { refetchSettings(); refetchBand(); }} />
      </div>

      <OverdueOrders />
    </>
  );
}

function SizeCapRow({
  size,
  cap,
  taken,
  onSaved,
}: {
  size: string;
  cap: number;
  taken: number;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(String(cap));
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmDialog();
  const dirty = value !== String(cap);
  const numValue = Number(value);
  const wouldOversell = Number.isFinite(numValue) && numValue < taken;

  const doSave = async () => {
    setSaving(true);
    await supabase.from('size_stock').update({ cap: numValue }).eq('size', size);
    setSaving(false);
    onSaved();
  };

  const save = () => {
    if (!Number.isFinite(numValue) || numValue < 0) return;
    if (wouldOversell) {
      confirm(
        `${size} already has ${taken} reserved — setting capacity to ${numValue} oversells it by ${taken - numValue}. The database won't stop you; those orders already exist.`,
        doSave,
        'Set it anyway'
      );
    } else {
      doSave();
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 44, fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--chrome)' }}>{size}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: 90, background: 'rgba(5,5,7,.6)', border: '1px solid var(--line)', color: 'var(--chrome)',
          padding: '8px 10px', fontFamily: 'var(--f-mono)', fontSize: 13,
        }}
      />
      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11.5, color: 'var(--dust-dim)' }}>{taken} taken</span>
      {wouldOversell && <span className="badge badge-warn">Oversells</span>}
      <button className="btn btn-ghost btn-sm" disabled={!dirty || saving} onClick={save}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      {dialog}
    </div>
  );
}

function BandCapRow({ cap, taken, onSaved }: { cap: number; taken: number; onSaved: () => void }) {
  const [value, setValue] = useState(String(cap));
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmDialog();
  const dirty = value !== String(cap);
  const numValue = Number(value);
  const wouldOversell = Number.isFinite(numValue) && numValue < taken;

  const doSave = async () => {
    setSaving(true);
    await supabase.from('settings').update({ band_capacity: numValue }).eq('id', 1);
    setSaving(false);
    onSaved();
  };

  const save = () => {
    if (!Number.isFinite(numValue) || numValue < 0) return;
    if (wouldOversell) {
      confirm(
        `Wristbands already have ${taken} reserved — setting capacity to ${numValue} oversells it by ${taken - numValue}. The database won't stop you; those orders already exist.`,
        doSave,
        'Set it anyway'
      );
    } else {
      doSave();
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: 100, background: 'rgba(5,5,7,.6)', border: '1px solid var(--line)', color: 'var(--chrome)',
          padding: '8px 10px', fontFamily: 'var(--f-mono)', fontSize: 13,
        }}
      />
      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11.5, color: 'var(--dust-dim)' }}>{taken} taken</span>
      {wouldOversell && <span className="badge badge-warn">Oversells</span>}
      <button className="btn btn-ghost btn-sm" disabled={!dirty || saving} onClick={save}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      {dialog}
    </div>
  );
}

function OverdueOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirm, dialog } = useConfirmDialog();

  const refetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'awaiting_payment')
      .lt('payment_due_at', new Date().toISOString())
      .order('payment_due_at');
    setOrders(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
  }, []);

  const cancel = (order: Order) => {
    confirm(
      `Cancel ${order.code}? This frees the size it's holding for other students.`,
      async () => {
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
        refetch();
      },
      'Cancel order'
    );
  };

  if (loading) return null;

  return (
    <div className="panel">
      <h3>Overdue reservations</h3>
      <p className="hint">Past their 24-hour deposit window, still holding a size other students could be buying.</p>
      {orders.length === 0 ? (
        <p className="page-note">Nothing overdue.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Code</th><th>Name</th><th>Batch</th><th>Due</th><th></th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ cursor: 'default' }}>
                  <td className="emphasis">{o.code}</td>
                  <td>{o.full_name}</td>
                  <td>{o.batch}</td>
                  <td>{new Date(o.payment_due_at).toLocaleString('en-LK')}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => cancel(o)}>Cancel</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog}
    </div>
  );
}
