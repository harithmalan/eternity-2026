import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Feature } from './database.types';

export interface FeaturesContextValue {
  features: Record<string, Feature>;
  loading: boolean;
}

export const FeaturesContext = createContext<FeaturesContextValue | null>(null);

/** Fetches the `features` table once and makes it available via `useFeature`. */
export function FeaturesProvider({ children }: { children: ReactNode }) {
  const [features, setFeatures] = useState<Record<string, Feature>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase
      .from('features')
      .select('*')
      .order('sort')
      .then(
        ({ data, error }) => {
          if (!alive) return;
          if (!error && data) {
            const byKey: Record<string, Feature> = {};
            data.forEach((f) => {
              byKey[f.key] = f;
            });
            setFeatures(byKey);
          }
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

  return createElement(FeaturesContext.Provider, { value: { features, loading } }, children);
}

function fallbackLabel(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Reads a single feature flag by key. Defaults to locked (`isLive: false`)
 * while the `features` table is still loading or has no row for `key`, so
 * gated UI never flashes unlocked before the real value arrives.
 */
export function useFeature(key: string): { isLive: boolean; label: string } {
  const ctx = useContext(FeaturesContext);
  if (!ctx) throw new Error('useFeature must be used within a FeaturesProvider');
  const row = ctx.features[key];
  return {
    isLive: row?.is_live ?? false,
    label: row?.label ?? fallbackLabel(key),
  };
}
