import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Order, OrderItem, Pass, Registration } from '../lib/database.types';

export interface OrderWithItems extends Order {
  items: OrderItem[];
  /** Null for every non-alumni order, and for an alumni order not yet approved — RLS already scopes this to rows the signed-in user owns. */
  pass: Pass | null;
}

export interface FreeEntryPass {
  registration: Registration;
  pass: Pass;
}

export function useMyOrders(userId: string | undefined) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [freePasses, setFreePasses] = useState<FreeEntryPass[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setOrders([]);
      setFreePasses([]);
      setLoading(false);
      return;
    }

    const [orderRes, regRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('registrations').select('*').eq('user_id', userId).eq('status', 'approved'),
    ]);

    const orderRows = orderRes.data ?? [];
    const regRows = regRes.data ?? [];

    let orderList: OrderWithItems[] = [];
    if (orderRows.length > 0) {
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

      orderList = orderRows.map((o) => ({ ...o, items: itemsByOrder.get(o.id) ?? [], pass: passByOrder.get(o.id) ?? null }));
    }

    let freeList: FreeEntryPass[] = [];
    const approvedRegsWithPass = regRows.filter((r) => r.pass_id);
    if (approvedRegsWithPass.length > 0) {
      const passIds = approvedRegsWithPass.map((r) => r.pass_id!);
      const { data: passRows } = await supabase.from('passes').select('*').in('id', passIds);
      const passById = new Map<string, Pass>();
      (passRows ?? []).forEach((p) => passById.set(p.id, p));

      freeList = approvedRegsWithPass
        .map((r) => {
          const p = passById.get(r.pass_id!);
          return p ? { registration: r, pass: p } : null;
        })
        .filter((item): item is FreeEntryPass => item !== null);
    }

    setOrders(orderList);
    setFreePasses(freeList);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  return { orders, freePasses, loading, refetch };
}
