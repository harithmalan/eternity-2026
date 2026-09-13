import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ProductTotalsRow, RevenueSummaryRow, TeesAndBandsSoldRow } from '../lib/database.types';

export type ExportMerchSummary = {
  products: ProductTotalsRow[];
  totalTees: number;
  totalBands: number;
  confirmedRevenue: number;
  awaitingPayment: number;
  rejected: number;
};

const EMPTY_TOTALS: TeesAndBandsSoldRow = { total_tees: 0, total_bands: 0 };
const PRODUCT_ORDER = ['tee', 'band', 'combo'];

export function useExportMerchSummary() {
  const [summary, setSummary] = useState<ExportMerchSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    // The report intentionally reads the same two accounting views as the
    // dashboard. Do not derive confirmed merch from the export's order rows.
    const [productsRes, totalsRes, statusRes] = await Promise.all([
      supabase.from('product_totals').select('slug, name, units_sold, revenue'),
      supabase.from('tees_and_bands_sold').select('total_tees, total_bands').maybeSingle(),
      supabase.from('revenue_summary').select('status, orders, value'),
    ]);

    const totals = totalsRes.data ?? EMPTY_TOTALS;
    const statuses = (statusRes.data ?? []) as RevenueSummaryRow[];
    const ordersFor = (status: RevenueSummaryRow['status']) =>
      Number(statuses.find((row) => row.status === status)?.orders ?? 0);
    const products = [...(productsRes.data ?? [])].sort(
      (a, b) => PRODUCT_ORDER.indexOf(a.slug) - PRODUCT_ORDER.indexOf(b.slug)
    );

    setSummary({
      products,
      totalTees: Number(totals.total_tees),
      totalBands: Number(totals.total_bands),
      confirmedRevenue: products.reduce((sum, product) => sum + Number(product.revenue), 0),
      awaitingPayment: ordersFor('awaiting_payment'),
      rejected: ordersFor('rejected'),
    });
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { summary, loading, refetch };
}
