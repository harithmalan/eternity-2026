import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useEmailOutbox } from '../hooks/useAdminData';

const STATUS_CLASS: Record<string, string> = {
  sent: 'badge-done',
  queued: 'badge-warn',
  failed: 'badge-live',
};

export default function Emails() {
  const { data: rows, loading, refetch } = useEmailOutbox();
  const [retrying, setRetrying] = useState<number | null>(null);

  const retry = async (id: number) => {
    setRetrying(id);
    await supabase.from('email_outbox').update({ status: 'queued', attempts: 0, error: null }).eq('id', id);
    setRetrying(null);
    refetch();
  };

  if (loading) return <p className="page-note">Loading…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Outbox</p>
          <h1 className="page-title">Emails</h1>
        </div>
        <p className="page-note">Read-only — the send-emails worker drains this every minute. Retry resets a failed row to queued.</p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>To</th><th>Template</th><th>Status</th><th>Attempts</th><th>Error</th><th>Queued</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ cursor: 'default' }}>
                <td>{r.to_email}</td>
                <td className="emphasis">{r.template}</td>
                <td>
                  <span className={`badge ${STATUS_CLASS[r.status] ?? 'badge-off'}`}>
                    <span className="dot" />{r.status}
                  </span>
                </td>
                <td>{r.attempts}</td>
                <td style={{ maxWidth: 260, whiteSpace: 'normal', color: 'var(--dust)' }}>{r.error ?? '—'}</td>
                <td>{new Date(r.created_at).toLocaleString('en-LK')}</td>
                <td>
                  {r.status === 'failed' && (
                    <button className="btn btn-ghost btn-sm" disabled={retrying === r.id} onClick={() => retry(r.id)}>
                      {retrying === r.id ? 'Retrying…' : 'Retry'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
