-- Daily merch report limits. Null deliberately means "no ceiling set".
alter table settings add column if not exists tee_print_limit int;
alter table settings add column if not exists band_print_limit int;

-- The admin dashboard refetches its reporting views on every order change.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
end $$;
