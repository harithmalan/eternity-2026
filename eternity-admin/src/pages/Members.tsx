import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProfiles } from '../hooks/useAdminData';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

export default function Members() {
  const { data: profiles, loading, refetch } = useProfiles();
  const { confirm, dialog } = useConfirmDialog();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) => p.email?.toLowerCase().includes(q) || p.full_name?.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  if (loading) return <p className="page-note">Loading…</p>;

  const setRole = (id: string, name: string | null, email: string | null, role: 'admin' | 'user') => {
    const who = name || email || 'this account';
    const message =
      role === 'admin'
        ? `Give ${who} committee access? They'll be able to approve payments and see every student's order.`
        : `Remove committee access from ${who}?`;
    confirm(
      message,
      async () => {
        await supabase.from('profiles').update({ role }).eq('id', id);
        refetch();
      },
      role === 'admin' ? 'Promote' : 'Revoke'
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Committee access</p>
          <h1 className="page-title">Members</h1>
        </div>
        <p className="page-note">Superadmin only. Superadmin itself isn't assignable here — that's a manual step in the database.</p>
      </div>

      <div className="table-toolbar">
        <input type="search" placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ cursor: 'default' }}>
                <td className="emphasis">{p.full_name || '—'}</td>
                <td>{p.email}</td>
                <td>
                  <span className={`badge ${p.role === 'superadmin' ? 'badge-live' : p.role === 'admin' ? 'badge-done' : 'badge-off'}`}>
                    {p.role}
                  </span>
                </td>
                <td>
                  {p.role === 'user' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setRole(p.id, p.full_name, p.email, 'admin')}>
                      Promote to admin
                    </button>
                  )}
                  {p.role === 'admin' && (
                    <button className="btn btn-danger btn-sm" onClick={() => setRole(p.id, p.full_name, p.email, 'user')}>
                      Revoke admin
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </>
  );
}
