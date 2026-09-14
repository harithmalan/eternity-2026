import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import type { Registration, RegistrationKind, RegistrationStatus } from '../lib/database.types';

const KIND_LABEL: Record<RegistrationKind, string> = {
  alumni_rsvp: 'Alumni',
  sliit_student: 'SLIIT student',
};

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function AlumniRsvps() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<RegistrationKind | ''>('');
  const [status, setStatus] = useState<RegistrationStatus | ''>('pending');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Registration | null>(null);
  const [studentIdUrl, setStudentIdUrl] = useState<string | null>(null);
  const [studentIdError, setStudentIdError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Registration | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    let query = supabase.from('registrations').select('*').order('created_at', { ascending: false });
    if (kind) query = query.eq('kind', kind);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) setError(error.message);
    else setRows(data ?? []);
    setLoading(false);
  }, [kind, status]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.code, KIND_LABEL[row.kind], row.full_name, row.phone, row.nic, row.center].some((value) => (value ?? '').toLowerCase().includes(q))
    );
  }, [rows, search]);

  useEffect(() => {
    setStudentIdUrl(null);
    setStudentIdError(null);
    if (!viewing?.student_id_path) return;
    supabase.storage
      .from('student-ids')
      .createSignedUrl(viewing.student_id_path, 90)
      .then(({ data, error }) => {
        if (error) setStudentIdError(error.message);
        else setStudentIdUrl(data?.signedUrl ?? null);
      });
  }, [viewing]);

  const approve = async (row: Registration) => {
    setBusyId(row.id);
    setError(null);
    const { error } = await supabase
      .from('registrations')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, rejection_reason: null })
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
          <p className="eyebrow">{visibleRows.length} RSVP{visibleRows.length === 1 ? '' : 's'}</p>
          <h1 className="page-title">Entry RSVPs</h1>
        </div>
      </div>

      <div className="table-toolbar">
        <input type="search" placeholder="Search name, phone, NIC, code..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value as RegistrationKind | '')}>
          <option value="">All types</option>
          <option value="alumni_rsvp">Alumni</option>
          <option value="sliit_student">SLIIT student</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as RegistrationStatus | '')}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {(kind || status !== 'pending' || search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setKind(''); setStatus('pending'); setSearch(''); }}>Clear</button>
        )}
      </div>

      {error && <p className="gate-error" style={{ marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p className="page-note">Loading...</p>
      ) : visibleRows.length === 0 ? (
        <p className="page-note">No entry RSVPs match this view.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Name</th>
                <th>Identity</th>
                <th>Center</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td className="emphasis">{row.code ?? 'Pending code'}</td>
                  <td>{KIND_LABEL[row.kind]}</td>
                  <td style={{ color: 'var(--chrome)' }}>{row.full_name}</td>
                  <td>{row.kind === 'sliit_student' ? <button className="btn btn-ghost btn-sm" onClick={() => setViewing(row)}>View ID</button> : row.nic}</td>
                  <td>{row.center}</td>
                  <td>{row.phone}</td>
                  <td><span className={`badge ${row.status === 'pending' ? 'badge-warn' : row.status === 'approved' ? 'badge-done' : 'badge-off'}`}>{STATUS_LABEL[row.status]}</span></td>
                  <td>{new Date(row.created_at).toLocaleDateString('en-LK')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-gold btn-sm" disabled={busyId === row.id || row.status === 'approved'} onClick={() => approve(row)}>Approve</button>
                      <button className="btn btn-danger btn-sm" disabled={busyId === row.id || row.status === 'rejected'} onClick={() => setRejecting(row)}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={`drawer-overlay${viewing ? ' show' : ''}`} onClick={() => setViewing(null)} />
      <div className={`drawer${viewing ? ' show' : ''}`}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">Student ID</p>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 24, margin: '6px 0 0' }}>{viewing?.full_name}</h2>
          </div>
          <button className="drawer-close" onClick={() => setViewing(null)}>Close</button>
        </div>
        <div className="drawer-col">
          <div className="slip-frame">
            {!viewing?.student_id_path && <p className="page-note">No student ID photo uploaded.</p>}
            {viewing?.student_id_path && studentIdError && <p className="page-note">Couldn&apos;t load photo: {studentIdError}</p>}
            {viewing?.student_id_path && !studentIdError && !studentIdUrl && <p className="page-note">Loading...</p>}
            {studentIdUrl && <img src={studentIdUrl} alt="Student ID" />}
          </div>
          {viewing && (
            <div className="drawer-actions" style={{ paddingLeft: 0, paddingRight: 0 }}>
              <button className="btn btn-gold" disabled={busyId === viewing.id || viewing.status === 'approved'} onClick={() => approve(viewing)}>Approve</button>
              <button className="btn btn-danger" disabled={busyId === viewing.id || viewing.status === 'rejected'} onClick={() => { setRejecting(viewing); setViewing(null); }}>Reject</button>
            </div>
          )}
        </div>
      </div>

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
            <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what they should fix." />
          </div>
          <button className="btn btn-danger" disabled={!reason.trim() || !!busyId} onClick={reject}>Confirm rejection</button>
        </div>
      </div>
    </>
  );
}
