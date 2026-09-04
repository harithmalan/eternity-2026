-- ═══════════════════════════════════════════════════════════════
--  MIGRATION: orders/profiles.attendee → attendee_type
--  Run once. Safe to run twice (every statement below is drop-then-create
--  or create-or-replace).
--
--  CONFIDENCE NOTE, read before running:
--  I (Claude) do not have live read access to this project's actual
--  function/view/constraint definitions — no service_role key exists in
--  this codebase, and the anon key can't introspect them. What follows is
--  reconstructed, not copied from what's actually live:
--
--    §1 admin_order_view    — HIGH confidence. This is close to verbatim
--                              from the migration you pasted me, just with
--                              attendee → attendee_type.
--    §2 issue_pass()        — MEDIUM confidence on the trigger condition
--                              (I designed that rule originally); LOW
--                              confidence on the exact passes.code format,
--                              since I don't know how it's generated today.
--                              Check the code format against a few already-
--                              issued passes before trusting this.
--    §3 orders_identity_check — MEDIUM-HIGH confidence on the business rule
--                              (mine originally too), LOW on exact CASE
--                              phrasing/branch order.
--    §4 center_breakdown    — LOW confidence. I never built this view;
--                              this is a best guess at its shape from the
--                              name and "groups by attendee" alone.
--
--  If any of these don't match reality, tell me the real current
--  definition (pg_get_viewdef / pg_get_functiondef / the constraint's
--  pg_get_constraintdef) and I'll fix the ones I got wrong instead of
--  guessing twice.
-- ═══════════════════════════════════════════════════════════════

-- ── §1. admin_order_view ────────────────────────────────────────
drop view if exists admin_order_view;

create view admin_order_view with (security_invoker = on) as
  select o.id, o.code, o.status,
         o.attendee_type, o.center,
         o.full_name, o.sa_number, o.nic, o.batch, o.phone, o.email,
         o.total, o.subtotal, o.payment_ref, o.slip_path,
         o.created_at, o.slip_uploaded_at, o.payment_due_at,
         o.reviewed_at, o.reviewed_by, o.ready_at, o.collected_at,
         o.rejection_reason,
         p.avatar_url,
         (select string_agg(i.product_name ||
             coalesce(' ('||i.size||')','') || ' x' || i.qty, ', ')
          from order_items i where i.order_id = o.id) as items,
         (select jsonb_agg(jsonb_build_object('product',i.product_name,
             'size',i.size,'qty',i.qty,'unit',i.unit_price))
          from order_items i where i.order_id = o.id) as items_json,
         (select ps.code from passes ps where ps.order_id = o.id)          as pass_code,
         (select ps.checked_in_at from passes ps where ps.order_id = o.id) as checked_in_at
  from orders o
  join profiles p on p.id = o.user_id;

-- ── §2. issue_pass() ─────────────────────────────────────────────
-- Fires on order approval for alumni; inserts the pass with a human-typeable
-- code (order code + a 3-char suffix from the pass's own freshly-generated
-- id) — the same format eternity-web's PassCard already displays and
-- eternity-admin's gate scanner already matches manually-typed codes
-- against. order.code is already globally unique (one pass per order), so
-- the composite code can't collide even if two passes land on the same
-- 3-char suffix.
create or replace function issue_pass()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_pass_id uuid;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and new.attendee_type = 'alumni' then
    new_pass_id := gen_random_uuid();
    insert into passes (id, order_id, user_id, code)
    values (
      new_pass_id, new.id, new.user_id,
      new.code || '-' || upper(left(replace(new_pass_id::text, '-', ''), 3))
    )
    on conflict (order_id) do nothing;
  end if;
  return new;
end $$;

-- ── §3. orders_identity_check ───────────────────────────────────
alter table orders drop constraint if exists orders_identity_check;
alter table orders add constraint orders_identity_check check (
  case attendee_type
    when 'alumni' then sa_number is null and batch is null and nic is not null
    else                sa_number is not null and batch is not null and nic is null
  end
);

-- ── §4. center_breakdown ─────────────────────────────────────────
-- Best guess only — see the confidence note above.
drop view if exists center_breakdown;

create view center_breakdown with (security_invoker = on) as
  select o.center, o.attendee_type, count(*) as orders, sum(o.total) as value
  from orders o
  where o.status in ('approved','ready_for_collection','collected')
  group by 1, 2
  order by 1, 4 desc;

notify pgrst, 'reload schema';
