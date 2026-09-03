import { Component, type ReactNode } from 'react';

const CONTACTS = [
  { who: 'Alex', wa: '94706544700' },
  { who: 'Harith', wa: '94768570754' },
  { who: 'Minol', wa: '94765373271' },
];

interface Props {
  children: ReactNode;
  /** Rendered on error instead of the default "message the committee" panel — pass `null` for a boundary that should just quietly fall through to whatever's underneath (e.g. the launch sequence, which must never block the real site if it throws). */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches a render crash in whatever it wraps and shows a visible way to reach the committee instead of a blank page. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <section className="band band-line band-solid">
        <div className="shell">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Something went wrong</p>
              <h2 className="sec-title">This part <i>broke</i>.</h2>
            </div>
            <p className="sec-note">The rest of the site still works. Message the committee and we&apos;ll sort it out.</p>
          </div>
          <div className="contacts">
            {CONTACTS.map((c) => (
              <a key={c.who} className="contact" href={`https://wa.me/${c.wa}`} target="_blank" rel="noopener">
                <div><div className="who">{c.who}</div></div>
                <span className="arrow">→</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    );
  }
}
