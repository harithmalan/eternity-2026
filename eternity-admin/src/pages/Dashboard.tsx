import { Link } from 'react-router-dom';
import { useDashboard } from '../hooks/useDashboard';
import { useMerchSold } from '../hooks/useMerchSold';
import BarChart from '../components/BarChart';
import type { OrderStatus, ProductTotalsRow } from '../lib/database.types';

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
  const { data: merch, loading: merchLoading } = useMerchSold();

  if (merchLoading || !merch) return <p className="page-note">Loading...</p>;

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

      <MerchSoldPanel
        totalTees={merch.totals.total_tees}
        totalBands={merch.totals.total_bands}
        teeLimit={merch.settings.tee_print_limit}
        bandLimit={merch.settings.band_print_limit}
        products={merch.products}
      />

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
        <Link to="/registrations?tab=alumni_rsvp" className="stat-card" style={{ display: 'block' }}>
          <div className="k">Alumni pending review</div>
          <div className="v gold">{data.pendingAlumniCount}</div>
        </Link>
        <Link to="/registrations?tab=sliit_student" className="stat-card" style={{ display: 'block' }}>
          <div className="k">SLIIT student IDs pending review</div>
          <div className="v gold">{data.pendingSliitCount}</div>
        </Link>
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

function MerchSoldPanel({
  totalTees,
  totalBands,
  teeLimit,
  bandLimit,
  products,
}: {
  totalTees: number;
  totalBands: number;
  teeLimit: number | null;
  bandLimit: number | null;
  products: ProductTotalsRow[];
}) {
  return (
    <section className="merch-sold" aria-labelledby="merch-sold-title">
      <div className="merch-sold-head">
        <p className="eyebrow">Live print report</p>
        <h2 id="merch-sold-title">Merch sold</h2>
      </div>
      <div className="merch-sold-stats">
        <MerchStat label="Tees sold" total={totalTees} limit={teeLimit} />
        <MerchStat label="Wristbands sold" total={totalBands} limit={bandLimit} />
      </div>
      <div className="merch-sold-breakdown table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.slug}>
                <td className="emphasis">{product.name}</td>
                <td>{Number(product.units_sold).toLocaleString('en-LK')}</td>
                <td>Rs {Number(product.revenue).toLocaleString('en-LK')}</td>
              </tr>
            ))}
            <tr className="merch-sold-total"><td>Total tees (all sources)</td><td colSpan={2}>{Number(totalTees).toLocaleString('en-LK')}</td></tr>
            <tr className="merch-sold-total"><td>Total bands (all sources)</td><td colSpan={2}>{Number(totalBands).toLocaleString('en-LK')}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MerchStat({ label, total, limit }: { label: string; total: number; limit: number | null }) {
  const hasLimit = limit !== null;
  const ratio = hasLimit && limit > 0 ? total / limit : 1;
  const closeToLimit = hasLimit && ratio > 0.95;

  return (
    <article className="merch-sold-stat">
      <p className="merch-sold-label">{label}</p>
      <strong>{Number(total).toLocaleString('en-LK')}</strong>
      <p className="merch-sold-note">incl. bundles</p>
      {hasLimit && (
        <div className="merch-sold-limit">
          <div className="merch-sold-limit-label">{Number(total).toLocaleString('en-LK')} / {Number(limit).toLocaleString('en-LK')}</div>
          <div className="merch-sold-progress" aria-label={`${label}: ${total} of ${limit}`}>
            <span className={ratio >= 0.8 ? 'gold' : ''} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
          </div>
          {closeToLimit && <p className="merch-sold-warning">Close to your print limit.</p>}
        </div>
      )}
    </article>
  );
}
