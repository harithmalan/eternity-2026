export interface BarChartRow {
  label: string;
  value: number;
  max: number;
  soldOut?: boolean;
}

export default function BarChart({ rows }: { rows: BarChartRow[] }) {
  return (
    <div className="bar-chart">
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <div className="label">{r.label}</div>
          <div className="bar-track">
            <div
              className={`bar-fill${r.soldOut ? ' sold-out' : ''}`}
              style={{ width: `${r.max > 0 ? Math.min(100, (r.value / r.max) * 100) : 0}%` }}
            />
          </div>
          <div className="value">{r.value.toLocaleString('en-LK')}</div>
        </div>
      ))}
    </div>
  );
}
