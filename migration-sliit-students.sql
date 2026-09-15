-- Free SLIIT student RSVP support.
-- Run after migration-alumni-rsvp.sql. Safe to rerun.

alter table registrations add column if not exists student_id_path text;
alter table registrations add column if not exists email text;
alter table registrations alter column nic drop not null;
alter table registrations alter column email drop not null;

alter table registrations drop constraint if exists registrations_kind_check;
alter table registrations add constraint registrations_kind_check
  check (kind in ('alumni_rsvp','sliit_student'));

alter table registrations drop constraint if exists registrations_identity_check;
alter table registrations add constraint registrations_identity_check check (
  case kind
    when 'alumni_rsvp'  then nic is not null and nic <> '' and student_id_path is null
    when 'sliit_student' then student_id_path is not null and student_id_path <> '' and nic is null
    else false
  end
);

create unique index if not exists one_open_registration_per_user_kind
  on registrations(user_id, kind)
  where status in ('pending','approved');

create or replace function stamp_registration_code()
returns trigger language plpgsql as $$
begin
  if new.code is null then
    new.code := case new.kind
      when 'sliit_student' then 'GST-'
      else 'ALM-'
    end || nextval('registration_code_seq')::text;
  end if;
  return new;
end $$;

create or replace function guard_registration_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    new.updated_at := now();
    if new.status is distinct from old.status then
      new.reviewed_at := coalesce(new.reviewed_at, now());
      new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    end if;
    return new;
  end if;

  if auth.uid() <> old.user_id then
    raise exception 'You can only update your own RSVP.';
  end if;
  if old.status <> 'rejected' then
    raise exception 'This RSVP is already under review.';
  end if;
  if new.status <> 'pending' then
    raise exception 'Resubmitted RSVPs must return to pending.';
  end if;

  new.user_id := old.user_id;
  new.kind := old.kind;
  new.code := old.code;
  new.pass_id := old.pass_id;
  new.reviewed_by := old.reviewed_by;
  new.reviewed_at := old.reviewed_at;
  new.rejection_reason := null;
  new.updated_at := now();
  return new;
end $$;

create or replace function issue_identity_registration_pass()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_pass_id uuid;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and new.kind in ('alumni_rsvp','sliit_student') then
    insert into passes (registration_id, user_id)
    values (new.id, new.user_id)
    on conflict (registration_id) do nothing
    returning id into new_pass_id;

    if new_pass_id is null then
      select id into new_pass_id from passes where registration_id = new.id;
    end if;

    update registrations
    set pass_id = new_pass_id
    where id = new.id and pass_id is distinct from new_pass_id and new_pass_id is not null;
  end if;
  return new;
end $$;

drop trigger if exists trg_issue_alumni_rsvp_pass on registrations;
drop trigger if exists trg_issue_identity_registration_pass on registrations;
create trigger trg_issue_identity_registration_pass after update on registrations
  for each row execute function issue_identity_registration_pass();

insert into storage.buckets (id,name,public,file_size_limit)
values ('student-ids','student-ids',false,10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "upload own student id" on storage.objects;
drop policy if exists "read own student id" on storage.objects;
drop policy if exists "admins read student ids" on storage.objects;

create policy "upload own student id" on storage.objects for insert
  with check (bucket_id = 'student-ids' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own student id" on storage.objects for select
  using (bucket_id = 'student-ids' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "admins read student ids" on storage.objects for select
  using (bucket_id = 'student-ids' and is_admin());

create or replace view gate_manifest with (security_invoker = on) as
  select
    p.id as pass_id,
    o.code as order_code,
    o.full_name,
    o.center,
    o.phone,
    pr.avatar_url as photo_url,
    p.checked_in_at,
    checker.full_name as checked_in_by_name,
    p.void_reason
  from passes p
  join orders o on o.id = p.order_id
  join profiles pr on pr.id = p.user_id
  left join profiles checker on checker.id = p.checked_in_by
  where p.order_id is not null
  union all
  select
    p.id as pass_id,
    r.code as order_code,
    r.full_name,
    r.center,
    r.phone,
    pr.avatar_url as photo_url,
    p.checked_in_at,
    checker.full_name as checked_in_by_name,
    p.void_reason
  from passes p
  join registrations r on r.id = p.registration_id
  join profiles pr on pr.id = p.user_id
  left join profiles checker on checker.id = p.checked_in_by
  where p.registration_id is not null and r.status = 'approved';

create or replace function purge_alumni_nics()
returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set nic = null where nic is not null;
  update registrations set nic = '' where kind = 'alumni_rsvp' and nic <> '';
  update registrations set student_id_path = null where kind = 'sliit_student' and student_id_path is not null;
  delete from storage.objects where bucket_id = 'student-ids';
end $$;
revoke all on function purge_alumni_nics() from public;

create or replace view registration_queue with (security_invoker = on) as
  select
    r.*,
    p.code as pass_code,
    p.checked_in_at
  from registrations r
  left join passes p on p.registration_id = r.id
  order by
    case when r.status = 'pending' then 0 else 1 end,
    r.created_at desc;

create or replace function purge_student_ids_post_event()
returns void language plpgsql security definer set search_path = public as $$
begin
  update registrations set student_id_path = null where kind = 'sliit_student' and student_id_path is not null;
  delete from storage.objects where bucket_id = 'student-ids';
end $$;
revoke all on function purge_student_ids_post_event() from public;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-alumni-nics-post-event',
      '0 3 21 9 *',
      $$ select purge_alumni_nics(); $$
    );
    perform cron.schedule(
      'purge-student-ids-one-week-post-event',
      '0 3 25 9 *',
      $$ select purge_student_ids_post_event(); $$
    );
  end if;
exception when others then
  null;
end $$;

notify pgrst, 'reload schema';
