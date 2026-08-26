import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BatchBreakdownRow, OrderStatus, RevenueSummaryRow, SizeBreakdownRow } from '../lib/database.types';

const CONFIRMED: OrderStatus[] = ['approved', 'ready_for_collection', 'collected'];

export interface DashboardData {
  revenue: RevenueSummaryRow[];
  sizeBreakdown: SizeBreakdownRow[];
  batchBreakdown: BatchBreakdownRow[];
  totalOrders: number;
  confirmedRevenue: number;
  unitsSold: number;
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      const [revenueRes, sizeRes, batchRes, confirmedOrdersRes] = await Promise.all([
        supabase.from('revenue_summary').select('*'),
        supabase.from('size_breakdown').select('*'),
        supabase.from('batch_breakdown').select('*'),
        supabase.from('orders').select('id').in('status', CONFIRMED),
      ]);

      if (!alive) return;

      const confirmedOrderIds = (confirmedOrdersRes.data ?? []).map((o) => o.id);
      // No PostgREST embedded select here on purpose — this project's
      // Database type declares empty `Relationships` for every table, so
      // an embedded `orders!inner(status)` select would type-check against
      // stale/absent relationship metadata rather than the real FK. Two
      // plain queries sidesteps that entirely.
      const unitsRes = confirmedOrderIds.length
        ? await supabase.from('order_items').select('qty').in('order_id', confirmedOrderIds)
        : { data: [] as { qty: number }[] };

      const revenue = revenueRes.data ?? [];
      const totalOrders = revenue.reduce((sum, r) => sum + r.orders, 0);
      const confirmedRevenue = revenue
        .filter((r) => CONFIRMED.includes(r.status))
        .reduce((sum, r) => sum + Number(r.value ?? 0), 0);
      const unitsSold = (unitsRes.data ?? []).reduce((sum, r) => sum + r.qty, 0);

      setData({
        revenue,
        sizeBreakdown: sizeRes.data ?? [],
        batchBreakdown: batchRes.data ?? [],
        totalOrders,
        confirmedRevenue,
        unitsSold,
      });
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  return { data, loading };
}
