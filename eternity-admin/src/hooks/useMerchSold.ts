import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ProductTotalsRow, Settings, TeesAndBandsSoldRow } from '../lib/database.types';

export type MerchSoldData = {
  totals: TeesAndBandsSoldRow;
  products: ProductTotalsRow[];
  settings: Pick<Settings, 'tee_print_limit' | 'band_print_limit'>;
};

const EMPTY_TOTALS: TeesAndBandsSoldRow = { total_tees: 0, total_bands: 0 };
const EMPTY_SETTINGS: MerchSoldData['settings'] = { tee_print_limit: null, band_print_limit: null };

export function useMerchSold() {
  const [data, setData] = useState<MerchSoldData | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    // These reporting views own the paid-status and bundle-expansion rules.
    const [totalsRes, productsRes, settingsRes] = await Promise.all([
      supabase.from('tees_and_bands_sold').select('total_tees, total_bands').maybeSingle(),
      supabase.from('product_totals').select('slug, name, units_sold, revenue'),
      supabase.from('settings').select('tee_print_limit, band_print_limit').eq('id', 1).maybeSingle(),
    ]);

    setData({
      totals: totalsRes.data ?? EMPTY_TOTALS,
      products: productsRes.data ?? [],
      settings: settingsRes.data ?? EMPTY_SETTINGS,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel('dashboard-merch-sold')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refetch)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  return { data, loading, refetch };
}
