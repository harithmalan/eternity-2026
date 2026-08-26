import { supabase } from '../lib/supabase';
import { useFeatures } from '../hooks/useAdminData';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import Switch from '../components/Switch';

export default function Features() {
  const { data: features, loading, refetch } = useFeatures();
  const { confirm, dialog } = useConfirmDialog();

  if (loading) return <p className="page-note">Loading…</p>;

  const toggle = (key: string, label: string, isLive: boolean) => {
    if (!isLive) {
      confirm(
        `This makes ${label} live for everyone, immediately.`,
        async () => {
          await supabase.from('features').update({ is_live: true }).eq('key', key);
          refetch();
        },
        'Go live'
      );
    } else {
      supabase.from('features').update({ is_live: false }).eq('key', key).then(() => refetch());
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Feature flags</p>
          <h1 className="page-title">Features</h1>
        </div>
        <p className="page-note">Read live by every visitor's browser — flipping one takes effect immediately, no deploy.</p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Feature</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.key} style={{ cursor: 'default' }}>
                <td className="emphasis">{f.label}</td>
                <td>
                  <span className={`badge ${f.is_live ? 'badge-live' : 'badge-off'}`}>
                    <span className="dot" />
                    {f.is_live ? 'Live' : 'Locked'}
                  </span>
                </td>
                <td>
                  <Switch checked={f.is_live} onChange={() => toggle(f.key, f.label, f.is_live)} />
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
