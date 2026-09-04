import { useCachedPhoto } from '../../hooks/useCachedPhoto';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
}

export default function GateAvatar({ passId, name, size }: { passId: string; name: string; size: number }) {
  const url = useCachedPhoto(passId);
  return (
    <div className="gate-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {url ? <img src={url} alt="" /> : <span>{initials(name)}</span>}
    </div>
  );
}
