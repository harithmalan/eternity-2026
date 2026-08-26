import type { Batch, OrderStatus } from '../lib/database.types';
import { EMPTY_FILTERS, type OrderFilters } from '../hooks/useOrders';

const STATUSES: OrderStatus[] = [
  'awaiting_payment',
  'slip_uploaded',
  'approved',
  'rejected',
  'ready_for_collection',
  'collected',
  'cancelled',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  slip_uploaded: 'Slip uploaded',
  approved: 'Approved',
  rejected: 'Rejected',
  ready_for_collection: 'Ready for collection',
  collected: 'Collected',
  cancelled: 'Cancelled',
};

interface Props {
  filters: OrderFilters;
  setFilters: (updater: (f: OrderFilters) => OrderFilters) => void;
  batches: Batch[];
  productNames: string[];
}

export default function OrderFilterBar({ filters, setFilters, batches, productNames }: Props) {
  const active = filters.status || filters.batch || filters.product || filters.from || filters.to || filters.search;

  return (
    <div className="table-toolbar">
      <input
        type="search"
        placeholder="Search name, SA number, code, email…"
        value={filters.search}
        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
      />
      <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as OrderStatus | '' }))}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <select value={filters.batch} onChange={(e) => setFilters((f) => ({ ...f, batch: e.target.value }))}>
        <option value="">All batches</option>
        {batches.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
      </select>
      <select value={filters.product} onChange={(e) => setFilters((f) => ({ ...f, product: e.target.value }))}>
        <option value="">All products</option>
        {productNames.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
      <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
      {active && <button className="btn btn-ghost btn-sm" onClick={() => setFilters(() => EMPTY_FILTERS)}>Clear</button>}
    </div>
  );
}
