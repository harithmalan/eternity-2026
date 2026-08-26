import { cloneElement, isValidElement, type MouseEvent, type ReactElement } from 'react';
import { useFeature } from '../lib/features';
import { useToast } from './Toast';

interface LockedActionProps {
  feature: string;
  children: ReactElement;
}

/**
 * Wraps a single button or link. While the named feature is locked, clicks
 * are swallowed (no navigation, no submit) and a toast explains why. Once
 * the feature goes live, the child renders and behaves exactly as authored.
 */
export default function LockedAction({ feature, children }: LockedActionProps) {
  const { isLive, label } = useFeature(feature);
  const { say } = useToast();

  if (isLive) return children;

  if (!isValidElement(children)) return children;

  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    'data-lock': label,
    'aria-disabled': true,
    onClick: (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      say(`${label} will be published soon`);
    },
  });
}
