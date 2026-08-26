import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useReveals } from '../hooks/useAdminData';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import Switch from '../components/Switch';
import type { Reveal } from '../lib/database.types';

export default function Reveals() {
  const { data: reveals, loading, refetch } = useReveals();
  const { confirm, dialog } = useConfirmDialog();

  if (loading) return <p className="page-note">Loading…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Sealed cards</p>
          <h1 className="page-title">Reveals</h1>
        </div>
        <p className="page-note">Editing the value or detail is safe any time — the public site only ever sees them once the switch is on.</p>
      </div>

      {reveals.map((r) => (
        <RevealRow key={r.key} reveal={r} onSaved={refetch} confirm={confirm} />
      ))}
      {dialog}
    </>
  );
}

function RevealRow({
  reveal,
  onSaved,
  confirm,
}: {
  reveal: Reveal;
  onSaved: () => void;
  confirm: (message: string, action: () => Promise<void> | void, confirmLabel?: string) => void;
}) {
  const [value, setValue] = useState(reveal.value ?? '');
  const [detail, setDetail] = useState(reveal.detail ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = value !== (reveal.value ?? '') || detail !== (reveal.detail ?? '');

  const save = async () => {
    setSaving(true);
    await supabase.from('reveals').update({ value, detail }).eq('key', reveal.key);
    setSaving(false);
    onSaved();
  };

  const toggle = () => {
    if (!reveal.is_revealed) {
      confirm(
        `This announces ${reveal.label} to everyone, immediately.`,
        async () => {
          await supabase.from('reveals').update({ is_revealed: true }).eq('key', reveal.key);
          onSaved();
        },
        'Announce it'
      );
    } else {
      supabase.from('reveals').update({ is_revealed: false }).eq('key', reveal.key).then(() => onSaved());
    }
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
        <div>
          <h3>{reveal.label}</h3>
          <span className={`badge ${reveal.is_revealed ? 'badge-done' : 'badge-live'}`}>
            <span className="dot" />
            {reveal.is_revealed ? 'Announced' : 'Sealed'}
          </span>
        </div>
        <Switch checked={reveal.is_revealed} onChange={toggle} />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Value</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="What students will see" />
        </div>
        <div className="field">
          <label>Detail (optional)</label>
          <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Extra line, shown under the value" />
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" disabled={!dirty || saving} onClick={save}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
