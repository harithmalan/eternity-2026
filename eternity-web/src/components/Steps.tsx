import { useReveal } from '../hooks/useReveal';

const STEPS = [
  { n: '01', title: 'Reserve', body: 'Sign in with Google, Facebook or email and fill in your details and size.', when: 'Takes 2 minutes' },
  { n: '02', title: 'Deposit', body: 'Pay into the society account and upload your slip from your account page.', when: 'Within 24 hours' },
  { n: '03', title: 'Verified', body: 'A committee member checks the slip. You get an email confirming payment.', when: '1–2 days' },
  { n: '04', title: 'Collect', body: 'We email you when your order is printed and ready to pick up on campus.', when: 'Before 18 Sep' },
];

export default function Steps() {
  const head = useReveal();
  const grid = useReveal();

  return (
    <section className="band band-line band-solid">
      <div className="shell">
        <div className={`sec-head ${head.className}`} ref={head.ref} style={head.style}>
          <div>
            <p className="eyebrow">What happens next</p>
            <h2 className="sec-title">Four steps, <i>one</i> tee.</h2>
          </div>
          <p className="sec-note">You&apos;ll get an email at every stage, and the same status shows on your account page.</p>
        </div>
        <div className={`steps ${grid.className}`} ref={grid.ref} style={grid.style}>
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <div className="n">{s.n}</div>
              <h4>{s.title}</h4>
              <p>{s.body}</p>
              <div className="when">{s.when}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
