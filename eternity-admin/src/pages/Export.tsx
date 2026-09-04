import { createElement, useMemo, useState } from 'react';
import { EMPTY_FILTERS, useOrders, type OrderFilters } from '../hooks/useOrders';
import { useBatches, useCenters, useProducts, useSizeChart } from '../hooks/useAdminData';
import OrderFilterBar, { ATTENDEE_LABEL, STATUS_LABEL } from '../components/OrderFilterBar';
import { downloadBlob, ordersToCsv } from '../lib/csv';
import type { BatchBreakdownEntry, SizeBreakdownEntry } from '../pdf/OrdersReport';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Export() {
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
  const { orders, loading } = useOrders(filters);
  const { data: batches } = useBatches();
  const { data: centers } = useCenters();
  const { data: products } = useProducts();
  const { data: sizeChart } = useSizeChart();
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const productNames = useMemo(() => Array.from(new Set(products.map((p) => p.name))), [products]);

  // size_chart.sort is the real, current order — reading it here instead of
  // a hardcoded list is what keeps this correct whenever sizes are added or
  // removed (a hardcoded 7-size list already went stale once, silently
  // mis-sorting the two sizes it didn't know about).
  const sizeBreakdown = useMemo<SizeBreakdownEntry[]>(() => {
    const order = new Map(sizeChart.map((s) => [s.size, s.sort]));
    const map = new Map<string, number>();
    orders.forEach((o) => o.items_json?.forEach((i) => {
      if (i.size) map.set(i.size, (map.get(i.size) ?? 0) + i.qty);
    }));
    return Array.from(map.entries())
      .map(([size, units]) => ({ size, units }))
      .sort((a, b) => (order.get(a.size) ?? 999) - (order.get(b.size) ?? 999));
  }, [orders, sizeChart]);

  const batchBreakdown = useMemo<BatchBreakdownEntry[]>(() => {
    const map = new Map<string, { orders: number; value: number }>();
    orders.forEach((o) => {
      // Alumni orders carry no batch — grouped under a label of their own
      // rather than dropped or merged into a real batch's numbers.
      const key = o.batch ?? 'Alumni';
      const entry = map.get(key) ?? { orders: 0, value: 0 };
      entry.orders += 1;
      entry.value += Number(o.total);
      map.set(key, entry);
    });
    return Array.from(map.entries())
      .map(([batch, v]) => ({ batch, ...v }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(filters.status ? STATUS_LABEL[filters.status] : 'All statuses');
    if (filters.batch) parts.push(filters.batch);
    if (filters.product) parts.push(filters.product);
    if (filters.from || filters.to) parts.push(`${filters.from || '…'} – ${filters.to || '…'}`);
    if (filters.search) parts.push(`"${filters.search}"`);
    return parts.join(' · ');
  }, [filters]);

  const exportCsv = () => {
    setExporting('csv');
    const csv = ordersToCsv(orders);
    downloadBlob(csv, `eternity-orders-${today()}.csv`, 'text/csv;charset=utf-8');
    setExporting(null);
  };

  const exportPdf = async () => {
    setExporting('pdf');
    // @react-pdf/renderer pulls in a full PDF layout engine + font parser —
    // heavy enough that it shouldn't be in the main bundle every admin
    // loads just to see the Dashboard. Load it only when someone actually
    // clicks Export PDF.
    const [{ pdf }, { registerPdfFonts }, { default: OrdersReport }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('../lib/pdfFonts'),
      import('../pdf/OrdersReport'),
    ]);
    registerPdfFonts();
    // OrdersReport renders a <Document> internally, but pdf()'s type only
    // accepts a literal ReactElement<DocumentProps> — it doesn't know that
    // about a wrapper component built via a dynamic import. True at
    // runtime, not expressible here without this cast.
    const element = createElement(OrdersReport, {
      orders,
      sizeBreakdown,
      batchBreakdown,
      filterSummary: filterSummary || 'All orders',
      generatedAt: new Date(),
    }) as Parameters<typeof pdf>[0];
    const blob = await pdf(element).toBlob();
    downloadBlob(blob, `eternity-orders-${today()}.pdf`, 'application/pdf');
    setExporting(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{orders.length} order{orders.length === 1 ? '' : 's'} in view</p>
          <h1 className="page-title">Export</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" disabled={loading || exporting !== null} onClick={exportCsv}>
            {exporting === 'csv' ? 'Preparing…' : 'Export CSV'}
          </button>
          <button className="btn btn-gold" disabled={loading || exporting !== null} onClick={exportPdf}>
            {exporting === 'pdf' ? 'Preparing…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <p className="page-note" style={{ marginBottom: 20 }}>
        Both exports reflect exactly the filters below — filter first, then export. CSV is raw, for the printer and the treasurer.
        PDF is the designed report for committee meetings.
      </p>

      <OrderFilterBar filters={filters} setFilters={setFilters} batches={batches} centers={centers} productNames={productNames} />

      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Preview</h3>
        <p className="hint">{orders.length} orders · {sizeBreakdown.reduce((s, r) => s + r.units, 0)} tees · Rs {orders.reduce((s, o) => s + Number(o.total), 0).toLocaleString('en-LK')} total</p>
        {loading ? (
          <p className="page-note">Loading…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Code</th><th>Name</th><th>Type</th><th>Batch / Center</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.code} style={{ cursor: 'default' }}>
                    <td className="emphasis">{o.code}</td>
                    <td style={{ color: 'var(--chrome)' }}>{o.full_name}</td>
                    <td>{ATTENDEE_LABEL[o.attendee_type]}</td>
                    <td>{o.attendee_type === 'alumni' ? o.center ?? '—' : `${o.batch ?? '—'} · ${o.center ?? '—'}`}</td>
                    <td>Rs {Number(o.total).toLocaleString('en-LK')}</td>
                    <td>{STATUS_LABEL[o.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {orders.length > 8 && <p className="page-note" style={{ marginTop: 10 }}>…and {orders.length - 8} more in the export.</p>}
      </div>
    </>
  );
}
