import { useEffect, useState } from 'react';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  msRemaining: number;
  expired: boolean;
}

function computeParts(targetMs: number): CountdownParts {
  const msRemaining = targetMs - Date.now();
  const g = Math.max(0, msRemaining);
  return {
    days: Math.floor(g / 864e5),
    hours: Math.floor((g % 864e5) / 36e5),
    minutes: Math.floor((g % 36e5) / 6e4),
    seconds: Math.floor((g % 6e4) / 1e3),
    msRemaining,
    expired: msRemaining <= 0,
  };
}

export function useCountdown(targetMs: number): CountdownParts {
  const [parts, setParts] = useState(() => computeParts(targetMs));

  useEffect(() => {
    setParts(computeParts(targetMs));
    const id = setInterval(() => setParts(computeParts(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  return parts;
}

export const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, '0');
