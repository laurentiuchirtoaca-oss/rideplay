-- ============================================================================
-- RIDEPLAY — database setup for Supabase
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Safe to run again (it updates functions in place).
--
-- Security model
--  * Every table has Row Level Security ON and NO policies → the public
--    (anon / publishable) key cannot read or write anything.
--  * All access goes through the functions below, which only the server
--    (service_role / secret key) may execute.
--  * Tokens are stored only as SHA-256 hashes; Spotify tokens are stored
--    encrypted (AES-256-GCM) by the server before they reach the database.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables ----

create table if not exists public.rp_hosts (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  provider     text not null check (provider in ('spotify','apple')),
  display_name text not null default 'Driver',
  account_id   text,
  secrets      text,                       -- encrypted JSON (server-side key)
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.rp_sessions (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references public.rp_hosts(id) on delete cascade,
  code         text not null unique,
  channel      text not null unique,
  name         text not null,
  provider     text not null check (provider in ('spotify','apple')),
  status       text not null default 'active' check (status in ('active','ended')),
  permissions  jsonb not null default '{}'::jsonb,
  playback     jsonb not null default '{}'::jsonb,
  player_seen  timestamptz,                -- Apple Music: last report from driver's player tab
  version      bigint not null default 1,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '12 hours',
  ended_at     timestamptz,
  ended_reason text
);
create index if not exists rp_sessions_host_idx on public.rp_sessions (host_id, status);

create table if not exists public.rp_participants (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.rp_sessions(id) on delete cascade,
  token_hash   text not null unique,
  name         text not null,
  can_control  boolean not null default true,
  joined_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at   timestamptz
);
create index if not exists rp_participants_session_idx on public.rp_participants (session_id);

create table if not exists public.rp_queue (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.rp_sessions(id) on delete cascade,
  seq           bigserial,
  provider      text not null,
  track_id      text not null,
  uri           text not null,
  title         text not null,
  artist        text not null default '',
  album         text not null default '',
  artwork       text,
  duration_ms   integer,
  url           text,
  added_by      uuid,                         -- participant id; null = driver
  added_by_name text not null,
  status        text not null default 'queued'
                check (status in ('queued','playing','played','removed')),
  dispatch      text not null default 'pending'
                check (dispatch in ('pending','sent','failed')),
  error         text,
  skip_on_play  boolean not null default false, -- removed after being sent to the provider
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists rp_queue_session_idx on public.rp_queue (session_id, status, seq);

create table if not exists public.rp_commands (
  id          bigserial primary key,
  session_id  uuid not null references public.rp_sessions(id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  queue_id    uuid,
  status      text not null default 'pending' check (status in ('pending','done','failed')),
  error       text,
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists rp_commands_session_idx on public.rp_commands (session_id, status, id);

alter table public.rp_hosts        enable row level security;
alter table public.rp_sessions     enable row level security;
alter table public.rp_participants enable row level security;
alter table public.rp_queue        enable row level security;
alter table public.rp_commands     enable row level security;

grant usage on schema public to service_role;
grant all on public.rp_hosts, public.rp_sessions, public.rp_participants,
             public.rp_queue, public.rp_commands to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------- helpers ---

create or replace function public.rp__defaults() returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'allowAdd', true,        -- passengers may add songs
    'allowPlayback', true,   -- passengers may play / pause
    'allowSkip', true,       -- passengers may skip next / previous
    'maxPerPerson', 0        -- max songs waiting per passenger (0 = no limit)
  )
$$;

create or replace function public.rp__bump(p_session uuid) returns jsonb
language sql as $$
  update public.rp_sessions set version = version + 1
   where id = p_session
  returning jsonb_build_object('version', version, 'channel', channel)
$$;

create or replace function public.rp__item(q public.rp_queue) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', q.id, 'position', q.seq, 'provider', q.provider, 'trackId', q.track_id,
    'uri', q.uri, 'title', q.title, 'artist', q.artist, 'album', q.album,
    'artwork', q.artwork, 'durationMs', q.duration_ms, 'url', q.url,
    'addedBy', q.added_by, 'addedByName', q.added_by_name, 'status', q.status,
    'dispatch', q.dispatch, 'error', q.error, 'skipOnPlay', q.skip_on_play,
    'createdAt', q.created_at)
$$;

-- A session is "live" while active and not past its expiry.
create or replace function public.rp__live(s public.rp_sessions) returns boolean
language sql stable as $$
  select s.status = 'active' and s.expires_at > now()
$$;

-- ------------------------------------------------------------------ hosts ---

create or replace function public.rp_host_save(
  p_token_hash text, p_provider text, p_display_name text,
  p_account_id text, p_secrets text, p_settings jsonb
) returns jsonb
language plpgsql as $$
declare h public.rp_hosts;
begin
  insert into public.rp_hosts (token_hash, provider, display_name, account_id, secrets, settings)
  values (p_token_hash, p_provider, coalesce(nullif(trim(p_display_name), ''), 'Driver'),
          p_account_id, p_secrets, coalesce(p_settings, '{}'::jsonb))
  on conflict (token_hash) do update
     set provider = excluded.provider,
         display_name = excluded.display_name,
         account_id = excluded.account_id,
         secrets = excluded.secrets,
         settings = public.rp_hosts.settings || excluded.settings,
         updated_at = now()
  returning * into h;
  return jsonb_build_object('id', h.id);
end $$;

create or replace function public.rp_host_get(p_token_hash text) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', h.id, 'provider', h.provider, 'displayName', h.display_name,
    'accountId', h.account_id, 'secrets', h.secrets, 'settings', h.settings,
    'session', (
      select jsonb_build_object('id', s.id, 'name', s.name, 'code', s.code)
        from public.rp_sessions s
       where s.host_id = h.id and public.rp__live(s)
       order by s.created_at desc limit 1))
    from public.rp_hosts h where h.token_hash = p_token_hash
$$;

create or replace function public.rp_host_update(
  p_host uuid, p_secrets text, p_settings jsonb, p_display_name text
) returns jsonb
language sql as $$
  update public.rp_hosts
     set secrets = coalesce(p_secrets, secrets),
         settings = settings || coalesce(p_settings, '{}'::jsonb),
         display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
         updated_at = now()
   where id = p_host
  returning jsonb_build_object('id', id)
$$;

-- Disconnect: forget provider tokens and end any live session.
create or replace function public.rp_host_delete(p_host uuid) returns jsonb
language plpgsql as $$
declare r record; out jsonb := '[]'::jsonb;
begin
  for r in
    update public.rp_sessions
       set status = 'ended', ended_at = now(), ended_reason = 'disconnected', version = version + 1
     where host_id = p_host and status = 'active'
    returning channel, version
  loop
    out := out || jsonb_build_object('channel', r.channel, 'version', r.version);
  end loop;
  delete from public.rp_hosts where id = p_host;
  return jsonb_build_object('ended', out);
end $$;

-- --------------------------------------------------------------- sessions ---

create or replace function public.rp_session_create(
  p_host uuid, p_name text, p_code text, p_channel text
) returns jsonb
language plpgsql as $$
declare h public.rp_hosts; s public.rp_sessions; ended jsonb := '[]'::jsonb; r record;
begin
  select * into h from public.rp_hosts where id = p_host;
  if not found then return jsonb_build_object('error', 'not_connected'); end if;

  -- One live session per driver: end the previous one.
  for r in
    update public.rp_sessions
       set status = 'ended', ended_at = now(), ended_reason = 'replaced', version = version + 1
     where host_id = p_host and status = 'active'
    returning channel, version
  loop
    ended := ended || jsonb_build_object('channel', r.channel, 'version', r.version);
  end loop;

  -- Housekeeping: drop sessions that ended more than 7 days ago.
  delete from public.rp_sessions
   where (status = 'ended' and ended_at < now() - interval '7 days')
      or expires_at < now() - interval '7 days';

  insert into public.rp_sessions (host_id, code, channel, name, provider, permissions)
  values (p_host, p_code, p_channel,
          coalesce(nullif(left(trim(p_name), 60), ''), h.display_name || '''s ride'),
          h.provider, public.rp__defaults())
  returning * into s;

  return jsonb_build_object('id', s.id, 'code', s.code, 'ended', ended);
end $$;

-- Public preview shown on the join screen (no private data).
create or replace function public.rp_session_preview(p_code text) returns jsonb
language sql stable as $$
  select case when s.id is null then jsonb_build_object('error', 'not_found')
              when not public.rp__live(s) then jsonb_build_object('error', 'ended')
              else jsonb_build_object(
                'id', s.id, 'name', s.name, 'provider', s.provider,
                'hostName', h.display_name,
                'nowPlaying', s.playback -> 'track',
                'isPlaying', coalesce((s.playback ->> 'isPlaying')::boolean, false),
                'passengers', (select count(*) from public.rp_participants p
                                where p.session_id = s.id and p.removed_at is null))
         end
    from (select 1) one
    left join public.rp_sessions s on s.code = p_code
    left join public.rp_hosts h on h.id = s.host_id
$$;

create or replace function public.rp_session_update(p_host uuid, p_session uuid, p_patch jsonb)
returns jsonb
language plpgsql as $$
declare s public.rp_sessions;
begin
  select * into s from public.rp_sessions where id = p_session and host_id = p_host for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if not public.rp__live(s) then return jsonb_build_object('error', 'ended'); end if;

  if p_patch ? 'end' then
    update public.rp_sessions
       set status = 'ended', ended_at = now(), ended_reason = 'ended_by_driver'
     where id = p_session;
    update public.rp_commands set status = 'failed', error = 'Session ended'
     where session_id = p_session and status = 'pending';
  end if;
  if p_patch ? 'name' then
    update public.rp_sessions
       set name = coalesce(nullif(left(trim(p_patch ->> 'name'), 60), ''), name)
     where id = p_session;
  end if;
  if p_patch ? 'permissions' then
    update public.rp_sessions
       set permissions = permissions || (
         select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
           from jsonb_each(p_patch -> 'permissions') e(k, v)
          where k in ('allowAdd','allowPlayback','allowSkip','maxPerPerson'))
     where id = p_session;
  end if;
  if p_patch ? 'code' then
    -- Regenerate the private link: the old link stops working immediately.
    update public.rp_sessions set code = p_patch ->> 'code' where id = p_session;
  end if;
  if p_patch ? 'extend' then
    update public.rp_sessions set expires_at = now() + interval '12 hours' where id = p_session;
  end if;
  return public.rp__bump(p_session);
end $$;

-- ------------------------------------------------------------ participants --

create or replace function public.rp_join(p_code text, p_token_hash text, p_name text) returns jsonb
language plpgsql as $$
declare s public.rp_sessions; n int; nm text; pid uuid;
begin
  select * into s from public.rp_sessions where code = p_code for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if not public.rp__live(s) then return jsonb_build_object('error', 'ended'); end if;

  select count(*) into n from public.rp_participants
   where session_id = s.id and removed_at is null;
  if n >= 12 then return jsonb_build_object('error', 'full'); end if;

  nm := nullif(left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 24), '');
  if nm is null then nm := 'Passenger ' || (n + 1); end if;
  -- Keep names unique within the session.
  if exists (select 1 from public.rp_participants
              where session_id = s.id and removed_at is null and lower(name) = lower(nm)) then
    nm := left(nm, 21) || ' ' || (n + 1);
  end if;

  insert into public.rp_participants (session_id, token_hash, name)
  values (s.id, p_token_hash, nm) returning id into pid;

  return jsonb_build_object('sessionId', s.id, 'participantId', pid, 'name', nm)
         || public.rp__bump(s.id);
end $$;

create or replace function public.rp_participant_update(
  p_host uuid, p_session uuid, p_participant uuid, p_patch jsonb
) returns jsonb
language plpgsql as $$
begin
  if not exists (select 1 from public.rp_sessions where id = p_session and host_id = p_host) then
    return jsonb_build_object('error', 'not_found');
  end if;
  if p_patch ? 'canControl' then
    update public.rp_participants set can_control = (p_patch ->> 'canControl')::boolean
     where id = p_participant and session_id = p_session;
  end if;
  if (p_patch ->> 'remove')::boolean is true then
    update public.rp_participants set removed_at = now()
     where id = p_participant and session_id = p_session;
  end if;
  return public.rp__bump(p_session);
end $$;

-- Passenger leaves on their own.
create or replace function public.rp_leave(p_session uuid, p_token_hash text) returns jsonb
language plpgsql as $$
begin
  update public.rp_participants set removed_at = now()
   where session_id = p_session and token_hash = p_token_hash and removed_at is null;
  if not found then return jsonb_build_object('error', 'not_member'); end if;
  return public.rp__bump(p_session);
end $$;

-- ------------------------------------------------------------- context -----
-- Resolves who is calling (driver or passenger) for a session and returns
-- everything the server needs to authorise an action. Used by every API call.

create or replace function public.rp_context(
  p_session uuid, p_host_hash text, p_participant_hash text
) returns jsonb
language plpgsql as $$
declare s public.rp_sessions; h public.rp_hosts; p public.rp_participants; actor jsonb;
begin
  select * into s from public.rp_sessions where id = p_session;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  select * into h from public.rp_hosts where id = s.host_id;

  if p_host_hash is not null and h.token_hash = p_host_hash then
    actor := jsonb_build_object('kind', 'host', 'id', null, 'name', h.display_name, 'canControl', true);
  elsif p_participant_hash is not null then
    select * into p from public.rp_participants
     where session_id = s.id and token_hash = p_participant_hash;
    if not found then return jsonb_build_object('error', 'not_member'); end if;
    if p.removed_at is not null then return jsonb_build_object('error', 'removed'); end if;
    update public.rp_participants set last_seen_at = now() where id = p.id;
    actor := jsonb_build_object('kind', 'participant', 'id', p.id, 'name', p.name, 'canControl', p.can_control);
  else
    return jsonb_build_object('error', 'not_member');
  end if;

  if not public.rp__live(s) then
    return jsonb_build_object('error', 'ended', 'reason', coalesce(s.ended_reason, 'expired'),
                              'name', s.name, 'actor', actor);
  end if;

  return jsonb_build_object(
    'actor', actor,
    'session', jsonb_build_object(
      'id', s.id, 'name', s.name, 'provider', s.provider, 'code', s.code, 'channel', s.channel,
      'permissions', public.rp__defaults() || s.permissions, 'playback', s.playback,
      'version', s.version, 'createdAt', s.created_at, 'expiresAt', s.expires_at,
      'playerSeen', s.player_seen),
    'host', jsonb_build_object(
      'id', h.id, 'displayName', h.display_name, 'secrets', h.secrets, 'settings', h.settings));
end $$;

-- Full state for the screen. p_role decides how much is revealed.
create or replace function public.rp_state(p_session uuid, p_role text, p_participant uuid)
returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'version', s.version,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'name', p.name,
               'canControl', p.can_control,
               'joinedAt', p.joined_at,
               'online', p.last_seen_at > now() - interval '45 seconds',
               'me', coalesce(p.id = p_participant, false)) order by p.joined_at)
        from public.rp_participants p
       where p.session_id = s.id and p.removed_at is null), '[]'::jsonb),
    'queue', coalesce((
      select jsonb_agg(public.rp__item(q) order by q.seq)
        from public.rp_queue q
       where q.session_id = s.id and q.status in ('queued','playing')), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(x.item order by x.seq desc) from (
        select public.rp__item(q) item, q.seq from public.rp_queue q
         where q.session_id = s.id and q.status <> 'removed'
         order by q.seq desc limit 8) x), '[]'::jsonb),
    'commands', case when p_role = 'host' then coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'payload', c.payload,
                                          'queueId', c.queue_id) order by c.id)
        from public.rp_commands c
       where c.session_id = s.id and c.status = 'pending'), '[]'::jsonb) else '[]'::jsonb end)
  from public.rp_sessions s where s.id = p_session
$$;

-- ------------------------------------------------------------------ queue ---

create or replace function public.rp_queue_add(
  p_session uuid, p_actor jsonb, p_item jsonb
) returns jsonb
language plpgsql as $$
declare s public.rp_sessions; perms jsonb; pid uuid; waiting int; recent int; q public.rp_queue;
begin
  select * into s from public.rp_sessions where id = p_session for update;
  if not found or not public.rp__live(s) then return jsonb_build_object('error', 'ended'); end if;
  perms := public.rp__defaults() || s.permissions;
  pid := nullif(p_actor ->> 'id', '')::uuid;

  if p_actor ->> 'kind' = 'participant' then
    if not (perms ->> 'allowAdd')::boolean then
      return jsonb_build_object('error', 'add_disabled');
    end if;
    select count(*) into recent from public.rp_queue
     where session_id = s.id and added_by = pid and created_at > now() - interval '20 seconds';
    if recent >= 4 then return jsonb_build_object('error', 'too_fast'); end if;
    if (perms ->> 'maxPerPerson')::int > 0 then
      select count(*) into waiting from public.rp_queue
       where session_id = s.id and added_by = pid and status = 'queued';
      if waiting >= (perms ->> 'maxPerPerson')::int then
        return jsonb_build_object('error', 'limit_reached', 'limit', (perms ->> 'maxPerPerson')::int);
      end if;
    end if;
  end if;

  if exists (select 1 from public.rp_queue
              where session_id = s.id and track_id = p_item ->> 'trackId'
                and status in ('queued','playing')) then
    return jsonb_build_object('error', 'duplicate');
  end if;

  insert into public.rp_queue (session_id, provider, track_id, uri, title, artist, album,
                               artwork, duration_ms, url, added_by, added_by_name)
  values (s.id, s.provider, p_item ->> 'trackId', p_item ->> 'uri',
          left(p_item ->> 'title', 200), left(coalesce(p_item ->> 'artist', ''), 200),
          left(coalesce(p_item ->> 'album', ''), 200), p_item ->> 'artwork',
          nullif(p_item ->> 'durationMs', '')::int, p_item ->> 'url',
          pid, coalesce(p_actor ->> 'name', 'Driver'))
  returning * into q;

  -- Apple Music: the driver's player tab performs the enqueue.
  if s.provider = 'apple' then
    insert into public.rp_commands (session_id, kind, payload, queue_id)
    values (s.id, 'enqueue', jsonb_build_object('id', q.track_id), q.id);
  end if;

  return jsonb_build_object('item', public.rp__item(q)) || public.rp__bump(s.id);
end $$;

create or replace function public.rp_queue_mark(
  p_session uuid, p_item uuid, p_dispatch text, p_error text
) returns jsonb
language plpgsql as $$
begin
  update public.rp_queue
     set dispatch = p_dispatch, error = p_error, updated_at = now()
   where id = p_item and session_id = p_session;
  return public.rp__bump(p_session);
end $$;

-- Driver removes a song. If it was already handed to the provider it cannot be
-- taken back (no provider API for that), so it is flagged to be skipped.
create or replace function public.rp_queue_remove(p_host uuid, p_session uuid, p_item uuid)
returns jsonb
language plpgsql as $$
declare q public.rp_queue;
begin
  if not exists (select 1 from public.rp_sessions where id = p_session and host_id = p_host) then
    return jsonb_build_object('error', 'not_found');
  end if;
  update public.rp_queue
     set status = 'removed', skip_on_play = (dispatch = 'sent' and status = 'queued'),
         updated_at = now()
   where id = p_item and session_id = p_session and status = 'queued'
  returning * into q;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  update public.rp_commands set status = 'failed', error = 'Removed'
   where queue_id = p_item and status = 'pending';
  return jsonb_build_object('wasSent', q.skip_on_play) || public.rp__bump(p_session);
end $$;

-- Retry a song that failed to reach the provider.
create or replace function public.rp_queue_get(p_session uuid, p_item uuid) returns jsonb
language sql stable as $$
  select public.rp__item(q) from public.rp_queue q where q.id = p_item and q.session_id = p_session
$$;

-- -------------------------------------------------------------- playback ---
-- Saves the latest playback state and keeps the shared queue in step with
-- what is actually playing. Returns whether the now-playing song must be
-- skipped (driver removed it after it had already been sent).

create or replace function public.rp_playback_save(p_session uuid, p_playback jsonb, p_player_seen boolean)
returns jsonb
language plpgsql as $$
declare s public.rp_sessions; old_uri text; new_uri text; hit public.rp_queue;
        skip boolean := false; changed boolean;
begin
  select * into s from public.rp_sessions where id = p_session for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  old_uri := s.playback -> 'track' ->> 'uri';
  new_uri := p_playback -> 'track' ->> 'uri';

  changed := old_uri is distinct from new_uri
          or (s.playback ->> 'isPlaying') is distinct from (p_playback ->> 'isPlaying')
          or (s.playback ->> 'error') is distinct from (p_playback ->> 'error')
          or (s.playback -> 'device' ->> 'name') is distinct from (p_playback -> 'device' ->> 'name')
          or abs(coalesce((s.playback ->> 'progressMs')::bigint, 0)
                 + extract(epoch from (now() - coalesce((s.playback ->> 'at')::timestamptz, now()))) * 1000
                 * (case when (s.playback ->> 'isPlaying')::boolean then 1 else 0 end)
                 - coalesce((p_playback ->> 'progressMs')::bigint, 0)) > 4000;

  update public.rp_sessions
     set playback = p_playback || jsonb_build_object('at', now()),
         player_seen = case when p_player_seen then now() else player_seen end
   where id = p_session;

  if new_uri is not null and new_uri is distinct from old_uri then
    -- The song that was playing is finished.
    update public.rp_queue set status = 'played', updated_at = now()
     where session_id = p_session and status = 'playing';

    -- Is the new song one of ours? Take the oldest matching queued (or removed-but-sent) item.
    select * into hit from public.rp_queue
     where session_id = p_session and uri = new_uri
       and (status = 'queued' or (status = 'removed' and skip_on_play))
     order by seq limit 1;
    if found then
      if hit.status = 'removed' then
        skip := true;
        update public.rp_queue set skip_on_play = false, updated_at = now() where id = hit.id;
      else
        update public.rp_queue set status = 'playing', updated_at = now() where id = hit.id;
        -- Anything queued before it was evidently skipped over by the provider.
        update public.rp_queue set status = 'played', updated_at = now()
         where session_id = p_session and status = 'queued' and dispatch = 'sent' and seq < hit.seq;
      end if;
    end if;
    changed := true;
  end if;

  if changed then
    return jsonb_build_object('changed', true, 'skip', skip) || public.rp__bump(p_session);
  end if;
  return jsonb_build_object('changed', false, 'skip', skip, 'channel', s.channel, 'version', s.version);
end $$;

-- ------------------------------------------------------ Apple Music commands -

create or replace function public.rp_command_add(p_session uuid, p_kind text, p_payload jsonb)
returns jsonb
language plpgsql as $$
declare cid bigint;
begin
  insert into public.rp_commands (session_id, kind, payload)
  values (p_session, p_kind, coalesce(p_payload, '{}'::jsonb)) returning id into cid;
  return jsonb_build_object('commandId', cid) || public.rp__bump(p_session);
end $$;

create or replace function public.rp_command_result(
  p_session uuid, p_command bigint, p_ok boolean, p_error text
) returns jsonb
language plpgsql as $$
declare c public.rp_commands;
begin
  update public.rp_commands
     set status = case when p_ok then 'done' else 'failed' end, error = p_error, done_at = now()
   where id = p_command and session_id = p_session and status = 'pending'
  returning * into c;
  if found and c.queue_id is not null then
    update public.rp_queue
       set dispatch = case when p_ok then 'sent' else 'failed' end, error = p_error, updated_at = now()
     where id = c.queue_id;
  end if;
  return public.rp__bump(p_session);
end $$;

-- Passengers learn whether their own command went through.
create or replace function public.rp_command_status(p_session uuid, p_command bigint) returns jsonb
language sql stable as $$
  select jsonb_build_object('status', status, 'error', error)
    from public.rp_commands where id = p_command and session_id = p_session
$$;

-- ---------------------------------------------------------------- grants ----
-- Functions are callable only by the server (service_role).

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'rp\_%'
  loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f.sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';
