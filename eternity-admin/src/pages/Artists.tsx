import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import { supabase, supabaseUrl } from '../lib/supabase';
import { useArtists, useSettings } from '../hooks/useAdminData';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import Switch from '../components/Switch';
import type { Artist, Settings } from '../lib/database.types';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const FRAME = 240; // crop preview size, css px
const OUTPUT = 480; // saved photo resolution — 2x FRAME for retina 168px display

function artistPhotoUrl(path: string | null) {
  return path ? `${supabaseUrl}/storage/v1/object/public/artists/${path}` : null;
}

function extFor(mime: string) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export default function Artists() {
  const { data: artists, loading, refetch } = useArtists();
  const { settings, loading: settingsLoading, refetch: refetchSettings } = useSettings();
  const [drawerArtist, setDrawerArtist] = useState<Artist | 'new' | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  if (loading || settingsLoading || !settings) return <p className="page-note">Loading…</p>;

  // Drag-and-drop reorder: drop target's index becomes the dragged row's new
  // position, everything else shifts, then every row's `sort` is rewritten
  // 0..n so the order persists exactly as dropped.
  const reorder = async (targetId: string) => {
    const draggedId = dragId;
    setDragId(null);
    if (!draggedId || draggedId === targetId) return;
    const ids = artists.map((a) => a.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...artists];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    await Promise.all(reordered.map((a, i) => supabase.from('artists').update({ sort: i }).eq('id', a.id)));
    refetch();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">The line-up</p>
          <h1 className="page-title">Artists</h1>
        </div>
        <p className="page-note">Drag to reorder. The public site only ever sees a row once its switch is on.</p>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: artists.length ? 18 : 0 }}>
          <h3 style={{ margin: 0 }}>Line-up</h3>
          <button className="btn btn-gold btn-sm" onClick={() => setDrawerArtist('new')}>Add artist</button>
        </div>
        {artists.length === 0 ? (
          <p className="page-note" style={{ marginTop: 18 }}>No artists yet — add the first one.</p>
        ) : (
          <div className="artist-list">
            {artists.map((a) => (
              <ArtistRow
                key={a.id}
                artist={a}
                dragging={dragId === a.id}
                onDragStart={() => setDragId(a.id)}
                onDragOverRow={(e: DragEvent) => e.preventDefault()}
                onDrop={() => reorder(a.id)}
                onEdit={() => setDrawerArtist(a)}
                onSaved={refetch}
              />
            ))}
          </div>
        )}
      </div>

      <LineupSettingsPanel settings={settings} onSaved={refetchSettings} />

      <ArtistDrawer
        artist={drawerArtist === 'new' ? null : drawerArtist}
        open={drawerArtist !== null}
        onClose={() => setDrawerArtist(null)}
        onSaved={() => {
          refetch();
          setDrawerArtist(null);
        }}
      />
    </>
  );
}

function ArtistRow({
  artist,
  dragging,
  onDragStart,
  onDragOverRow,
  onDrop,
  onEdit,
  onSaved,
}: {
  artist: Artist;
  dragging: boolean;
  onDragStart: () => void;
  onDragOverRow: (e: DragEvent) => void;
  onDrop: () => void;
  onEdit: () => void;
  onSaved: () => void;
}) {
  const { confirm: confirmPhoto, dialog: photoDialog } = useConfirmDialog();
  const { confirm: confirmReveal, dialog: revealDialog } = useConfirmDialog();
  const { confirm: confirmDelete, dialog: deleteDialog } = useConfirmDialog();
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const photoUrl = artistPhotoUrl(artist.photo_path);

  const setRevealed = async (value: boolean) => {
    await supabase.from('artists').update({ is_revealed: value }).eq('id', artist.id);
    onSaved();
  };

  const toggle = () => {
    if (artist.is_revealed) {
      confirmReveal(
        `Re-seal ${artist.name}? Anyone who already saw it will have screenshots.`,
        () => setRevealed(false),
        'Re-seal'
      );
      return;
    }
    const announce = () =>
      confirmReveal(
        `This announces ${artist.name} to everyone, immediately. The photo and name become public and appear on the site in real time.`,
        () => setRevealed(true),
        'Announce'
      );
    if (!artist.photo_path) {
      confirmPhoto(`${artist.name} has no photo and will show as a plain initial. Upload one first?`, announce, 'Continue anyway');
    } else {
      announce();
    }
  };

  const del = () => {
    confirmDelete(
      `Delete ${artist.name}? This can't be undone.`,
      async () => {
        setDeleting(true);
        if (artist.photo_path) await supabase.storage.from('artists').remove([artist.photo_path]);
        await supabase.from('artists').delete().eq('id', artist.id);
        setDeleting(false);
        onSaved();
      },
      'Delete'
    );
  };

  return (
    <div className={`artist-row${dragging ? ' dragging' : ''}`} draggable onDragStart={onDragStart} onDragOver={onDragOverRow} onDrop={onDrop}>
      <span className="artist-row-grip" aria-hidden="true" title="Drag to reorder">⠿</span>
      <span className="artist-row-thumb">
        {photoUrl && !failed ? <img src={photoUrl} alt="" onError={() => setFailed(true)} /> : <span>{initialOf(artist.name)}</span>}
      </span>
      <div className="artist-row-name">
        <h4>{artist.name}</h4>
        {artist.tagline && <p>{artist.tagline}</p>}
      </div>
      <span className={`badge ${artist.is_revealed ? 'badge-done' : 'badge-live'}`}>
        <span className="dot" />
        {artist.is_revealed
          ? `Announced${artist.revealed_at ? ` · ${new Date(artist.revealed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`
          : 'Sealed'}
      </span>
      <Switch checked={artist.is_revealed} onChange={toggle} />
      <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
      <button className="btn btn-danger btn-sm" onClick={del} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
      {photoDialog}
      {revealDialog}
      {deleteDialog}
    </div>
  );
}

function ArtistDrawer({
  artist,
  open,
  onClose,
  onSaved,
}: {
  artist: Artist | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [instagram, setInstagram] = useState('');
  const [spotify, setSpotify] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; offX: number; offY: number } | null>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(artist?.name ?? '');
    setTagline(artist?.tagline ?? '');
    setInstagram(artist?.instagram ?? '');
    setSpotify(artist?.spotify ?? '');
    setError(null);
    setFile(null);
    setImgUrl(null);
    setNatural(null);
    setOffset({ x: 0, y: 0 });
  }, [open, artist]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError(null);
    if (!ACCEPTED.includes(f.type)) {
      setError('Use a JPG, PNG, or WEBP image.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('That file is too large — 5MB max.');
      return;
    }
    setFile(f);
    setNatural(null);
    setOffset({ x: 0, y: 0 });
    setImgUrl(URL.createObjectURL(f));
  };

  const onImgLoad = () => {
    const img = cropImgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    const scale = Math.max(FRAME / w, FRAME / h);
    setOffset({ x: (FRAME - w * scale) / 2, y: (FRAME - h * scale) / 2 });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!natural) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, offX: offset.x, offY: offset.y };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !natural) return;
    const scale = Math.max(FRAME / natural.w, FRAME / natural.h);
    const dispW = natural.w * scale;
    const dispH = natural.h * scale;
    const nx = Math.min(0, Math.max(FRAME - dispW, dragRef.current.offX + (e.clientX - dragRef.current.startX)));
    const ny = Math.min(0, Math.max(FRAME - dispH, dragRef.current.offY + (e.clientY - dragRef.current.startY)));
    setOffset({ x: nx, y: ny });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  // Faces sit high in most promo shots — a naive centre crop cuts them off,
  // so the admin drags to reposition and THIS is what actually gets
  // uploaded: the cropped square, never the original file.
  const getCroppedBlob = async (): Promise<{ blob: Blob; ext: string } | null> => {
    if (!file || !natural || !cropImgRef.current) return null;
    const scale = Math.max(FRAME / natural.w, FRAME / natural.h);
    const sx = -offset.x / scale;
    const sy = -offset.y / scale;
    const sSize = FRAME / scale;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(cropImgRef.current, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
    const mime = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.9));
    if (!blob) return null;
    return { blob, ext: extFor(file.type) };
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let photoPath = artist?.photo_path ?? null;

      if (file) {
        const cropped = await getCroppedBlob();
        if (!cropped) throw new Error('Could not process that photo — try a different file.');
        // Never the uploaded filename: the bucket is public, so a name like
        // "wasthi.jpg" is guessable and leaks an unannounced artist to
        // anyone who tries the URL. A UUID isn't guessable.
        const filename = `${crypto.randomUUID()}.${cropped.ext}`;
        const { error: upErr } = await supabase.storage.from('artists').upload(filename, cropped.blob, { contentType: cropped.blob.type });
        if (upErr) throw upErr;
        const oldPath = artist?.photo_path;
        photoPath = filename;
        // Replacing a photo — remove the old object so orphans don't
        // accumulate in the bucket.
        if (oldPath) await supabase.storage.from('artists').remove([oldPath]);
      }

      const patch = {
        name: name.trim(),
        tagline: tagline.trim() || null,
        instagram: instagram.trim() || null,
        spotify: spotify.trim() || null,
        photo_path: photoPath,
      };

      if (artist) {
        const { error: updErr } = await supabase.from('artists').update(patch).eq('id', artist.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('artists').insert({ ...patch, sort: 9999 });
        if (insErr) throw insErr;
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
    } finally {
      setSaving(false);
    }
  };

  const existingPhotoUrl = artistPhotoUrl(artist?.photo_path ?? null);
  const displayScale = natural ? Math.max(FRAME / natural.w, FRAME / natural.h) : 1;

  return (
    <>
      <div className={`drawer-overlay${open ? ' show' : ''}`} onClick={onClose} />
      <div className={`drawer${open ? ' show' : ''}`}>
        <div className="drawer-head">
          <div>
            <p className="eyebrow">{artist ? 'Edit artist' : 'Add artist'}</p>
            <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 24, margin: '6px 0 0' }}>{artist ? artist.name : 'New artist'}</h2>
          </div>
          <button className="drawer-close" onClick={onClose}>Close</button>
        </div>

        <div className="drawer-col" style={{ borderTop: 'none' }}>
          <div className="field">
            <label>Name <span style={{ color: 'var(--gold)' }}>*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Artist or act name" />
          </div>
          <div className="field">
            <label>Tagline</label>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Live set, DJ set, spoken word…" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Instagram (optional)</label>
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/…" />
            </div>
            <div className="field">
              <label>Spotify (optional)</label>
              <input value={spotify} onChange={(e) => setSpotify(e.target.value)} placeholder="https://open.spotify.com/…" />
            </div>
          </div>

          <div className="field">
            <label>Photo</label>
            <p className="hint" style={{ margin: '0 0 12px' }}>
              JPG, PNG, or WEBP, max 5MB. Shown as a circle on the site — drag within the frame to reposition before saving.
            </p>

            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div
                className="crop-frame"
                style={{ width: FRAME, height: FRAME }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
                {imgUrl ? (
                  <img
                    ref={cropImgRef}
                    src={imgUrl}
                    alt=""
                    draggable={false}
                    onLoad={onImgLoad}
                    style={
                      natural
                        ? {
                            position: 'absolute',
                            left: offset.x,
                            top: offset.y,
                            width: natural.w * displayScale,
                            height: natural.h * displayScale,
                            maxWidth: 'none',
                          }
                        : { opacity: 0 }
                    }
                  />
                ) : existingPhotoUrl ? (
                  <img src={existingPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="crop-frame-empty">{initialOf(name || '?')}</span>
                )}
              </div>

              <div>
                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                  {imgUrl ? 'Choose a different photo' : existingPhotoUrl ? 'Replace photo' : 'Upload photo'}
                  <input type="file" accept={ACCEPTED.join(',')} onChange={onFileChange} style={{ display: 'none' }} />
                </label>
                {imgUrl && <p className="hint" style={{ margin: '10px 0 0', maxWidth: 220 }}>Drag inside the circle to reposition. This crop is what gets saved.</p>}
              </div>
            </div>
          </div>

          {error && <p style={{ color: 'var(--gold)', fontFamily: 'var(--f-mono)', fontSize: 11.5, marginTop: 4 }}>{error}</p>}
        </div>

        <div className="drawer-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-gold" onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : artist ? 'Save changes' : 'Add artist'}
          </button>
        </div>
      </div>
    </>
  );
}

function LineupSettingsPanel({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const [placeholders, setPlaceholders] = useState(String(settings.artist_placeholders));
  const [moreComing, setMoreComing] = useState(settings.more_artists_coming);
  const [saving, setSaving] = useState(false);
  const dirty = placeholders !== String(settings.artist_placeholders) || moreComing !== settings.more_artists_coming;

  const save = async () => {
    const n = Math.min(10, Math.max(0, Math.round(Number(placeholders)) || 0));
    setSaving(true);
    await supabase.from('settings').update({ artist_placeholders: n, more_artists_coming: moreComing }).eq('id', 1);
    setSaving(false);
    onSaved();
  };

  const previewCount = Math.min(10, Math.max(0, Math.round(Number(placeholders)) || 0));

  return (
    <div className="panel">
      <h3>Line-up settings</h3>
      <p className="hint">
        Silhouettes shown after revealed artists. This is <b style={{ color: 'var(--chrome)' }}>not</b> the real remaining count —
        keeping it inaccurate hides how many artists there are.
      </p>

      <div className="field-row">
        <div className="field">
          <label>Silhouette placeholders (0–10)</label>
          <input type="number" min={0} max={10} value={placeholders} onChange={(e) => setPlaceholders(e.target.value)} />
        </div>
        <div className="field">
          <label>&ldquo;More to come&rdquo; line</label>
          <div style={{ paddingTop: 8 }}>
            <Switch checked={moreComing} onChange={() => setMoreComing((v) => !v)} />
          </div>
        </div>
      </div>

      <div className="lineup-preview">
        {previewCount === 0 && !moreComing ? (
          <span className="page-note">No placeholders shown.</span>
        ) : (
          <>
            {Array.from({ length: previewCount }).map((_, i) => (
              <span key={i} className="lineup-preview-circle">?</span>
            ))}
            {moreComing && <span className="lineup-preview-more">MORE TO COME</span>}
          </>
        )}
      </div>

      <button className="btn btn-ghost btn-sm" style={{ marginTop: 18 }} disabled={!dirty || saving} onClick={save}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
