import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { supabase, supabaseUrl } from '../lib/supabase';
import { usePosts, useSettings } from '../hooks/useAdminData';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import type { AdminPostRow, PostMedia, PostMediaKind } from '../lib/database.types';

const MAX_ITEMS = 10;
const CAPTION_LIMIT = 2000;
const CAPTION_WARN_AT = 1800;
const IMAGE_MAX_EDGE = 1600;
const IMAGE_QUALITY = 0.82;
const PLACEHOLDER_WIDTH = 32;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const VIDEO_WARN_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

function mediaUrl(path: string) {
  return `${supabaseUrl}/storage/v1/object/public/posts/${path}`;
}

function fmtMB(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fmtDuration(secs: number) {
  const s = Math.round(secs);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode that image.'))), type, quality);
  });
}

/** Real upload progress needs XHR — supabase-js's `.upload()` uses fetch, which exposes no upload progress events. */
function uploadWithProgress(path: string, body: Blob, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/posts/${path}`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${session?.access_token ?? ''}`);
      xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY);
      xhr.setRequestHeader('Content-Type', body.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed (${xhr.status}).`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
      xhr.send(body);
    });
  });
}

// ── Image pipeline: downscale to a 1600px longest edge, re-encode to WebP
// at q82, plus a sub-2KB 32px blur placeholder. ────────────────────────
async function processImage(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that image.');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, 'image/webp', IMAGE_QUALITY);

    const phScale = PLACEHOLDER_WIDTH / bitmap.width;
    const phCanvas = document.createElement('canvas');
    phCanvas.width = PLACEHOLDER_WIDTH;
    phCanvas.height = Math.max(1, Math.round(bitmap.height * phScale));
    const phCtx = phCanvas.getContext('2d');
    if (!phCtx) throw new Error('Could not process that image.');
    phCtx.drawImage(bitmap, 0, 0, phCanvas.width, phCanvas.height);
    const phBlob = await canvasToBlob(phCanvas, 'image/webp', 0.5);
    const placeholder = await blobToDataUrl(phBlob);

    return { blob, width, height, placeholder };
  } finally {
    bitmap.close();
  }
}

function readVideoMeta(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      reject(new Error('Could not read that video file.'));
      URL.revokeObjectURL(url);
    };
  });
}

// Poster frame at the 1-second mark — required for every video (see the
// `video_requires_poster` check in supabase-setup.sql). Without one the
// browser downloads the whole clip just to paint a first frame.
function extractPosterFrame(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };
    video.onseeked = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not extract a poster frame.');
        ctx.drawImage(video, 0, 0);
        const blob = await canvasToBlob(canvas, 'image/webp', IMAGE_QUALITY);
        resolve(blob);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not extract a poster frame.'));
      } finally {
        cleanup();
      }
    };
    video.onerror = () => {
      reject(new Error('Could not read that video file.'));
      cleanup();
    };
  });
}

interface StagedMedia {
  localKey: string;
  mediaId?: string; // set once persisted to post_media (edit mode, already-saved items)
  kind: PostMediaKind;
  path: string;
  posterPath: string | null;
  width: number | null;
  height: number | null;
  placeholder: string | null;
  durationS: number | null;
  previewUrl: string;
  uploading: boolean;
  progress: number;
  error?: string;
  warning?: string;
}

async function stageFile(file: File, maxVideoSecs: number, onProgress: (pct: number) => void) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) throw new Error(`${file.name}: use a JPG, PNG, WEBP, MP4, or MOV file.`);

  if (isImage) {
    const { blob, width, height, placeholder } = await processImage(file);
    const path = `${crypto.randomUUID()}.webp`;
    await uploadWithProgress(path, blob, onProgress);
    return { kind: 'image' as const, path, posterPath: null, width, height, placeholder, durationS: null, warning: undefined };
  }

  const meta = await readVideoMeta(file);
  if (meta.duration > maxVideoSecs) {
    throw new Error(`Clips must be under ${maxVideoSecs} seconds. This one is ${Math.round(meta.duration)}s.`);
  }
  if (file.size > VIDEO_MAX_BYTES) {
    throw new Error(`That clip is ${fmtMB(file.size)} — the limit is ${fmtMB(VIDEO_MAX_BYTES)}.`);
  }
  const warning = file.size > VIDEO_WARN_BYTES ? "Large clips use the society's bandwidth quota. Consider a shorter cut." : undefined;

  const posterBlob = await extractPosterFrame(file);
  const posterPath = `${crypto.randomUUID()}.webp`;
  await uploadWithProgress(posterPath, posterBlob, () => {});

  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  await uploadWithProgress(path, file, onProgress);

  return { kind: 'video' as const, path, posterPath, width: meta.width, height: meta.height, placeholder: null, durationS: meta.duration, warning };
}

export default function Posts() {
  const { data: posts, loading, refetch } = usePosts();
  const { settings, loading: settingsLoading } = useSettings();
  const [editingPost, setEditingPost] = useState<AdminPostRow | null>(null);

  if (loading || settingsLoading || !settings) return <p className="page-note">Loading…</p>;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Social feed</p>
          <h1 className="page-title">Posts</h1>
        </div>
        <p className="page-note">Drafts and published posts both show below. Only published posts reach the public feed.</p>
      </div>

      <Composer
        key={editingPost?.id ?? 'new'}
        editingPost={editingPost}
        maxVideoSecs={settings.feed_max_video_secs}
        onDone={() => {
          setEditingPost(null);
          refetch();
        }}
        onCancelEdit={() => setEditingPost(null)}
      />

      {posts.length === 0 ? (
        <p className="page-note" style={{ marginTop: 24 }}>No posts yet.</p>
      ) : (
        <div className="post-list">
          {posts.map((p) => (
            <PostRow key={p.id} post={p} onEdit={() => setEditingPost(p)} onSaved={refetch} />
          ))}
        </div>
      )}
    </>
  );
}

function Composer({
  editingPost,
  maxVideoSecs,
  onDone,
  onCancelEdit,
}: {
  editingPost: AdminPostRow | null;
  maxVideoSecs: number;
  onDone: () => void;
  onCancelEdit: () => void;
}) {
  const [caption, setCaption] = useState(editingPost?.caption ?? '');
  const [media, setMedia] = useState<StagedMedia[]>(
    () =>
      (editingPost?.media ?? []).map((m: PostMedia) => ({
        localKey: m.id,
        mediaId: m.id,
        kind: m.kind,
        path: m.path,
        posterPath: m.poster_path,
        width: m.width,
        height: m.height,
        placeholder: m.placeholder,
        durationS: m.duration_s,
        previewUrl: m.kind === 'video' && m.poster_path ? mediaUrl(m.poster_path) : mediaUrl(m.path),
        uploading: false,
        progress: 100,
      }))
  );
  const [dropzoneOver, setDropzoneOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'draft' | 'publish' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [caption]);

  // Cleanup blob: previews on unmount only — persisted media use real URLs.
  // Reads from a ref (kept fresh every render) rather than closing over
  // `media` directly, since an empty-deps effect's cleanup would otherwise
  // only ever see the media staged at mount time, not whatever was staged
  // by the time the composer actually unmounts.
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);
  useEffect(() => {
    return () => {
      mediaRef.current.forEach((m) => {
        if (m.previewUrl.startsWith('blob:')) URL.revokeObjectURL(m.previewUrl);
      });
    };
  }, []);

  const isEditing = !!editingPost;
  const captionOver = caption.length > CAPTION_WARN_AT;

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const room = MAX_ITEMS - media.length;
    if (room <= 0) {
      setDropError('Up to 10 items per post.');
      return;
    }
    const toProcess = files.slice(0, room);
    setDropError(files.length > toProcess.length ? `Only ${room} more item${room === 1 ? '' : 's'} allowed — up to 10 per post.` : null);

    for (const file of toProcess) {
      const localKey = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      const isVideo = file.type.startsWith('video/');
      setMedia((prev) => [
        ...prev,
        {
          localKey,
          kind: isVideo ? 'video' : 'image',
          path: '',
          posterPath: null,
          width: null,
          height: null,
          placeholder: null,
          durationS: null,
          previewUrl,
          uploading: true,
          progress: 0,
        },
      ]);

      try {
        const result = await stageFile(file, maxVideoSecs, (pct) => {
          setMedia((prev) => prev.map((m) => (m.localKey === localKey ? { ...m, progress: pct } : m)));
        });
        setMedia((prev) =>
          prev.map((m) =>
            m.localKey === localKey
              ? { ...m, path: result.path, posterPath: result.posterPath, width: result.width, height: result.height, placeholder: result.placeholder, durationS: result.durationS, uploading: false, progress: 100, warning: result.warning }
              : m
          )
        );
      } catch (err) {
        setMedia((prev) => prev.map((m) => (m.localKey === localKey ? { ...m, uploading: false, error: err instanceof Error ? err.message : 'Upload failed.' } : m)));
      }
    }
  };

  const removeMedia = async (item: StagedMedia) => {
    setMedia((prev) => prev.filter((m) => m.localKey !== item.localKey));
    if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
    // Not yet saved to post_media — the storage object would otherwise be
    // orphaned, since nothing in the database will ever reference it.
    if (!item.mediaId && item.path) {
      const paths = [item.path, item.posterPath].filter((p): p is string => !!p);
      await supabase.storage.from('posts').remove(paths);
    }
  };

  const reorder = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null);
      return;
    }
    setMedia((prev) => {
      const from = prev.findIndex((m) => m.localKey === dragKey);
      const to = prev.findIndex((m) => m.localKey === targetKey);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragKey(null);
  };

  const resetForm = () => {
    setCaption('');
    setMedia([]);
    setSubmitError(null);
  };

  const cancelEdit = async () => {
    const orphans = media.filter((m) => !m.mediaId && m.path);
    const paths = orphans.flatMap((m) => [m.path, m.posterPath].filter((p): p is string => !!p));
    if (paths.length) await supabase.storage.from('posts').remove(paths);
    resetForm();
    onCancelEdit();
  };

  const submit = async (publish: boolean) => {
    if (media.some((m) => m.uploading)) {
      setSubmitError('Still uploading — wait for it to finish.');
      return;
    }
    setSubmitting(publish ? 'publish' : 'draft');
    setSubmitError(null);
    try {
      let postId = editingPost?.id;
      const wasPublished = editingPost?.is_published ?? false;

      if (!postId) {
        const { data, error } = await supabase
          .from('posts')
          .insert({ caption: caption.trim() || null, is_published: publish, published_at: publish ? new Date().toISOString() : null })
          .select('id')
          .single();
        if (error || !data) throw error ?? new Error('Could not create the post.');
        postId = data.id;
      } else {
        const patch: { caption: string | null; is_published?: boolean; published_at?: string } = { caption: caption.trim() || null };
        // Editing a published post never touches published_at — only the
        // first draft -> publish transition sets it.
        if (publish) {
          patch.is_published = true;
          if (!wasPublished) patch.published_at = new Date().toISOString();
        }
        const { error } = await supabase.from('posts').update(patch).eq('id', postId);
        if (error) throw error;
      }

      const originalIds = new Set((editingPost?.media ?? []).map((m) => m.id));
      const keptIds = new Set(media.filter((m) => m.mediaId).map((m) => m.mediaId as string));
      const removedIds = [...originalIds].filter((id) => !keptIds.has(id));

      if (removedIds.length > 0) {
        const removedRows = (editingPost?.media ?? []).filter((m) => removedIds.includes(m.id));
        const paths = removedRows.flatMap((m) => [m.path, m.poster_path].filter((p): p is string => !!p));
        if (paths.length) await supabase.storage.from('posts').remove(paths);
        await supabase.from('post_media').delete().in('id', removedIds);
      }

      await Promise.all(
        media.map((m, i) => {
          if (m.mediaId) return supabase.from('post_media').update({ sort: i }).eq('id', m.mediaId);
          return supabase.from('post_media').insert({
            post_id: postId,
            kind: m.kind,
            path: m.path,
            width: m.width,
            height: m.height,
            placeholder: m.placeholder,
            poster_path: m.posterPath,
            duration_s: m.durationS,
            sort: i,
          });
        })
      );

      resetForm();
      onDone();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save the post.');
    } finally {
      setSubmitting(null);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropzoneOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const hasPendingUploads = media.some((m) => m.uploading);

  return (
    <div className="panel composer">
      {isEditing && (
        <div className="composer-editing-banner">
          <span>Editing a post</span>
          <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="composer-textarea"
        placeholder="What's happening?"
        value={caption}
        maxLength={CAPTION_LIMIT}
        rows={1}
        onChange={(e) => setCaption(e.target.value)}
      />
      {captionOver && (
        <p className={`composer-counter${caption.length >= CAPTION_LIMIT ? ' limit' : ''}`}>{caption.length} / {CAPTION_LIMIT}</p>
      )}

      <div
        className={`dropzone${dropzoneOver ? ' over' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDropzoneOver(true);
        }}
        onDragLeave={() => setDropzoneOver(false)}
        onDrop={onDrop}
      >
        <p>Drag photos or clips here, or click to browse</p>
        <p className="dropzone-hint">JPG · PNG · WEBP · MP4 · MOV — up to {MAX_ITEMS} per post</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          style={{ display: 'none' }}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {dropError && <p className="composer-drop-error">{dropError}</p>}

      {media.length > 0 && (
        <div className="media-strip">
          {media.map((m) => (
            <div
              key={m.localKey}
              className={`media-thumb${dragKey === m.localKey ? ' dragging' : ''}`}
              draggable={!m.uploading}
              onDragStart={() => setDragKey(m.localKey)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorder(m.localKey)}
            >
              <img src={m.previewUrl} alt="" />
              {m.kind === 'video' && (
                <span className="media-thumb-play">
                  ▶{m.durationS != null && <span>{fmtDuration(m.durationS)}</span>}
                </span>
              )}
              {m.uploading && (
                <div className="media-thumb-progress">
                  <div className="media-thumb-progress-bar" style={{ width: `${m.progress}%` }} />
                </div>
              )}
              {m.error && <div className="media-thumb-error" title={m.error}>!</div>}
              {m.warning && !m.error && <div className="media-thumb-warning" title={m.warning}>⚠</div>}
              <button type="button" className="media-thumb-remove" onClick={() => removeMedia(m)} aria-label="Remove">×</button>
            </div>
          ))}
        </div>
      )}
      {media.some((m) => m.error) && (
        <p className="composer-drop-error">{media.find((m) => m.error)?.error}</p>
      )}
      {media.some((m) => m.warning) && !media.some((m) => m.error) && (
        <p className="composer-warning">{media.find((m) => m.warning)?.warning}</p>
      )}

      {submitError && <p className="composer-drop-error">{submitError}</p>}

      <div className="composer-actions">
        <button className="btn btn-ghost" disabled={!!submitting || hasPendingUploads} onClick={() => submit(false)}>
          {submitting === 'draft' ? 'Saving…' : 'Save draft'}
        </button>
        <button className="btn btn-gold" disabled={!!submitting || hasPendingUploads} onClick={() => submit(true)}>
          {submitting === 'publish' ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </div>
  );
}

function PostRow({ post, onEdit, onSaved }: { post: AdminPostRow; onEdit: () => void; onSaved: () => void }) {
  const { confirm, dialog } = useConfirmDialog();
  const media = useMemo(() => post.media ?? [], [post.media]);
  const cover = media[0];
  const extraCount = Math.max(0, media.length - 1);

  const coverUrl = cover ? (cover.kind === 'video' ? (cover.poster_path ? mediaUrl(cover.poster_path) : null) : mediaUrl(cover.path)) : null;

  const pin = async () => {
    await supabase.from('posts').update({ is_pinned: true }).eq('id', post.id);
    onSaved();
  };
  const unpin = async () => {
    await supabase.from('posts').update({ is_pinned: false }).eq('id', post.id);
    onSaved();
  };
  const unpublish = async () => {
    await supabase.from('posts').update({ is_published: false }).eq('id', post.id);
    onSaved();
  };

  const del = () => {
    const likeNote = post.like_count > 0 ? ` This post has ${post.like_count} like${post.like_count === 1 ? '' : 's'}.` : '';
    confirm(
      `Delete this post?${likeNote} Deleting is permanent.`,
      async () => {
        const paths = media.flatMap((m) => [m.path, m.poster_path].filter((p): p is string => !!p));
        if (paths.length) await supabase.storage.from('posts').remove(paths);
        await supabase.from('posts').delete().eq('id', post.id);
        onSaved();
      },
      'Delete'
    );
  };

  return (
    <div className="post-row">
      <div className="post-row-media">
        {coverUrl ? <img src={coverUrl} alt="" /> : <div className="post-row-media-empty">No media</div>}
        {extraCount > 0 && <span className="post-row-media-count">+{extraCount}</span>}
      </div>
      <div className="post-row-body">
        <p className="post-row-caption">{post.caption ? post.caption : <em>No caption</em>}</p>
        <div className="post-row-meta">
          <span className={`badge ${post.is_published ? 'badge-done' : 'badge-live'}`}>
            <span className="dot" />
            {post.is_published ? 'Published' : 'Draft'}
          </span>
          {post.is_pinned && <span className="badge badge-warn">Pinned</span>}
          <span className="post-row-likes">{post.like_count} like{post.like_count === 1 ? '' : 's'}</span>
          {post.published_at && (
            <span className="post-row-date">
              {new Date(post.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      <div className="post-row-actions">
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Edit</button>
        {post.is_pinned ? (
          <button className="btn btn-ghost btn-sm" onClick={unpin}>Unpin</button>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={pin}>Pin</button>
        )}
        {post.is_published && <button className="btn btn-ghost btn-sm" onClick={unpublish}>Unpublish</button>}
        <button className="btn btn-danger btn-sm" onClick={del}>Delete</button>
      </div>
      {dialog}
    </div>
  );
}
