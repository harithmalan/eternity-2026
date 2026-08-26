import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { SizeAvailability } from '../lib/database.types';

export function useSizeAvailability() {
  const [availability, setAvailability] = useState<Record<string, SizeAvailability>>({});
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async (): Promise<SizeAvailability[]> => {
    const { data, error } = await supabase.from('size_availability').select('*').order('sort');
    if (!error && data) {
      const byKey: Record<string, SizeAvailability> = {};
      data.forEach((row) => {
        byKey[row.size] = row;
      });
      setAvailability(byKey);
      return data;
    }
    return [];
  }, []);

  useEffect(() => {
    let alive = true;
    refetch().finally(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [refetch]);

  return { availability, loading, refetch };
}
