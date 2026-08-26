import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProducts, useSettings } from '../hooks/useAdminData';
import type { Product } from '../lib/database.types';

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Products() {
  const { data: products, loading: productsLoading, refetch: refetchProducts } = useProducts();
  const { settings, loading: settingsLoading, refetch: refetchSettings } = useSettings();

  if (productsLoading || settingsLoading || !settings) return <p className="page-note">Loading…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Pricing</p>
          <h1 className="page-title">Products</h1>
        </div>
        <p className="page-note">Existing orders keep the price they were placed at — <code>unit_price</code> is stamped once, never recomputed.</p>
      </div>

      <EarlyBirdPanel settings={settings} onSaved={refetchSettings} />

      {products.map((p) => (
        <ProductRow key={p.id} product={p} onSaved={refetchProducts} />
      ))}
    </>
  );
}

function EarlyBirdPanel({
  settings,
  onSaved,
}: {
  settings: { early_bird_ends_at: string };
  onSaved: () => void;
}) {
  const [value, setValue] = useState(toLocalInputValue(settings.early_bird_ends_at));
  const [saving, setSaving] = useState(false);
  const dirty = value !== toLocalInputValue(settings.early_bird_ends_at);

  const save = async () => {
    setSaving(true);
    await supabase.from('settings').update({ early_bird_ends_at: new Date(value).toISOString() }).eq('id', 1);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="panel">
      <h3>Early bird ends</h3>
      <p className="hint">Every product's active price flips from early to regular the instant this passes.</p>
      <div className="field" style={{ maxWidth: 280 }}>
        <label>Ends at</label>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button className="btn btn-ghost btn-sm" disabled={!dirty || saving} onClick={save}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function ProductRow({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [early, setEarly] = useState(String(product.early_price));
  const [regular, setRegular] = useState(String(product.regular_price));
  const [saving, setSaving] = useState(false);
  const dirty = early !== String(product.early_price) || regular !== String(product.regular_price);

  const save = async () => {
    const earlyNum = Number(early);
    const regularNum = Number(regular);
    if (!Number.isFinite(earlyNum) || !Number.isFinite(regularNum)) return;
    setSaving(true);
    await supabase.from('products').update({ early_price: earlyNum, regular_price: regularNum }).eq('id', product.id);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h3>{product.name}</h3>
        <span className="badge badge-off">{product.sku}</span>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Early price (Rs)</label>
          <input type="number" min={0} step="1" value={early} onChange={(e) => setEarly(e.target.value)} />
        </div>
        <div className="field">
          <label>Regular price (Rs)</label>
          <input type="number" min={0} step="1" value={regular} onChange={(e) => setRegular(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" disabled={!dirty || saving} onClick={save}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
