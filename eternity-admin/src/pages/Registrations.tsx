import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { RegistrationKind, RegistrationQueueRow, RegistrationStatus } from '../lib/database.types';

const KIND_LABEL: Record<RegistrationKind, string> = {
  alumni_rsvp: 'Alumni',
  sliit_student: 'SLIIT student',
};

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

function normalizeNic(val: string | null | undefined): string {
  if (!val) return '';
  return val.replace(/\s+/g, '').toUpperCase();
}

export default function Registrations() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: RegistrationKind = searchParams.get('tab') === 'sliit_student' ? 'sliit_student' : 'alumni_rsvp';

  const [rows, setRows] = useState<RegistrationQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus | ''>('pending');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<RegistrationQueueRow | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const setTab = (tab: RegistrationKind) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'sliit_student') next.set('tab', 'sliit_student');
      else next.delete('tab');
      return next;
    });
  };

  const refetch = useCallback(async () => {
    // Attempt reading from registration_queue view, fallback to registrations table
    const { data: queueData, error: queueError } = await supabase
      .from('registration_queue')
      .select('*');

    if (!queueError && queueData) {
      setRows(queueData as RegistrationQueueRow[]);
      setLoading(false);
      return;
    }

    const { data: tableData, error: tableError } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (tableError) {
      setError(tableError.message);
    } else {
      setRows((tableData ?? []) as RegistrationQueueRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  // Compute NIC duplicate set (NIC appears in multiple registrations or in an approved registration)
  const approvedNics = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const norm = normalizeNic(r.nic);
      if (!norm) return;
      counts.set(norm, (counts.get(norm) ?? 0) + 1);
    });
    return counts;
  }, [rows]);

  const pendingAlumniCount = useMemo(
    () => rows.filter((r) => r.kind === 'alumni_rsvp' && r.status === 'pending').length,
    [rows]
  );
  const pendingSliitCount = useMemo(
    () => rows.filter((r) => r.kind === 'sliit_student' && r.status === 'pending').length,
    [rows]
  );

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.kind !== activeTab) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (!q) return true;
      return [row.code, KIND_LABEL[row.kind], row.full_name, row.phone, row.nic, row.center]
        .some((val) => (val ?? '').toLowerCase().includes(q));
    });
  }, [rows, activeTab, statusFilter, search]);

  const approve = async (row: RegistrationQueueRow) => {
    setBusyId(row.id);
    setError(null);
    const { error } = await supabase
      .from('registrations')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
        rejection_reason: null,
      })
      .eq('id', row.id);

    if (error) setError(error.message);
    await refetch();
    setBusyId(null);
  };

  const reject = async () => {
    if (!rejecting || !reason.trim()) return;
    setBusyId(rejecting.id);
    setError(null);
    const { error } = await supabase
      .from('registrations')
      .update({
        status: 'rejected',
        rejection_reason: reason.trim(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id,
      })
      .eq('id', rejecting.id);

    if (error) setError(error.message);
    setRejecting(null);
    setReason('');
    await refetch();
    setBusyId(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Entry RSVPs</p>
          <h1 className="page-title">Registrations</h1>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`btn ${activeTab === 'alumni_rsvp' ? 'btn-gold' : 'btn-ghost'}`}
          onClick={() => setTab('alumni_rsvp')}
        >
          Alumni {pendingAlumniCount > 0 && <span style={{ opacity: 0.85 }}>({pendingAlumniCount} pending)</span>}
        </button>
        <button
          className={`btn ${activeTab === 'sliit_student' ? 'btn-gold' : 'btn-ghost'}`}
          onClick={() => setTab('sliit_student')}
        >
          SLIIT Students {pendingSliitCount > 0 && <span style={{ opacity: 0.85 }}>({pendingSliitCount} pending)</span>}
        </button>
      </div>

      {activeTab === 'sliit_student' && (
        <p className="page-note" style={{ marginBottom: 20, color: 'var(--dust-dim)' }}>
          Student ID photos are deleted automatically one week after the event.
        </p>
      )}

      <div className="table-toolbar">
        <input
          type="search"
          placeholder={activeTab === 'alumni_rsvp' ? 'Search name, phone, NIC, code...' : 'Search name, phone, code...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as RegistrationStatus | '')}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {(statusFilter !== 'pending' || search) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setStatusFilter('pending');
              setSearch('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="gate-error" style={{ marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p className="page-note">Loading registrations...</p>
      ) : visibleRows.length === 0 ? (
        <p className="page-note">No {KIND_LABEL[activeTab].toLowerCase()} registrations match this view.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                {activeTab === 'sliit_student' && <th>ID Photo</th>}
                <th>Name</th>
                {activeTab === 'alumni_rsvp' && <th>NIC</th>}
                <th>Center</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const norm = normalizeNic(row.nic);
                const isDuplicate = activeTab === 'alumni_rsvp' && norm && (approvedNics.get(norm) ?? 0) > 1;

                return (
                  <tr key={row.id}>
                    <td className="emphasis">{row.code ?? 'Pending'}</td>
                    {activeTab === 'sliit_student' && (
                      <td>
                        <StudentIdThumbnail
                          path={row.id_photo_path ?? row.student_id_path}
                          onOpenLightbox={(url) => setLightboxUrl(url)}
                        />
                      </td>
                    )}
                    <td style={{ color: 'var(--chrome)' }}>{row.full_name}</td>
                    {activeTab === 'alumni_rsvp' && (
                      <td>
                        <span>{row.nic ?? '—'}</span>
                        {isDuplicate && (
                          <span className="badge badge-warn" style={{ marginLeft: 8 }}>
                            Duplicate NIC
                          </span>
                        )}
                      </td>
                    )}
                    <td>{row.center}</td>
                    <td>{row.phone}</td>
                    <td>
                      <span
                        className={`badge ${
                          row.status === 'pending'
                            ? 'badge-warn'
                            : row.status === 'approved'
                            ? 'badge-done'
                            : 'badge-off'
                        }`}
                      >
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td>{new Date(row.created_at).toLocaleDateString('en-LK')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-gold btn-sm"
                          disabled={busyId === row.id || row.status === 'approved'}
                          onClick={() => approve(row)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={busyId === row.id || row.status === 'rejected'}
                          onClick={() => setRejecting(row)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lightbox for student ID photos */}
      {lightboxUrl && (
        <>
          <div className="drawer-overlay show" onClick={() => setLightboxUrl(null)} />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '90vh',
                background: 'var(--ink-2)',
                border: '1px solid var(--line-strong)',
                padding: 16,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 12,
              }}
            >
              <button className="btn btn-ghost btn-sm" onClick={() => setLightboxUrl(null)}>
                Close
              </button>
              <img
                src={lightboxUrl}
                alt="Student ID Full Resolution"
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
              />
            </div>
          </div>
        </>
      )}

      {/* Rejection Reason Modal/Drawer */}
      <div className={`drawer-overlay${rejecting ? ' show' : ''}`} onClick={() => setRejecting(null)} />
      <div className={`drawer${rejecting ? ' show' : ''}`}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">Reject RSVP</p>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 24, margin: '6px 0 0' }}>{rejecting?.full_name}</h2>
          </div>
          <button className="drawer-close" onClick={() => setRejecting(null)}>Close</button>
        </div>
        <div className="drawer-col">
          <div className="field">
            <label>Reason shown to visitor</label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain what they should fix (e.g. Photo unreadable)."
            />
          </div>
          <button className="btn btn-danger" disabled={!reason.trim() || !!busyId} onClick={reject}>
            Confirm rejection
          </button>
        </div>
      </div>
    </>
  );
}

function StudentIdThumbnail({
  path,
  onOpenLightbox,
}: {
  path: string | null;
  onOpenLightbox: (url: string) => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;
    let alive = true;

    // Bucket is strictly private — create 60-second signed URL
    supabase.storage
      .from('student-ids')
      .createSignedUrl(path, 60)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error || !data?.signedUrl) setError(true);
        else setSignedUrl(data.signedUrl);
      });

    return () => {
      alive = false;
    };
  }, [path]);

  if (!path) return <span style={{ color: 'var(--dust-dim)', fontSize: 11 }}>No photo</span>;
  if (error) return <span style={{ color: 'var(--gold)', fontSize: 11 }}>Failed to load</span>;
  if (!signedUrl) return <span style={{ color: 'var(--dust-dim)', fontSize: 11 }}>Loading…</span>;

  return (
    <button
      type="button"
      onClick={() => onOpenLightbox(signedUrl)}
      title="Click to expand ID photo"
      style={{
        display: 'inline-block',
        width: 48,
        height: 48,
        padding: 2,
        background: 'var(--ink-2)',
        border: '1px solid var(--line-strong)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <img
        src={signedUrl}
        alt="ID Thumbnail"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </button>
  );
}
