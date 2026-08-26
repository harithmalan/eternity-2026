/** Deliberately bare — no retry button, no nav, no hint of what's behind this. */
export default function AccessDenied() {
  return (
    <div className="gate-screen">
      <div className="gate-card">
        <img src="/img/eternity-logo.png" alt="Eternity" />
        <p className="page-title" style={{ fontSize: 20 }}>This account doesn&apos;t have committee access.</p>
      </div>
    </div>
  );
}
