import { useDashboard } from '../hooks/useDashboard';
import BarChart from '../components/BarChart';
import type { OrderStatus } from '../lib/database.types';

const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  slip_uploaded: 'Slip uploaded',
  approved: 'Approved',
  rejected: 'Rejected',
  ready_for_collection: 'Ready for collection',
  collected: 'Collected',
  cancelled: 'Cancelled',
};

export default function Dashboard() {
  const { data, loading } = useDashboard();

  if (loading || !data) return <p className="page-note">Loading…</p>;

  const maxSize = Math.max(1, ...data.sizeBreakdown.map((s) => s.units));
  const maxBatch = Math.max(1, ...data.batchBreakdown.map((b) => b.orders));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="page-title">Dashboard</h1>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">Total orders</div>
          <div className="v">{data.totalOrders}</div>
        </div>
        <div className="stat-card">
          <div className="k">Confirmed revenue</div>
          <div className="v gold">Rs {data.confirmedRevenue.toLocaleString('en-LK')}</div>
        </div>
        <div className="stat-card">
          <div className="k">Units sold</div>
          <div className="v">{data.unitsSold}</div>
        </div>
      </div>

      <div className="panel">
        <h3>Orders by status</h3>
        <p className="hint">Every order, regardless of payment state.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {data.revenue.map((r) => (
            <span key={r.status} className="badge badge-done">
              {STATUS_LABEL[r.status] ?? r.status} — {r.orders} · Rs {Number(r.value).toLocaleString('en-LK')}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Size breakdown</h3>
        <p className="hint">Approved, ready-for-collection and collected orders only — this IS the print order.</p>
        {data.sizeBreakdown.length === 0 ? (
          <p className="page-note">No confirmed tee orders yet.</p>
        ) : (
          <BarChart rows={data.sizeBreakdown.map((s) => ({ label: s.size, value: s.units, max: maxSize }))} />
        )}
      </div>

      <div className="panel">
        <h3>Batch breakdown</h3>
        <p className="hint" style={{ marginBottom: 20 }}>Confirmed orders, by batch.</p>
        {data.batchBreakdown.length === 0 ? (
          <p className="page-note">No confirmed orders yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Batch</th><th>Orders</th><th>Value</th></tr>
              </thead>
              <tbody>
                {data.batchBreakdown.map((b) => (
                  <tr key={b.batch}>
                    <td className="emphasis">{b.batch}</td>
                    <td>{b.orders}</td>
                    <td>Rs {Number(b.value).toLocaleString('en-LK')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <BarChart rows={data.batchBreakdown.map((b) => ({ label: b.batch, value: b.orders, max: maxBatch }))} />
        </div>
      </div>
    </>
  );
}
