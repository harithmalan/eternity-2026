import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Batch, Product, Settings, SizeChartRow } from '../lib/database.types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('sort')
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && data) setProducts(data);
        setLoading(false);
      },
      () => {
        if (alive) setLoading(false);
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  return { products, loading };
}

export function useSizeChart() {
  const [sizes, setSizes] = useState<SizeChartRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase
      .from('size_chart')
      .select('*')
      .order('sort')
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && data) setSizes(data);
        setLoading(false);
      },
      () => {
        if (alive) setLoading(false);
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  return { sizes, loading };
}

export function useBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase
      .from('batches')
      .select('*')
      .order('sort')
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && data) setBatches(data);
        setLoading(false);
      },
      () => {
        if (alive) setLoading(false);
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  return { batches, loading };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && data) setSettings(data);
        setLoading(false);
      },
      () => {
        if (alive) setLoading(false);
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  return { settings, loading };
}
