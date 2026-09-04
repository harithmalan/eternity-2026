import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AdminOrderRow, OrderStatus } from '../lib/database.types';

export interface OrderFilters {
  status: OrderStatus | '';
  batch: string;
  center: string;
  product: string;
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
  search: string;
}

export const EMPTY_FILTERS: OrderFilters = { status: '', batch: '', center: '', product: '', from: '', to: '', search: '' };

export function useOrders(filters: OrderFilters) {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    let query = supabase.from('admin_order_view').select('*').order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.batch) query = query.eq('batch', filters.batch);
    if (filters.center) query = query.eq('center', filters.center);
    if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00`);
    if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59`);
    if (filters.search.trim()) {
      const q = `%${filters.search.trim()}%`;
      query = query.or(`full_name.ilike.${q},sa_number.ilike.${q},code.ilike.${q},email.ilike.${q}`);
    }

    const { data } = await query;
    let rows = data ?? [];

    // items_json isn't filterable server-side through this view — it's a
    // per-row aggregate, not a column — so the product filter is applied
    // client-side over an already-narrowed result set.
    if (filters.product) {
      rows = rows.filter((r) => r.items_json?.some((i) => i.product === filters.product));
    }

    setOrders(rows);
    setLoading(false);
  }, [filters.status, filters.batch, filters.center, filters.product, filters.from, filters.to, filters.search]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  return { orders, loading, refetch };
}
