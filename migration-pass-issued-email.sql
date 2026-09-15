-- Queue a pass_issued email every time a pass row is created.
--
-- The trigger looks up name + email from profiles (joined via user_id), and
-- the human-readable code from whichever source the pass is tied to:
--   • passes.order_id  → orders.code   (ETR-…)
--   • passes.registration_id → registrations.code  (ALM-… or GST-…)
--
-- The QR payload in the email is the pass UUID itself (new.id), not the
-- human-readable code.  check_in_pass() in supabase-setup.sql already
-- accepts either form, and the frontend's own QR (built with a JS library
-- on the account page) also encodes the UUID — keeping the two identical
-- means a gate scanner never has to handle two different payload shapes.
--
-- `on conflict do nothing` on the passes INSERT that precedes this means
-- a re-approve cycle (reject → re-upload → approve) will not insert a
-- second pass row, so this trigger will not fire a second time for the
-- same registration — the original pass email is the only one ever sent.
--
-- Safe to rerun: CREATE OR REPLACE on the function, DROP IF EXISTS + CREATE
-- on the trigger.

create or replace function queue_pass_issued_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email     text;
  v_name      text;
  v_pass_code text;
begin
  -- Recipient identity: always from the profile that owns the pass.
  select pr.email, pr.full_name
  into   v_email, v_name
  from   profiles pr
  where  pr.id = new.user_id;

  if v_email is null then
    -- Profile row must exist (foreign key), but if email is somehow null
    -- we skip silently rather than inserting a broken outbox row.
    return new;
  end if;

  -- Human-readable code: whichever source FK is set.
  if new.order_id is not null then
    select o.code into v_pass_code
    from orders o where o.id = new.order_id;
  elsif new.registration_id is not null then
    select r.code into v_pass_code
    from registrations r where r.id = new.registration_id;
  end if;

  -- If neither FK is set (impossible given the constraint, but defensive):
  if v_pass_code is null then
    return new;
  end if;

  insert into email_outbox (to_email, to_name, template, payload)
  values (
    v_email,
    v_name,
    'pass_issued',
    jsonb_build_object(
      'name',      coalesce(nullif(trim(split_part(trim(v_name), ' ', 1)), ''), v_name),
      'pass_id',   new.id::text,
      'pass_code', v_pass_code
    )
  );

  return new;
end $$;

drop trigger if exists trg_queue_pass_issued_email on passes;
create trigger trg_queue_pass_issued_email
  after insert on passes
  for each row execute function queue_pass_issued_email();

notify pgrst, 'reload schema';
