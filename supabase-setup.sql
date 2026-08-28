-- ═══════════════════════════════════════════════════════════════
--  ETERNITY · SCU Get Together 2026 · free event, paid merch
--  Run top-to-bottom in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create type user_role as enum ('user','admin','superadmin');

create type order_status as enum (
  'awaiting_payment',      -- reserved, no slip yet
  'slip_uploaded',         -- student uploaded, waiting on committee
  'approved',              -- payment verified
  'rejected',              -- bad/unreadable slip, student re-uploads
  'ready_for_collection',
  'collected',
  'cancelled'
);

-- ═══ 1. PROFILES ═══════════════════════════════════════════════
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  sa_number   text,          -- SA / UOB number
  batch       text,
  avatar_url  text,
  role        user_role not null default 'user',
  created_at  timestamptz not null default now()
);

-- Works for Google, Facebook and email/password signups alike. Also queues
-- the one-off welcome email (see §7, email_outbox) — this trigger fires
-- exactly once per new auth.users row, which is exactly "first sign-in."
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_full_name text; new_first_name text;
begin
  new_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');

  insert into public.profiles (id,email,full_name,avatar_url)
  values (new.id, new.email, new_full_name, new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  if found then
    new_first_name := nullif(split_part(trim(new_full_name), ' ', 1), '');
    insert into public.email_outbox (to_email,to_name,template,payload)
    values (new.email, new_full_name, 'welcome', jsonb_build_object('name', new_first_name));
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
                 where id = auth.uid() and role in ('admin','superadmin'));
$$;

create or replace function is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'superadmin');
$$;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- "admins manage profiles" (below) lets any admin update any profile row —
-- fine for fixing a typo'd phone number, not fine for handing someone the
-- keys. Promotion is a distinct, higher-stakes action, so it gets its own
-- guard rather than relying on the eternity-admin UI simply not showing
-- the control to non-superadmins.
create or replace function guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_superadmin() then
    raise exception 'Only a superadmin can change roles.';
  end if;
  return new;
end $$;
create trigger trg_guard_profile_role before update on profiles
  for each row execute function guard_profile_role();

-- ═══ 2. BATCHES (exactly the Google Form list) ═════════════════
create table batches (
  code text primary key,
  sort int not null
);
insert into batches values
 ('FCIT Sem 01',1),('FCIT Sem 02',2),
 ('HD IT Y1S1',3),('HD BM Y1S1',4),('HD EE Y1S1',5),
 ('HD IT Y1S2',6),('HD BM Y1S2',7),('HD EE Y1S2',8),
 ('HD IT Y2S1',9),('HD BM Y2S1',10),('HD EE Y2S1',11),
 ('HD IT Y2S2',12),('HD BM Y2S2',13),('HD EE Y2S2',14),
 ('UOB S1',15),('UOB S2',16);

-- ═══ 3. FEATURE FLAGS ══════════════════════════════════════════
create table features (
  key text primary key, label text not null,
  is_live boolean not null default false, sort int not null default 0,
  updated_at timestamptz not null default now()
);
insert into features (key,label,is_live,sort) values
 ('merch','Merch pre-orders',true, 1),
 ('lineup','The line-up',    false,2),
 ('gallery','The gallery',   false,3),
 ('schedule','The schedule', false,4),
 ('afterparty','The after party',false,5);

-- ═══ 4. SEALED REVEALS ═════════════════════════════════════════
-- `value` must never reach the browser before is_revealed = true.
create table reveals (
  key text primary key, label text not null,
  value text, detail text, link_url text,
  is_revealed boolean not null default false,
  revealed_at timestamptz, sort int not null default 0
);
insert into reveals (key,label,value,link_url,sort) values
 ('artists','Artists on stage','',null,1),
 ('venue',  'Venue','Air Force Ground, Colombo','https://maps.google.com/?q=Air+Force+Ground+Colombo',2),
 ('start',  'Show start','',null,3),
 ('stage',  'Stage design','',null,4);

create or replace view public_reveals with (security_invoker = off) as
  select key,label,sort,is_revealed,revealed_at,
         case when is_revealed then value    else null end as value,
         case when is_revealed then detail   else null end as detail,
         case when is_revealed then link_url else null end as link_url
  from reveals;

create or replace function stamp_reveal()
returns trigger language plpgsql as $$
begin
  if new.is_revealed and not old.is_revealed then new.revealed_at := now();
  elsif not new.is_revealed then new.revealed_at := null; end if;
  return new;
end $$;
create trigger trg_stamp_reveal before update on reveals
  for each row execute function stamp_reveal();

-- Live unseal, without ever putting an unrevealed value on the wire.
--
-- `postgres_changes` realtime is out: it replays WAL rows filtered by the
-- SUBSCRIBER's own RLS, and only admins can SELECT `reveals` (see policies
-- below) — so a visitor's browser would receive nothing, ever, sealed or
-- not. Broadcasting the raw NEW row would fix delivery but defeats the
-- entire point: the payload would carry the true value the instant a
-- committee member so much as edits the label, before `is_revealed` flips.
--
-- So we hand-build the broadcast payload with the exact same mask as
-- `public_reveals` above, and send it as a public (non-private) broadcast —
-- every open tab gets it, unauthenticated, and it can never contain more
-- than the view would. Requires the Realtime "Broadcast from Database"
-- feature (`realtime.send`), on by default on hosted Supabase.
create or replace function broadcast_reveal_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'key', new.key, 'label', new.label, 'sort', new.sort,
      'is_revealed', new.is_revealed, 'revealed_at', new.revealed_at,
      'value',    case when new.is_revealed then new.value    else null end,
      'detail',   case when new.is_revealed then new.detail   else null end,
      'link_url', case when new.is_revealed then new.link_url else null end
    ),
    'reveal_change',   -- event
    'public_reveals',  -- topic — matches the view name for the client
    false              -- public: no realtime.messages RLS policy needed
  );
  return new;
end $$;

create trigger trg_broadcast_reveal after insert or update on reveals
  for each row execute function broadcast_reveal_change();

-- ═══ 4b. ARTISTS (revealed one at a time) ══════════════════════
-- A separate table rather than folding into `reveals`: reveals is one row
-- per fixed card, but the artists card grows one name at a time as the
-- committee confirms each act, so it needs its own row-per-artist shape.
-- Same "nothing sealed reaches the browser" rule as reveals — but here
-- that's enforced by `public_artists` simply omitting unrevealed rows
-- entirely (see below) rather than nulling their columns, since even the
-- *existence* of a not-yet-announced artist shouldn't leak.
create table artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  photo_path text,           -- path within the `artists` storage bucket
  instagram text,
  spotify text,
  is_revealed boolean not null default false,
  revealed_at timestamptz,
  sort int not null default 0
);

create or replace view public_artists with (security_invoker = off) as
  select id, name, tagline, photo_path, instagram, spotify, revealed_at, sort
  from artists
  where is_revealed
  order by sort;

create or replace function stamp_artist_reveal()
returns trigger language plpgsql as $$
begin
  if new.is_revealed and not old.is_revealed then new.revealed_at := now();
  elsif not new.is_revealed then new.revealed_at := null; end if;
  return new;
end $$;
create trigger trg_stamp_artist_reveal before update on artists
  for each row execute function stamp_artist_reveal();

-- Same masked-broadcast approach as broadcast_reveal_change(), except a
-- sealed artist is never sent at all rather than sent with nulled fields —
-- `public_artists` doesn't expose a row for it either, so there's nothing
-- safe to broadcast until `is_revealed` flips true.
create or replace function broadcast_artist_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_revealed then
    perform realtime.send(
      jsonb_build_object(
        'id', new.id, 'name', new.name, 'tagline', new.tagline,
        'photo_path', new.photo_path, 'instagram', new.instagram, 'spotify', new.spotify,
        'revealed_at', new.revealed_at, 'sort', new.sort
      ),
      'artist_change',   -- event
      'public_artists',  -- topic — matches the view name for the client
      false              -- public: no realtime.messages RLS policy needed
    );
  end if;
  return new;
end $$;
create trigger trg_broadcast_artist after insert or update on artists
  for each row execute function broadcast_artist_change();

-- ═══ 4c. POSTS (social feed) ════════════════════════════════════
create table posts (
  id uuid primary key default gen_random_uuid(),
  caption text,
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  like_count int not null default 0,     -- denormalized, see recalc_post_like_count()
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Never the raw upload — the composer downscales/re-encodes client-side
-- before this row exists at all (see the eternity-admin Posts page).
-- `poster_path` is required for every video: without one the browser has to
-- download the whole clip just to paint a first frame, which is the single
-- most expensive mistake a feed can make.
create table post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  kind text not null check (kind in ('image','video')),
  path text not null,          -- object path in the `posts` bucket
  width int,
  height int,
  placeholder text,            -- base64 32px-wide WebP blur-up, images only
  poster_path text,            -- object path in the `posts` bucket, videos only
  duration_s numeric(6,2),     -- videos only
  sort int not null default 0,
  constraint video_requires_poster check (kind <> 'video' or poster_path is not null)
);
create index post_media_post_idx on post_media(post_id);

create table post_likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create or replace function recalc_post_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  pid := coalesce(new.post_id, old.post_id);
  update posts set like_count = (select count(*) from post_likes where post_id = pid) where id = pid;
  return null;
end $$;
create trigger trg_recalc_post_likes after insert or delete on post_likes
  for each row execute function recalc_post_like_count();

-- Only one post pinned at a time — pinning a new one silently unpins
-- whatever was pinned before, in the same transaction, so there's never a
-- moment with two (or zero, mid-swap) pinned posts.
create or replace function guard_single_pin()
returns trigger language plpgsql as $$
begin
  if new.is_pinned and not old.is_pinned then
    update posts set is_pinned = false where is_pinned and id <> new.id;
  end if;
  return new;
end $$;
create trigger trg_guard_single_pin before update on posts
  for each row execute function guard_single_pin();

create trigger trg_touch_posts before update on posts
  for each row execute function set_updated_at();

-- What eternity-web's homepage LATEST section and /feed page both read —
-- never `posts` directly. Draft posts simply don't have a row here, same
-- "unpublished never on the wire" shape as public_reveals/public_artists.
-- `security_invoker = on` (not off): unlike those two, this view doesn't
-- mask any columns — it only filters rows — and the "read published posts"
-- / "read media of published posts" policies below already grant a plain
-- visitor exactly that, so there's nothing to bypass.
create or replace view public_feed with (security_invoker = on) as
  select p.id, p.caption, p.is_pinned, p.like_count, p.published_at,
    (select jsonb_agg(jsonb_build_object(
        'id', m.id, 'kind', m.kind, 'path', m.path, 'width', m.width, 'height', m.height,
        'placeholder', m.placeholder, 'poster_path', m.poster_path,
        'duration_s', m.duration_s, 'sort', m.sort
      ) order by m.sort)
     from post_media m where m.post_id = p.id) as media
  from posts p
  where p.is_published
  order by p.is_pinned desc, p.published_at desc, p.id desc;

-- ═══ 5. PRODUCTS ═══════════════════════════════════════════════
create table products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sku  text,
  description text,
  images text[] not null default '{}',
  early_price   numeric(10,2) not null,
  regular_price numeric(10,2) not null,
  includes_tee  boolean not null default false,   -- needs a size
  includes_band boolean not null default false,
  max_per_order int not null default 5,
  is_active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

insert into products (slug,name,sku,description,early_price,regular_price,
                      includes_tee,includes_band,sort,images) values
 ('combo','Bundle — Tee + Wristband','ETR-COMBO',
  'One tee, one wristband. The full set.', 1750,1950,true, true, 1,
  '{tshirt-front.png,tshirt-back.png,wristband.png}'),
 ('tee','Eternity Tee','ETR-TEE',
  'All-over vortex print on heavyweight black cotton.', 1600,1700,true,false,2,
  '{tshirt-front.png,tshirt-back.png}'),
 ('band','Vortex Band','ETR-WB',
  'Silicone wristband, debossed and ink-filled.', 250,350,false,true,3,
  '{wristband.png}');

-- One global switch for early-bird → normal. Admin edits this row.
create table settings (
  id int primary key default 1 check (id = 1),
  early_bird_ends_at timestamptz not null default '2026-09-08T00:00:00+05:30',
  order_cutoff_at    timestamptz not null default '2026-09-08T00:00:00+05:30',
  payment_window     interval    not null default '24 hours',
  bank_account_name  text not null default 'M/S SLIIT Computing Interactive',
  bank_account_no    text not null default '73031923',
  bank_branch        text not null default 'Bank of Ceylon — Kollupitiya Branch',
  collection_point   text not null default '12th Floor Common Room',
  band_capacity      int  not null default 300 check (band_capacity >= 0),
  -- Artists card display-only knobs — NOT derived from how many artist rows
  -- exist or are revealed. `artist_placeholders` is a committee-set guess
  -- at remaining silhouette count, not the true remaining number.
  artist_placeholders int not null default 4 check (artist_placeholders between 0 and 10),
  more_artists_coming boolean not null default true,
  -- Enforced client-side in the composer, before anything uploads — see the
  -- eternity-admin Posts page.
  feed_max_video_secs int not null default 30 check (feed_max_video_secs > 0),
  feed_home_count     int not null default 3 check (feed_home_count >= 0),
  feed_autoplay       boolean not null default true
);
insert into settings (id) values (1);

create or replace function current_price(p products)
returns numeric language sql stable as $$
  select case when now() < (select early_bird_ends_at from settings where id=1)
              then p.early_price else p.regular_price end;
$$;

create table size_chart (
  size text primary key, chest_in numeric(4,1) not null,
  length_in numeric(4,1) not null, sleeve_in numeric(4,1) not null,
  fits_chest text not null, sort int not null
);
insert into size_chart values
 ('XS',17,26.5,7.5,'32–34',1),('S',18,28,7.8,'34–36',2),('M',20,29,8.2,'38–40',3),
 ('L',22,30,8.6,'42–44',4),('XL',24,31,9.0,'46–48',5),
 ('2XL',26,32,9.4,'50–52',6),('3XL',28,33,9.8,'54–56',7);

-- How many tees of each size were printed. Placeholder counts — the
-- committee edits this table directly (or via an admin screen later) once
-- the real print run is confirmed.
create table size_stock (
  size text primary key references size_chart(size),
  cap  int not null check (cap >= 0)
);
-- Sums to 275 — the actual print run. Placeholder distribution across
-- sizes; the committee edits this table (via eternity-admin → Stock) once
-- pre-orders show the real size curve.
insert into size_stock (size, cap) values
 ('XS',15),('S',45),('M',65),('L',65),('XL',50),('2XL',25),('3XL',10);

-- ═══ 6. ORDERS ═════════════════════════════════════════════════
create sequence order_seq start 1001;

create table orders (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  code    text unique not null default ('ETR-' || nextval('order_seq')),
  status  order_status not null default 'awaiting_payment',

  -- the six Google Form fields, plus size which the form was missing
  full_name text not null,
  sa_number text not null,
  phone     text not null,
  batch     text not null references batches(code),
  email     text not null,

  subtotal numeric(10,2) not null default 0,
  total    numeric(10,2) not null default 0,

  slip_path text,
  slip_uploaded_at timestamptz,
  payment_ref text,

  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  ready_at timestamptz,
  collected_at timestamptz,

  -- Postgres forbids a subquery in DEFAULT, so this constant is a fallback.
  -- trg_payment_due (below) overwrites it from settings.payment_window.
  payment_due_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_user_idx   on orders(user_id);
create index orders_status_idx on orders(status, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  product_name text not null,   -- snapshot
  size text,                    -- required when the product includes a tee
  qty int not null check (qty between 1 and 10),
  unit_price numeric(10,2) not null,  -- ⚠ SNAPSHOT — never recomputed
  line_total numeric(10,2) not null
);
create index order_items_order_idx on order_items(order_id);

-- Price is stamped server-side. The browser never sends a price.
--
-- Stock is enforced here too, not just displayed client-side: `select ...
-- for update` on the size_stock row serializes concurrent inserts for the
-- same size, so two students racing for the last tee can't both get
-- through — the second sees the first's reservation once it locks the row.
-- The exact wording ('Size % is sold out.') is part of the contract: the
-- client surfaces this message verbatim rather than a generic failure.
create or replace function price_order_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare p products; already_reserved int; size_cap int;
begin
  select * into p from products where id = new.product_id and is_active;
  if not found then raise exception 'That item is no longer available.'; end if;

  new.product_name := p.name;
  new.unit_price   := current_price(p);
  new.line_total   := new.unit_price * new.qty;

  if p.includes_tee then
    if new.size is null or not exists (select 1 from size_chart where size = new.size) then
      raise exception 'Pick a t-shirt size for %.', p.name;
    end if;

    select cap into size_cap from size_stock where size = new.size for update;
    if size_cap is not null then
      select coalesce(sum(i.qty), 0) into already_reserved
      from order_items i join orders o on o.id = i.order_id
      where i.size = new.size and o.status not in ('rejected', 'cancelled');

      if already_reserved + new.qty > size_cap then
        raise exception 'Size % is sold out.', new.size;
      end if;
    end if;
  else
    new.size := null;
  end if;

  if new.qty > p.max_per_order then
    raise exception 'Limit is % per order for %.', p.max_per_order, p.name;
  end if;
  return new;
end $$;
create trigger trg_price_item before insert on order_items
  for each row execute function price_order_item();

create or replace function recalc_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare oid uuid; s numeric;
begin
  oid := coalesce(new.order_id, old.order_id);
  select coalesce(sum(line_total),0) into s from order_items where order_id = oid;
  update orders set subtotal = s, total = s, updated_at = now() where id = oid;
  return null;
end $$;
create trigger trg_recalc after insert or update or delete on order_items
  for each row execute function recalc_order();

-- What the size picker reads. `security_invoker = off` on purpose — same
-- reasoning as `public_reveals`: a plain visitor's RLS gives them zero
-- visibility into `orders`/`order_items`, so an invoker-rights view would
-- show every size as fully available to everyone but admins. Running as
-- the view owner lets the aggregate see real reservations while still only
-- exposing the safe shape (size, remaining, sold_out) — never who ordered
-- what.
create or replace view size_availability with (security_invoker = off) as
  select sc.size, sc.sort, ss.cap,
         coalesce(r.qty, 0) as taken,
         greatest(ss.cap - coalesce(r.qty, 0), 0) as remaining,
         (ss.cap - coalesce(r.qty, 0)) <= 0 as sold_out
  from size_chart sc
  join size_stock ss on ss.size = sc.size
  left join (
    select i.size, sum(i.qty) as qty
    from order_items i join orders o on o.id = i.order_id
    where o.status not in ('rejected', 'cancelled')
    group by i.size
  ) r on r.size = sc.size
  order by sc.sort;

-- The wristband equivalent — one aggregate cap, no sizes. Admin-only in
-- practice (nothing student-facing reads this), so unlike size_availability
-- this runs with the caller's own RLS: an admin already has full read
-- access to orders/order_items/settings, so `security_invoker = on`
-- (the default) is enough — no need to bypass RLS for a view nothing
-- public ever queries.
create or replace view band_availability with (security_invoker = on) as
  select
    (select band_capacity from settings where id = 1) as cap,
    coalesce((
      select sum(i.qty) from order_items i
      join orders o on o.id = i.order_id
      join products p on p.id = i.product_id
      where p.includes_band and o.status not in ('rejected', 'cancelled')
    ), 0) as taken;

-- Students may only edit while unpaid or rejected, and may only ever
-- move an order to slip_uploaded.
create or replace function guard_order_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then new.updated_at := now(); return new; end if;
  if old.status not in ('awaiting_payment','rejected') then
    raise exception 'This order is locked. Message the committee to change it.';
  end if;
  if new.status <> old.status and new.status <> 'slip_uploaded' then
    raise exception 'You cannot set that status.';
  end if;
  new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  new.total := old.total; new.subtotal := old.subtotal;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_guard_order before update on orders
  for each row execute function guard_order_update();

-- ═══ 7. EMAIL OUTBOX (SMTP worker reads this) ══════════════════
create table email_outbox (
  id bigserial primary key,
  to_email text not null,
  to_name  text,
  template text not null,      -- welcome | order_received | payment_verified |
                               -- payment_rejected | ready_for_collection
  payload  jsonb not null default '{}',
  status   text not null default 'queued',   -- queued | sending | sent | failed
  attempts int not null default 0,
  error    text,
  claimed_at timestamptz,      -- when a worker last marked this 'sending'
  sent_at  timestamptz,
  created_at timestamptz not null default now()
);
create index email_outbox_pending on email_outbox(status, created_at)
  where status = 'queued';

-- Atomically claims up to `batch_size` queued rows for the worker: the
-- SELECT ... FOR UPDATE SKIP LOCKED happens inside the same UPDATE
-- statement, so two overlapping cron runs can never both grab the same row
-- — one gets it, the other's SKIP LOCKED just passes over it. Only the
-- edge function's service_role connection may call this; a regular user
-- calling it could silently swallow (mark 'sending' and never resolve)
-- someone else's queued email.
--
-- Before claiming anything new, it also reclaims rows some *earlier* run
-- left stuck in 'sending' — the edge function's own per-row try/catch
-- guarantees a row resolves to 'sent' or 'failed' as long as the function
-- itself keeps running, but nothing protects against the whole invocation
-- being killed mid-batch (timeout, OOM, cold-start crash). A row stuck in
-- 'sending' for more than 5 minutes was orphaned by exactly that, not by
-- a send still legitimately in flight — 20 emails take seconds, not minutes.
create or replace function claim_queued_emails(batch_size int default 20)
returns setof email_outbox
language sql security definer set search_path = public as $$
  update email_outbox
  set status = 'queued',
      error = coalesce(error || ' ', '') || '[reclaimed after stall]'
  where status = 'sending' and claimed_at < now() - interval '5 minutes';

  update email_outbox
  set status = 'sending', claimed_at = now()
  where id in (
    select id from email_outbox
    where status = 'queued'
    order by created_at
    limit batch_size
    for update skip locked
  )
  returning *;
$$;
revoke execute on function claim_queued_emails(int) from public;
grant execute on function claim_queued_emails(int) to service_role;

-- Queue the right email whenever an order is created or changes state.
-- Deliberately stores only the order `code`, nothing else: on INSERT
-- specifically, order_items hasn't been written yet and recalc_order()
-- (triggered by that insert) hasn't run, so `new.total` is still 0 and
-- `order_items` for this order is still empty at the exact moment this
-- fires. A snapshot taken here would be wrong by construction. The worker
-- looks the order up fresh by code at send time instead (see
-- send-emails/index.ts) — for all four of these templates, not just
-- order_received, so nothing here can ever go stale between queuing and
-- sending either.
create or replace function queue_order_email()
returns trigger language plpgsql security definer set search_path = public as $$
declare tpl text;
begin
  if TG_OP = 'INSERT' then
    tpl := 'order_received';
  elsif new.status is distinct from old.status then
    tpl := case new.status
             when 'approved'             then 'payment_verified'
             when 'rejected'             then 'payment_rejected'
             when 'ready_for_collection' then 'ready_for_collection'
             else null end;
  end if;

  if tpl is null then return new; end if;

  insert into email_outbox (to_email,to_name,template,payload)
  values (new.email, new.full_name, tpl, jsonb_build_object('code', new.code));
  return new;
end $$;

create trigger trg_email_new after insert on orders
  for each row execute function queue_order_email();
create trigger trg_email_status after update on orders
  for each row execute function queue_order_email();

-- ═══ 8. AUDIT LOG ══════════════════════════════════════════════
create table audit_log (
  id bigserial primary key,
  actor uuid references profiles(id),
  action text not null, entity text not null, entity_id text,
  meta jsonb, created_at timestamptz not null default now()
);
create or replace function log_order_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into audit_log(actor,action,entity,entity_id,meta)
    values (auth.uid(),'status_change','order',new.code,
            jsonb_build_object('from',old.status,'to',new.status));
  end if;
  return new;
end $$;
create trigger trg_log_order after update on orders
  for each row execute function log_order_change();

-- ═══ 9. ROW LEVEL SECURITY ═════════════════════════════════════
alter table profiles      enable row level security;
alter table batches       enable row level security;
alter table features      enable row level security;
alter table reveals       enable row level security;
alter table products      enable row level security;
alter table settings      enable row level security;
alter table size_chart    enable row level security;
alter table orders        enable row level security;
alter table order_items   enable row level security;
alter table email_outbox  enable row level security;
alter table audit_log     enable row level security;

create policy "read own profile"   on profiles for select using (auth.uid() = id or is_admin());
create policy "update own profile" on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from profiles where id = auth.uid()));
create policy "admins manage profiles" on profiles for all using (is_admin()) with check (is_admin());

create policy "read batches"    on batches    for select using (true);
create policy "read features"   on features   for select using (true);
create policy "read products"   on products   for select using (is_active or is_admin());
create policy "read size chart" on size_chart for select using (true);
create policy "read settings"   on settings   for select using (true);

create policy "admins write batches"  on batches    for all using (is_admin()) with check (is_admin());
create policy "admins write features" on features   for all using (is_admin()) with check (is_admin());
create policy "admins write products" on products   for all using (is_admin()) with check (is_admin());
create policy "admins write sizes"    on size_chart for all using (is_admin()) with check (is_admin());
create policy "admins write settings" on settings   for all using (is_admin()) with check (is_admin());

create policy "admins read reveals"  on reveals for select using (is_admin());
create policy "admins write reveals" on reveals for all using (is_admin()) with check (is_admin());
grant select on public_reveals to anon, authenticated;

alter table artists enable row level security;
create policy "admins read artists"  on artists for select using (is_admin());
create policy "admins write artists" on artists for all using (is_admin()) with check (is_admin());
grant select on public_artists to anon, authenticated;

alter table size_stock enable row level security;
create policy "admins write size stock" on size_stock for all using (is_admin()) with check (is_admin());
grant select on size_availability to anon, authenticated;

alter table posts      enable row level security;
alter table post_media enable row level security;
alter table post_likes enable row level security;

create policy "admins manage posts" on posts for all using (is_admin()) with check (is_admin());
create policy "read published posts" on posts for select using (is_published);

create policy "admins manage post media" on post_media for all using (is_admin()) with check (is_admin());
create policy "read media of published posts" on post_media for select
  using (exists (select 1 from posts p where p.id = post_media.post_id and p.is_published));

create policy "read post likes"  on post_likes for select using (true);
create policy "like as self"     on post_likes for insert with check (auth.uid() = user_id);
create policy "unlike own like"  on post_likes for delete using (auth.uid() = user_id);
grant select on public_feed to anon, authenticated;

create policy "read own orders"  on orders for select using (auth.uid() = user_id or is_admin());
create policy "create own order" on orders for insert with check (auth.uid() = user_id);
create policy "update own order" on orders for update using (auth.uid() = user_id or is_admin());
create policy "admins delete orders" on orders for delete using (is_admin());

create policy "read own items" on order_items for select
  using (exists (select 1 from orders o where o.id = order_id
                 and (o.user_id = auth.uid() or is_admin())));
create policy "add items to own unpaid order" on order_items for insert
  with check (exists (select 1 from orders o where o.id = order_id
              and o.user_id = auth.uid() and o.status in ('awaiting_payment','rejected')));
create policy "remove items from own unpaid order" on order_items for delete
  using (exists (select 1 from orders o where o.id = order_id
         and o.user_id = auth.uid() and o.status in ('awaiting_payment','rejected')) or is_admin());

-- Only the service_role worker touches the outbox. No client policy at all.
create policy "admins read outbox" on email_outbox for select using (is_admin());
-- Lets eternity-admin's "Retry" button flip a failed row back to `queued`
-- through RLS with the anon key — no service_role in that app either.
create policy "admins retry outbox" on email_outbox for update using (is_admin()) with check (is_admin());
create policy "admins read audit"  on audit_log    for select using (is_admin());

-- ═══ 10. STORAGE ═══════════════════════════════════════════════
insert into storage.buckets (id,name,public,file_size_limit) values
 ('merch','merch',true,null), ('slips','slips',false,null), ('artists','artists',true,null),
 ('posts','posts',true,26214400)  -- 25MB, enforced by the bucket itself, not just client-side
on conflict do nothing;

create policy "public reads merch" on storage.objects for select using (bucket_id = 'merch');
create policy "admins write merch" on storage.objects for all
  using (bucket_id = 'merch' and is_admin())
  with check (bucket_id = 'merch' and is_admin());

create policy "public reads artist photos" on storage.objects for select using (bucket_id = 'artists');
create policy "admins write artist photos" on storage.objects for all
  using (bucket_id = 'artists' and is_admin())
  with check (bucket_id = 'artists' and is_admin());

create policy "public reads post media" on storage.objects for select using (bucket_id = 'posts');
create policy "admins write post media" on storage.objects for all
  using (bucket_id = 'posts' and is_admin())
  with check (bucket_id = 'posts' and is_admin());

-- slips live at  slips/<user_id>/<order_code>.<ext>
create policy "upload own slip" on storage.objects for insert
  with check (bucket_id = 'slips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own slip" on storage.objects for select
  using (bucket_id = 'slips'
         and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
create policy "replace own slip" on storage.objects for update
  using (bucket_id = 'slips' and (storage.foldername(name))[1] = auth.uid()::text);

-- ═══ 11. ADMIN VIEWS (report export) ═══════════════════════════
-- Feeds the eternity-admin Posts composer/list with each post's media
-- pre-joined as a JSON array, the same reason admin_order_view exists —
-- postgrest's embedded selects don't type well against a generated
-- Database type, so the join happens here instead. `security_invoker = on`
-- (not off, unlike public_reveals/public_artists): this view is
-- admin-only, so it should see exactly what the querying admin's own RLS
-- on posts/post_media already allows — no need to bypass it.
create or replace view admin_post_view with (security_invoker = on) as
  select p.*,
    (select jsonb_agg(jsonb_build_object(
        'id', m.id, 'kind', m.kind, 'path', m.path, 'width', m.width, 'height', m.height,
        'placeholder', m.placeholder, 'poster_path', m.poster_path,
        'duration_s', m.duration_s, 'sort', m.sort
      ) order by m.sort)
     from post_media m where m.post_id = p.id) as media
  from posts p;
grant select on admin_post_view to authenticated;

create or replace view admin_order_view with (security_invoker = on) as
  select o.code, o.status, o.full_name, o.sa_number, o.batch, o.phone, o.email,
         o.total, o.payment_ref, o.slip_path, o.created_at, o.reviewed_at,
         o.ready_at, o.collected_at, o.rejection_reason,
         (select string_agg(i.product_name ||
             coalesce(' ('||i.size||')','') || ' ×' || i.qty, ', ')
          from order_items i where i.order_id = o.id) as items,
         (select jsonb_agg(jsonb_build_object('product',i.product_name,
             'size',i.size,'qty',i.qty,'unit',i.unit_price))
          from order_items i where i.order_id = o.id) as items_json
  from orders o;

-- What to send the printer.
create or replace view size_breakdown with (security_invoker = on) as
  select i.size, sum(i.qty) as units
  from order_items i join orders o on o.id = i.order_id
  where i.size is not null
    and o.status in ('approved','ready_for_collection','collected')
  group by 1 order by (select sort from size_chart s where s.size = i.size);

create or replace view batch_breakdown with (security_invoker = on) as
  select o.batch, count(*) as orders, sum(o.total) as value
  from orders o where o.status in ('approved','ready_for_collection','collected')
  group by 1 order by 3 desc;

create or replace view revenue_summary with (security_invoker = on) as
  select status, count(*) as orders, sum(total) as value
  from orders group by 1;

-- ═══ 12. MAKE YOURSELF ADMIN ═══════════════════════════════════
-- Sign in through the site once, then run:
-- update profiles set role = 'superadmin' where email = 'you@example.com';

-- ═══ 13. EMAIL WORKER SCHEDULING ═══════════════════════════════
-- The `send-emails` edge function (supabase/functions/send-emails) drains
-- email_outbox over SMTP. Run it every minute via pg_cron rather than a
-- Database Webhook on insert: a webhook fires once, right at insert time,
-- and if the function is cold-starting or SMTP hiccups for even one
-- request, that row is stuck forever with nobody retrying it. Cron just
-- tries again next minute for whatever is still `queued` — forgiving by
-- construction.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The cron job needs a credential to get past the function gateway's own
-- JWT check (separate from the service_role key the function uses
-- *internally* to talk to Postgres — see send-emails/index.ts). Store that
-- credential in Vault, not in this file and not in the cron.job table in
-- plaintext. Run this once by hand in the SQL editor, with your project's
-- real service_role key — never commit the real value:
--
--   select vault.create_secret('<your service_role key>', 'send_emails_auth');
--
-- Then replace <your-project-ref> below with your actual project ref and
-- run the schedule call.
select cron.schedule(
  'send-emails-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/send-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'send_emails_auth'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Alternative (not used here): a Database Webhook on `insert into
-- email_outbox` calling the same function. Wire it up in
-- Database → Webhooks in the dashboard if you want emails to go out
-- the instant they're queued rather than waiting up to 60s for the next
-- cron tick — but keep the cron job running alongside it as the retry
-- safety net for anything the webhook's single attempt misses.
