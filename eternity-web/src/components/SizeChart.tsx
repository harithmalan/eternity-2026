import { useState } from 'react';
import type { SizeChartRow } from '../lib/database.types';
import { useReveal } from '../hooks/useReveal';
import Skeleton from './Skeleton';

type Unit = 'in' | 'cm';

function fmtIn(v: number) {
  return String(v).replace(/\.0$/, '') + '"';
}
function fmtCm(v: number) {
  return Math.round(v * 2.54) + ' cm';
}
function fmtFitsChest(v: string, unit: Unit) {
  if (unit === 'in') return v + '"';
  return v.split('–').map((n) => Math.round(Number(n) * 2.54)).join('–') + ' cm';
}

export default function SizeChart({ sizes, loading }: { sizes: SizeChartRow[]; loading: boolean }) {
  const head = useReveal();
  const chart = useReveal();
  const [unit, setUnit] = useState<Unit>('in');
  const f = unit === 'in' ? fmtIn : fmtCm;

  return (
    <section className="band band-line band-solid" id="sizes">
      <div className="shell">
        <div className={`sec-head ${head.className}`} ref={head.ref} style={head.style}>
          <div>
            <p className="eyebrow">Fit guide</p>
            <h2 className="sec-title">Get the <i>size</i> right the first time.</h2>
          </div>
          <p className="sec-note">Unisex, regular fit. Lay a tee you already own flat and measure it — that beats guessing from your usual size.</p>
        </div>
        <div className={`chart-wrap ${chart.className}`} ref={chart.ref} style={chart.style}>
          <div className="chart-head">
            <div><h3>Eternity Tee — measurements</h3><p>Garment measured flat · ±0.5 tolerance</p></div>
            <div className="unit-toggle">
              <button aria-pressed={unit === 'in'} onClick={() => setUnit('in')}>Inches</button>
              <button aria-pressed={unit === 'cm'} onClick={() => setUnit('cm')}>Cm</button>
            </div>
          </div>
          <div className="chart-scroll">
            <table>
              <thead>
                <tr><th>Size</th><th>Chest (flat)</th><th>Length</th><th>Sleeve</th><th>Fits chest</th></tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 7 }).map((_, i) => (
                      <tr key={i} aria-hidden="true">
                        <td><Skeleton width={28} height={14} /></td>
                        <td><Skeleton width={40} height={14} /></td>
                        <td><Skeleton width={40} height={14} /></td>
                        <td><Skeleton width={40} height={14} /></td>
                        <td><Skeleton width={56} height={14} /></td>
                      </tr>
                    ))
                  : sizes.map((r) => (
                      <tr key={r.size}>
                        <td>{r.size}</td>
                        <td>{f(r.chest_in)}</td>
                        <td>{f(r.length_in)}</td>
                        <td>{f(r.sleeve_in)}</td>
                        <td>{fmtFitsChest(r.fits_chest, unit)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <p className="chart-foot">Between two sizes? Take the larger one — the print sits better with a little room. Sizes can&apos;t be changed once your order is approved.</p>
        </div>
      </div>
    </section>
  );
}
