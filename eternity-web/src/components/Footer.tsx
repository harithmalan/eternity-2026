export default function Footer() {
  return (
    <footer>
      <div className="shell foot-grid">
        <div className="foot-marks">
          <img className="sis" src="/img/sis-logo.png" alt="Student Interactive Society" loading="lazy" decoding="async" />
          <img className="scu" src="/img/scu-25.png" alt="SCU 25 Years of Trust" loading="lazy" decoding="async" />
          {/* <img className="uni" src="/img/UniLogo.png" alt="SLIIT City Uni" loading="lazy" decoding="async" /> */}
        </div>
        <div className="foot-meta">
          ETERNITY · 18 SEPTEMBER 2026 · FREE ENTRY<br />
          PRESENTED BY THE STUDENT INTERACTIVE SOCIETY<br />
          SCU · COLOMBO
          <div className="foot-credit">DEVELOPED BY HARITH</div>
        </div>
      </div>
    </footer>
  );
}
