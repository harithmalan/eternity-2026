import { useReveal } from '../hooks/useReveal';

const CONTACTS = [
  { who: 'Alex', num: '+94 70 654 4700', wa: '94706544700' },
  { who: 'Harith', num: '+94 76 857 0754', wa: '94768570754' },
  { who: 'Minol', num: '+94 76 537 3271', wa: '94765373271' },
];

export default function Contacts() {
  const head = useReveal();

  return (
    <section className="band band-line band-solid" id="contact">
      <div className="shell">
        <div className={`sec-head ${head.className}`} ref={head.ref} style={head.style}>
          <div>
            <p className="eyebrow">Stuck on something?</p>
            <h2 className="sec-title">Message the <i>committee</i>.</h2>
          </div>
          <p className="sec-note">WhatsApp is fastest. We answer between classes.</p>
        </div>
        <div className="contacts">
          {CONTACTS.map((c, i) => (
            <Contact key={c.who} who={c.who} num={c.num} wa={c.wa} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact({ who, num, wa, index }: { who: string; num: string; wa: string; index: number }) {
  const reveal = useReveal<HTMLAnchorElement>(index);
  return (
    <a className={`contact ${reveal.className}`} ref={reveal.ref} style={reveal.style} href={`https://wa.me/${wa}`} target="_blank" rel="noopener">
      <div><div className="who">{who}</div><div className="num">{num}</div></div>
      <span className="arrow">→</span>
    </a>
  );
}
