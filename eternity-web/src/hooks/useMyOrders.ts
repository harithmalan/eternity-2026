import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Order, OrderItem, Pass } from '../lib/database.types';

export interface OrderWithItems extends Order {
  items: OrderItem[];
  /** Null for every non-alumni order, and for an alumni order not yet approved — RLS already scopes this to rows the signed-in user owns. */
  pass: Pass | null;
}

export function useMyOrders(userId: string | undefined) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const { data: orderRows, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (orderError || !orderRows) {
      setOrders([]);
      setLoading(false);
      return;
    }
    if (orderRows.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const orderIds = orderRows.map((o) => o.id);
    const [{ data: itemRows }, { data: passRows }] = await Promise.all([
      supabase.from('order_items').select('*').in('order_id', orderIds),
      supabase.from('passes').select('*').in('order_id', orderIds),
    ]);

    const itemsByOrder = new Map<string, OrderItem[]>();
    (itemRows ?? []).forEach((item) => {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    });

    const passByOrder = new Map<string, Pass>();
    (passRows ?? []).forEach((pass) => passByOrder.set(pass.order_id, pass));

    setOrders(orderRows.map((o) => ({ ...o, items: itemsByOrder.get(o.id) ?? [], pass: passByOrder.get(o.id) ?? null })));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  return { orders, loading, refetch };
}
