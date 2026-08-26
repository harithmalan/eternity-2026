import { useCountdown, pad2 } from '../hooks/useCountdown';

export const SHOW_DATE_MS = new Date('2026-09-18T15:30:00+05:30').getTime();

export default function Countdown() {
  const { days, hours, minutes, seconds } = useCountdown(SHOW_DATE_MS);

  return (
    <div className="cd">
      <div className="cd-unit">
        <div className="cd-num">{pad2(days)}</div>
        <div className="cd-lab">Days</div>
      </div>
      <div className="cd-sep">:</div>
      <div className="cd-unit">
        <div className="cd-num">{pad2(hours)}</div>
        <div className="cd-lab">Hours</div>
      </div>
      <div className="cd-sep">:</div>
      <div className="cd-unit">
        <div className="cd-num">{pad2(minutes)}</div>
        <div className="cd-lab">Minutes</div>
      </div>
      <div className="cd-sep">:</div>
      <div className="cd-unit">
        <div className="cd-num">{pad2(seconds)}</div>
        <div className="cd-lab">Seconds</div>
      </div>
    </div>
  );
}
