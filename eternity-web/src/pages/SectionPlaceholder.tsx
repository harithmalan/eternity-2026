import { Link } from 'react-router-dom';

/** Renders once a locked section's feature flag goes live — swap in the real page then. */
export default function SectionPlaceholder({ title }: { title: string }) {
  return (
    <div className="locked-panel">
      <p className="eyebrow">{title}</p>
      <p className="locked-panel-msg">This section is live — content goes here.</p>
      <Link className="btn btn-ghost" to="/">Back to Eternity</Link>
    </div>
  );
}
