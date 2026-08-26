import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Order, OrderItem } from '../lib/database.types';

export interface OrderWithItems extends Order {
  items: OrderItem[];
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

    const { data: itemRows } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderRows.map((o) => o.id));

    const itemsByOrder = new Map<string, OrderItem[]>();
    (itemRows ?? []).forEach((item) => {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    });

    setOrders(orderRows.map((o) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] })));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  return { orders, loading, refetch };
}
