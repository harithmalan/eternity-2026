import type { AdminOrderRow } from './database.types';

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// NIC is deliberately never included here — it's collected only for pass
// issuance and is meant to stay in the drawer's per-order view, not ride
// along in a CSV that gets forwarded, printed, or left on a desk.
export function ordersToCsv(orders: AdminOrderRow[]): string {
  const headers = [
    'Code', 'Status', 'Name', 'Attendee Type', 'SA Number', 'Batch', 'Center', 'Phone', 'Email',
    'Total', 'Items', 'Reserved At', 'Reviewed At', 'Ready At', 'Collected At', 'Rejection Reason',
  ];
  const rows = orders.map((o) => [
    o.code, o.status, o.full_name, o.attendee_type, o.sa_number ?? '', o.batch ?? '', o.center, o.phone, o.email,
    o.total, o.items ?? '', o.created_at, o.reviewed_at ?? '', o.ready_at ?? '', o.collected_at ?? '', o.rejection_reason ?? '',
  ]);
  return [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
