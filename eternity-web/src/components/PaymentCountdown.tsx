import { useCountdown, pad2 } from '../hooks/useCountdown';

export default function PaymentCountdown({ dueAt }: { dueAt: string }) {
  const { days, hours, minutes, seconds, expired } = useCountdown(new Date(dueAt).getTime());

  if (expired) {
    return <p className="avail-warn">Payment window has closed — message the committee.</p>;
  }

  const parts =
    days > 0
      ? `${days}d ${pad2(hours)}h ${pad2(minutes)}m`
      : `${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`;

  return (
    <p className="hint">
      Upload your slip within <span className="due-countdown">{parts}</span>.
    </p>
  );
}
