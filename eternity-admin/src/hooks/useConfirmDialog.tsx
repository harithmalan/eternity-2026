import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

interface PendingConfirm {
  message: string;
  confirmLabel?: string;
  action: () => Promise<void> | void;
}

/** Every "flip a switch, confirm first" action in this app shares this — the dialog text carries the actual consequence, not a generic "Are you sure?". */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = (message: string, action: () => Promise<void> | void, confirmLabel?: string) => {
    setPending({ message, action, confirmLabel });
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    await pending.action();
    setBusy(false);
    setPending(null);
  };

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      message={pending?.message ?? ''}
      confirmLabel={pending?.confirmLabel}
      busy={busy}
      onConfirm={handleConfirm}
      onCancel={() => setPending(null)}
    />
  );

  return { confirm, dialog };
}
