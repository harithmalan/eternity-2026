import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DistributionProgressRow, DistributionQueueRow } from '../lib/database.types';

export function useDistribution() {
  const [queue, setQueue] = useState<DistributionQueueRow[]>([]);
  const [progress, setProgress] = useState<DistributionProgressRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingItemIds, setWorkingItemIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const [queueRes, progressRes] = await Promise.all([
      supabase.from('distribution_queue').select('*'),
      supabase.from('distribution_progress').select('*').maybeSingle(),
    ]);

    if (queueRes.error || progressRes.error) {
      setError(queueRes.error?.message ?? progressRes.error?.message ?? 'Could not refresh distribution.');
    } else {
      setQueue(queueRes.data ?? []);
      setProgress(progressRes.data);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel('distribution-handover')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const changeDistribution = async (item: DistributionQueueRow, distributed: boolean, volunteerName: string) => {
    setWorkingItemIds((ids) => [...ids, item.item_id]);
    setError(null);
    const now = new Date().toISOString();

    // The refetch after the RPC remains the source of truth across phones.
    setQueue((rows) => rows.map((row) => row.item_id === item.item_id
      ? { ...row, distributed_at: distributed ? now : null, distributed_by_name: distributed ? volunteerName : null }
      : row));
    setProgress((current) => current && {
      ...current,
      distributed: Math.max(0, Number(current.distributed) + (distributed ? 1 : -1)),
    });

    const { error: rpcError } = await supabase.rpc(
      distributed ? 'mark_distributed' : 'undo_distributed',
      { item_id: item.item_id }
    );

    if (rpcError) setError(rpcError.message);
    await refetch();
    setWorkingItemIds((ids) => ids.filter((id) => id !== item.item_id));
  };

  return { queue, progress, loading, workingItemIds, error, refetch, changeDistribution };
}
