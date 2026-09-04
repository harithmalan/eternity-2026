import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { EMPTY_FILTERS, useOrders, type OrderFilters } from '../hooks/useOrders';
import { useBatches, useCenters, useProducts } from '../hooks/useAdminData';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import OrderDrawer from '../components/OrderDrawer';
import OrderFilterBar, { ATTENDEE_LABEL, STATUS_LABEL } from '../components/OrderFilterBar';
import type { AdminOrderRow } from '../lib/database.types';

export default function Orders() {
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
  const { orders, loading, refetch } = useOrders(filters);
  const { data: batches } = useBatches();
  const { data: centers } = useCenters();
  const { data: products } = useProducts();
  const { confirm, dialog } = useConfirmDialog();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openOrder, setOpenOrder] = useState<AdminOrderRow | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.code));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.code)));
  };
  const toggleOne = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const bulkMarkReady = () => {
    const codes = Array.from(selected);
    confirm(
      `Mark ${codes.length} order${codes.length === 1 ? '' : 's'} ready for collection?`,
      async () => {
        setBulkBusy(true);
        await supabase.from('orders').update({ status: 'ready_for_collection', ready_at: new Date().toISOString() }).in('code', codes);
        setBulkBusy(false);
        setSelected(new Set());
        refetch();
      },
      'Mark ready'
    );
  };

  const productNames = useMemo(() => Array.from(new Set(products.map((p) => p.name))), [products]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">{orders.length} order{orders.length === 1 ? '' : 's'}</p>
          <h1 className="page-title">Orders</h1>
        </div>
      </div>

      <OrderFilterBar filters={filters} setFilters={setFilters} batches={batches} centers={centers} productNames={productNames} />

      {selected.size > 0 && (
        <div className="table-toolbar" style={{ marginTop: -6 }}>
          <span className="badge badge-done">{selected.size} selected</span>
          <button className="btn btn-gold btn-sm" disabled={bulkBusy} onClick={bulkMarkReady}>Mark ready</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      {loading ? (
        <p className="page-note">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="page-note">No orders match these filters.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 1 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} onClick={(e) => e.stopPropagation()} />
                </th>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Batch / Center</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Reserved</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.code} onClick={() => setOpenOrder(o)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(o.code)} onChange={() => toggleOne(o.code)} />
                  </td>
                  <td className="emphasis">{o.code}</td>
                  <td style={{ color: 'var(--chrome)' }}>{o.full_name}</td>
                  <td>{ATTENDEE_LABEL[o.attendee_type]}</td>
                  <td>{o.attendee_type === 'alumni' ? o.center : `${o.batch} · ${o.center}`}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 240 }}>{o.items ?? '—'}</td>
                  <td>Rs {Number(o.total).toLocaleString('en-LK')}</td>
                  <td><span className="badge badge-done">{STATUS_LABEL[o.status]}</span></td>
                  <td>{new Date(o.created_at).toLocaleDateString('en-LK')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OrderDrawer order={openOrder} onClose={() => setOpenOrder(null)} onChanged={refetch} />
      {dialog}
    </>
  );
}
