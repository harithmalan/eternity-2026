-- ═══════════════════════════════════════════════════════════════
--  MIGRATION: fold "fresh graduate" into the batch list
--  Run once. Safe to run twice (on conflict do nothing).
--
--  The order form no longer offers "Fresh graduate" as a separate attendee
--  type — a graduate still has an SA/UOB number, so they take the student
--  path and pick one of these batches instead. attendee_type keeps its
--  'graduate' enum value (dropping it means rebuilding the type, and
--  nothing writes it anymore) — this migration only adds the batches and,
--  if any orders/profiles already used 'graduate', folds them into
--  'student' so historical rows read the same way new ones will.
-- ═══════════════════════════════════════════════════════════════

insert into batches (code, sort) values
  ('Graduate 2026', 20),
  ('Graduate 2025', 21),
  ('Graduate 2024', 22)
on conflict (code) do nothing;

-- Same app.internal_write bypass your own earlier migration used around
-- this exact update — I don't have visibility into that guard's real
-- definition, so I'm matching your established pattern rather than
-- guessing whether a plain UPDATE would trip it.
do $$
begin
  perform set_config('app.internal_write','on',true);
  update orders   set attendee_type = 'student' where attendee_type = 'graduate';
  update profiles set attendee_type = 'student' where attendee_type = 'graduate';
  perform set_config('app.internal_write','off',true);
end $$;

select 'graduate batches: '
       || (select count(*) from batches where code like 'Graduate%')::text
    || ' | orders still typed graduate: '
       || (select count(*) from orders where attendee_type = 'graduate')::text as result;
