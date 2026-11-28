-- ============================================================================
-- ENTERPRISE DELIVERY LOGS, RETRY HISTORY, DYNAMIC ROOMS, STRICT RBAC,
-- ACTIVE SESSION PRESENCE HYGIENE & ATOMIC PERMANENT USER DELETE RPC
-- ============================================================================

-- ============================================================================
-- 1. DYNAMIC ROOMS MANAGEMENT (SUPER ADMIN CRUD, REALTIME SYNC)
-- ============================================================================

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  building text not null default '',
  capacity integer check (capacity is null or capacity >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rooms_active_name
  on public.rooms (is_active, name asc);

drop trigger if exists rooms_updated_at on public.rooms;
create trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.touch_profile_updated_at();

insert into public.rooms (name, building, capacity, is_active)
values
  ('Academic Building A — Room 204', 'Academic Building A', 80, true),
  ('Academic Building B — Seminar Hall', 'Academic Building B', 250, true),
  ('Central Auditorium', 'Central Complex', 600, true),
  ('CSE Hardware & IoT Lab', 'CSE Wing', 45, true),
  ('CSE Lab 1 (PC-01 to PC-45)', 'CSE Wing', 45, true),
  ('CSE Lab 2 (Networking)', 'CSE Wing', 40, true),
  ('CSE Lab 3 (Algorithm Arena)', 'CSE Wing', 50, true),
  ('Main Field & Registration Booth', 'Campus Grounds', 1000, true)
on conflict (name) do nothing;

alter table public.rooms enable row level security;
revoke all on public.rooms from public, anon, authenticated;
grant select, insert, update, delete on public.rooms to authenticated;

drop policy if exists "Authenticated users read active rooms and super admin reads all" on public.rooms;
create policy "Authenticated users read active rooms and super admin reads all"
  on public.rooms for select to authenticated
  using (
    (select public.is_active_super_admin())
    or (
      is_active = true
      and exists (
        select 1 from public.user_profiles p
        where p.id = (select auth.uid())
          and not coalesce(p.is_deleted, false)
          and not coalesce(p.is_archived, false)
      )
    )
  );

drop policy if exists "Super admin inserts rooms" on public.rooms;
create policy "Super admin inserts rooms"
  on public.rooms for insert to authenticated
  with check ((select public.is_active_super_admin()));

drop policy if exists "Super admin updates rooms" on public.rooms;
create policy "Super admin updates rooms"
  on public.rooms for update to authenticated
  using ((select public.is_active_super_admin()))
  with check ((select public.is_active_super_admin()));

drop policy if exists "Super admin deletes rooms" on public.rooms;
create policy "Super admin deletes rooms"
  on public.rooms for delete to authenticated
  using ((select public.is_active_super_admin()));

create or replace function public.super_admin_upsert_room(
  room_id uuid default null,
  room_name text default '',
  building_name text default '',
  room_capacity integer default null,
  room_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  clean_name text := btrim(coalesce(room_name, ''));
  clean_building text := btrim(coalesce(building_name, ''));
  resolved_id uuid;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active approved Super Admin can manage rooms';
  end if;

  if clean_name = '' then
    raise exception 'Room name is required';
  end if;

  if room_capacity is not null and room_capacity < 0 then
    raise exception 'Room capacity must be zero or greater';
  end if;

  if room_id is not null then
    update public.rooms
    set name = clean_name,
        building = clean_building,
        capacity = room_capacity,
        is_active = coalesce(room_is_active, true),
        updated_at = now()
    where id = room_id
    returning id into resolved_id;

    if resolved_id is null then
      raise exception 'Room not found';
    end if;
  else
    insert into public.rooms (name, building, capacity, is_active, created_by)
    values (clean_name, clean_building, room_capacity, coalesce(room_is_active, true), actor_profile.id)
    returning id into resolved_id;
  end if;

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    actor_profile.id, actor_profile.email, actor_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    case when room_id is null then 'room_created' else 'room_updated' end,
    'governance',
    (case when room_id is null then 'Created room ' else 'Updated room ' end) || clean_name
  );

  return resolved_id;
end;
$$;

revoke all on function public.super_admin_upsert_room(uuid, text, text, integer, boolean) from public;
grant execute on function public.super_admin_upsert_room(uuid, text, text, integer, boolean) to authenticated;

create or replace function public.super_admin_toggle_room_active(
  room_id uuid,
  active_state boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_room public.rooms%rowtype;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active approved Super Admin can enable or disable rooms';
  end if;

  update public.rooms
  set is_active = coalesce(active_state, true),
      updated_at = now()
  where id = room_id
  returning * into target_room;

  if not found then
    raise exception 'Room not found';
  end if;

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    actor_profile.id, actor_profile.email, actor_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    case when target_room.is_active then 'room_enabled' else 'room_disabled' end,
    'governance',
    (case when target_room.is_active then 'Enabled room ' else 'Disabled room ' end) || target_room.name
  );
end;
$$;

revoke all on function public.super_admin_toggle_room_active(uuid, boolean) from public;
grant execute on function public.super_admin_toggle_room_active(uuid, boolean) to authenticated;

create or replace function public.super_admin_delete_room(
  room_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_room public.rooms%rowtype;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active approved Super Admin can delete rooms';
  end if;

  delete from public.rooms
  where id = room_id
  returning * into target_room;

  if not found then
    raise exception 'Room not found';
  end if;

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    actor_profile.id, actor_profile.email, actor_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    'room_deleted', 'governance',
    'Deleted room ' || target_room.name
  );
end;
$$;

revoke all on function public.super_admin_delete_room(uuid) from public;
grant execute on function public.super_admin_delete_room(uuid) to authenticated;

-- ============================================================================
-- 2. REAL NOTIFICATION DELIVERY LOGS & RETRY HISTORY
-- ============================================================================

create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  announcement_id text not null,
  recipient_id uuid references auth.users (id) on delete set null,
  recipient_name text not null default '',
  recipient_email text not null default '',
  recipient_phone text not null default '',
  recipient_role text not null default 'Participant',
  channel text not null
    check (channel in ('In-App', 'Email', 'SMS', 'Push Notification', 'Web Notification')),
  status text not null
    check (status in ('Delivered', 'Pending', 'Failed', 'Gateway Not Configured', 'Skipped')),
  gateway_provider text not null default 'baust-in-app',
  error_code text not null default '',
  error_message text not null default '',
  attempt_count integer not null default 1 check (attempt_count >= 1),
  last_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_delivery_logs_unique_recipient_channel
  on public.notification_delivery_logs (announcement_id, recipient_id, channel)
  where recipient_id is not null;

create index if not exists idx_delivery_logs_announcement_created
  on public.notification_delivery_logs (announcement_id, created_at desc);

create index if not exists idx_delivery_logs_status
  on public.notification_delivery_logs (status, last_attempt_at desc);

create table if not exists public.notification_retry_history (
  id uuid primary key default gen_random_uuid(),
  delivery_log_id uuid not null references public.notification_delivery_logs (id) on delete cascade,
  announcement_id text not null,
  channel text not null,
  attempt_number integer not null,
  previous_status text not null,
  new_status text not null,
  error_code text not null default '',
  error_message text not null default '',
  retried_by uuid references auth.users (id) on delete set null,
  retried_by_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_retry_history_announcement_created
  on public.notification_retry_history (announcement_id, created_at desc);

create index if not exists idx_retry_history_delivery_log
  on public.notification_retry_history (delivery_log_id, attempt_number desc);

alter table public.notification_delivery_logs enable row level security;
alter table public.notification_retry_history enable row level security;

revoke all on public.notification_delivery_logs from public, anon, authenticated;
revoke all on public.notification_retry_history from public, anon, authenticated;
grant select on public.notification_delivery_logs to authenticated;
grant select on public.notification_retry_history to authenticated;

drop policy if exists "Super admin and announcement owner read delivery logs" on public.notification_delivery_logs;
create policy "Super admin and announcement owner read delivery logs"
  on public.notification_delivery_logs for select to authenticated
  using (
    (select public.is_active_super_admin())
    or (
      (select public.is_active_staff())
      and exists (
        select 1 from public.announcements a
        where a.id = announcement_id
          and coalesce(nullif(a.payload->>'senderId', ''), a.updated_by::text) = (select auth.uid())::text
      )
    )
  );

drop policy if exists "Super admin and announcement owner read retry history" on public.notification_retry_history;
create policy "Super admin and announcement owner read retry history"
  on public.notification_retry_history for select to authenticated
  using (
    (select public.is_active_super_admin())
    or (
      (select public.is_active_staff())
      and exists (
        select 1 from public.announcements a
        where a.id = announcement_id
          and coalesce(nullif(a.payload->>'senderId', ''), a.updated_by::text) = (select auth.uid())::text
      )
    )
  );

-- Helper to recalculate accurate announcement totals from notification_delivery_logs
create or replace function public.recalculate_announcement_delivery_metrics(
  target_announcement_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ann_row public.announcements%rowtype;
  total_recipients_cnt integer := 0;
  delivered_cnt integer := 0;
  failed_cnt integer := 0;
  pending_cnt integer := 0;
  breakdown_json jsonb := '[]'::jsonb;
  updated_payload jsonb;
begin
  select * into ann_row
  from public.announcements
  where id = target_announcement_id;

  if not found then
    return '{}'::jsonb;
  end if;

  with recipient_rollup as (
    select
      coalesce(l.recipient_id::text, l.id::text) as rkey,
      bool_or(l.status = 'Delivered') as has_delivered,
      bool_or(l.status = 'Failed') as has_failed,
      bool_or(l.status in ('Pending', 'Gateway Not Configured')) as has_pending
    from public.notification_delivery_logs l
    where l.announcement_id = target_announcement_id
    group by coalesce(l.recipient_id::text, l.id::text)
  )
  select
    count(*)::integer,
    count(*) filter (where has_delivered)::integer,
    count(*) filter (where not has_delivered and has_failed)::integer,
    count(*) filter (where not has_delivered and not has_failed and has_pending)::integer
  into total_recipients_cnt, delivered_cnt, failed_cnt, pending_cnt
  from recipient_rollup;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'channel', ch_row.channel,
      'targetedCount', ch_row.targeted_count,
      'deliveredCount', ch_row.delivered_count,
      'failedCount', ch_row.failed_count,
      'pendingCount', ch_row.pending_count,
      'readCount', coalesce((
        select (elem->>'readCount')::integer
        from jsonb_array_elements(coalesce(ann_row.payload->'channelBreakdown', '[]'::jsonb)) elem
        where elem->>'channel' = ch_row.channel
        limit 1
      ), 0),
      'clickCount', coalesce((
        select (elem->>'clickCount')::integer
        from jsonb_array_elements(coalesce(ann_row.payload->'channelBreakdown', '[]'::jsonb)) elem
        where elem->>'channel' = ch_row.channel
        limit 1
      ), 0)
    )
  ), '[]'::jsonb)
  into breakdown_json
  from (
    select
      l.channel,
      count(*)::integer as targeted_count,
      count(*) filter (where l.status = 'Delivered')::integer as delivered_count,
      count(*) filter (where l.status = 'Failed')::integer as failed_count,
      count(*) filter (where l.status in ('Pending', 'Gateway Not Configured'))::integer as pending_count
    from public.notification_delivery_logs l
    where l.announcement_id = target_announcement_id
    group by l.channel
  ) ch_row;

  updated_payload := jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            ann_row.payload,
            '{totalRecipients}',
            to_jsonb(total_recipients_cnt)
          ),
          '{deliveredCount}',
          to_jsonb(delivered_cnt)
        ),
        '{failedCount}',
        to_jsonb(failed_cnt)
      ),
      '{pendingCount}',
      to_jsonb(pending_cnt)
    ),
    '{channelBreakdown}',
    breakdown_json
  );

  update public.announcements
  set payload = updated_payload,
      updated_at = now()
  where id = target_announcement_id;

  return updated_payload;
end;
$$;

revoke all on function public.recalculate_announcement_delivery_metrics(text) from public;

-- Dispatch real announcement deliveries into notification_delivery_logs + notifications
create or replace function public.dispatch_announcement_deliveries(
  target_announcement_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  ann_row public.announcements%rowtype;
  owner_id text;
  now_ts timestamptz := now();
  target_user_ids text[];
  target_roles text[];
  target_depts text[];
  target_rooms text[];
  everyone_flag boolean;
  channels_arr text[];
  ch text;
  rec record;
  notif_title text;
  notif_body text;
  notif_priority text;
  pref_enabled boolean;
  log_status text;
  log_provider text;
  log_err_code text;
  log_err_msg text;
  final_payload jsonb;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only active approved Organizers or Super Admins can dispatch notices';
  end if;

  select * into ann_row
  from public.announcements
  where id = target_announcement_id;

  if not found then
    raise exception 'Announcement not found';
  end if;

  owner_id := coalesce(nullif(ann_row.payload->>'senderId', ''), ann_row.updated_by::text);
  if actor_profile.role <> 'Super Admin' and owner_id <> actor_profile.id::text then
    raise exception 'Organizers can only dispatch deliveries for their own notices';
  end if;

  notif_title := coalesce(nullif(ann_row.payload->>'title', ''), 'BAUST CSE Fest Notice');
  notif_body := coalesce(nullif(ann_row.payload->>'summary', ''), coalesce(ann_row.payload->>'body', ''));
  notif_priority := coalesce(nullif(ann_row.payload->>'priority', ''), 'Normal');

  everyone_flag := coalesce((ann_row.payload->'targeting'->>'everyoneAttending')::boolean, false);

  select coalesce(array_agg(x), array[]::text[]) into target_user_ids
  from jsonb_array_elements_text(coalesce(ann_row.payload->'targeting'->'targetUserIds', '[]'::jsonb)) x;

  select coalesce(array_agg(x), array[]::text[]) into target_roles
  from jsonb_array_elements_text(coalesce(ann_row.payload->'targeting'->'roles', '[]'::jsonb)) x;

  select coalesce(array_agg(x), array[]::text[]) into target_depts
  from jsonb_array_elements_text(coalesce(ann_row.payload->'targeting'->'departments', '[]'::jsonb)) x;

  select coalesce(array_agg(x), array[]::text[]) into target_rooms
  from jsonb_array_elements_text(coalesce(ann_row.payload->'targeting'->'rooms', '[]'::jsonb)) x;

  select coalesce(array_agg(x), array['In-App']::text[]) into channels_arr
  from jsonb_array_elements_text(coalesce(ann_row.payload->'channels', '["In-App"]'::jsonb)) x;

  if array_length(channels_arr, 1) is null then
    channels_arr := array['In-App'];
  end if;

  for rec in
    select p.*
    from public.user_profiles p
    where p.account_status = 'Active'
      and p.approval_status <> 'Rejected'
      and not coalesce(p.is_deleted, false)
      and not coalesce(p.is_archived, false)
      and (
        (coalesce(array_length(target_user_ids, 1), 0) > 0 and p.id::text = any(target_user_ids))
        or (
          coalesce(array_length(target_user_ids, 1), 0) = 0
          and (
            everyone_flag = true
            or (p.approval_status = 'Pending' and 'Participant' = any(target_roles))
            or (p.approval_status = 'Approved' and p.role = any(target_roles))
          )
          and (
            coalesce(array_length(target_depts, 1), 0) = 0
            or coalesce(p.department, '') = ''
            or p.department = any(target_depts)
          )
        )
      )
  loop
    foreach ch in array channels_arr loop
      if ch not in ('In-App', 'Email', 'SMS', 'Push Notification', 'Web Notification') then
        continue;
      end if;

      pref_enabled := true;
      if ch = 'In-App' then
        pref_enabled := coalesce((rec.notification_preferences->>'inApp')::boolean, true);
      elsif ch = 'Email' then
        pref_enabled := coalesce((rec.notification_preferences->>'email')::boolean, true);
      elsif ch in ('Push Notification', 'Web Notification') then
        pref_enabled := coalesce((rec.notification_preferences->>'push')::boolean, true);
      end if;

      if not pref_enabled then
        log_status := 'Skipped';
        log_provider := 'user-preference';
        log_err_code := 'PREFERENCE_DISABLED';
        log_err_msg := 'Recipient opted out of ' || ch || ' notifications.';
      elsif ch = 'In-App' then
        insert into public.notifications (
          user_id, announcement_id, title, body, channel, priority
        ) values (
          rec.id, target_announcement_id, notif_title, left(notif_body, 500), 'In-App', notif_priority
        )
        on conflict (user_id, announcement_id) do update
        set title = excluded.title,
            body = excluded.body,
            priority = excluded.priority;

        log_status := 'Delivered';
        log_provider := 'supabase-realtime-in-app';
        log_err_code := '';
        log_err_msg := '';
      elsif ch = 'Email' and btrim(coalesce(rec.email, '')) = '' then
        log_status := 'Skipped';
        log_provider := 'email-gateway';
        log_err_code := 'MISSING_EMAIL';
        log_err_msg := 'Recipient profile has no email address.';
      elsif ch = 'SMS' and btrim(coalesce(rec.phone, '')) = '' then
        log_status := 'Skipped';
        log_provider := 'sms-gateway';
        log_err_code := 'MISSING_PHONE';
        log_err_msg := 'Recipient profile has no mobile number.';
      else
        log_status := 'Gateway Not Configured';
        log_provider := case ch
          when 'Email' then 'smtp-email-gateway'
          when 'SMS' then 'sms-gateway'
          when 'Push Notification' then 'fcm-push-gateway'
          else 'web-push-gateway'
        end;
        log_err_code := 'GATEWAY_NOT_CONFIGURED';
        log_err_msg := ch || ' delivery gateway credentials are not configured on this Supabase project.';
      end if;

      insert into public.notification_delivery_logs (
        announcement_id, recipient_id, recipient_name, recipient_email, recipient_phone,
        recipient_role, channel, status, gateway_provider, error_code, error_message,
        attempt_count, last_attempt_at, delivered_at
      ) values (
        target_announcement_id,
        rec.id,
        coalesce(nullif(rec.full_name, ''), rec.email),
        coalesce(rec.email, ''),
        coalesce(rec.phone, ''),
        coalesce(rec.role, 'Participant'),
        ch,
        log_status,
        log_provider,
        log_err_code,
        log_err_msg,
        1,
        now_ts,
        case when log_status = 'Delivered' then now_ts else null end
      )
      on conflict (announcement_id, recipient_id, channel) where recipient_id is not null
      do update set
        recipient_name = excluded.recipient_name,
        recipient_email = excluded.recipient_email,
        recipient_phone = excluded.recipient_phone,
        recipient_role = excluded.recipient_role,
        status = excluded.status,
        gateway_provider = excluded.gateway_provider,
        error_code = excluded.error_code,
        error_message = excluded.error_message,
        attempt_count = public.notification_delivery_logs.attempt_count + 1,
        last_attempt_at = now_ts,
        delivered_at = coalesce(excluded.delivered_at, public.notification_delivery_logs.delivered_at);
    end loop;
  end loop;

  final_payload := public.recalculate_announcement_delivery_metrics(target_announcement_id);

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    actor_profile.id, actor_profile.email, actor_profile.full_name,
    actor_profile.id, actor_profile.full_name,
    'announcement_dispatched', 'notifications',
    'Dispatched "' || notif_title || '" (' ||
      coalesce(final_payload->>'deliveredCount', '0') || '/' ||
      coalesce(final_payload->>'totalRecipients', '0') || ' delivered)'
  );

  return final_payload;
end;
$$;

revoke all on function public.dispatch_announcement_deliveries(text) from public;
grant execute on function public.dispatch_announcement_deliveries(text) to authenticated;

-- Retry failed / pending / unconfigured delivery logs and persist retry history
create or replace function public.retry_failed_deliveries(
  target_announcement_id text,
  target_delivery_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  ann_row public.announcements%rowtype;
  owner_id text;
  log_rec public.notification_delivery_logs%rowtype;
  now_ts timestamptz := now();
  next_attempt integer;
  new_status text;
  new_err_code text;
  new_err_msg text;
  retried_cnt integer := 0;
  delivered_cnt integer := 0;
  remaining_cnt integer := 0;
  not_configured_cnt integer := 0;
  notif_title text;
  notif_body text;
  notif_priority text;
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role in ('Organizer', 'Super Admin');

  if not found then
    raise exception 'Only active approved Organizers or Super Admins can retry deliveries';
  end if;

  select * into ann_row
  from public.announcements
  where id = target_announcement_id;

  if not found then
    raise exception 'Announcement not found';
  end if;

  owner_id := coalesce(nullif(ann_row.payload->>'senderId', ''), ann_row.updated_by::text);
  if actor_profile.role <> 'Super Admin' and owner_id <> actor_profile.id::text then
    raise exception 'Organizers can only retry deliveries for their own notices';
  end if;

  notif_title := coalesce(nullif(ann_row.payload->>'title', ''), 'BAUST CSE Fest Notice');
  notif_body := coalesce(nullif(ann_row.payload->>'summary', ''), coalesce(ann_row.payload->>'body', ''));
  notif_priority := coalesce(nullif(ann_row.payload->>'priority', ''), 'Normal');

  for log_rec in
    select *
    from public.notification_delivery_logs
    where announcement_id = target_announcement_id
      and (target_delivery_id is null or id = target_delivery_id)
      and status in ('Failed', 'Pending', 'Gateway Not Configured')
    order by created_at asc
  loop
    retried_cnt := retried_cnt + 1;
    next_attempt := log_rec.attempt_count + 1;

    if log_rec.channel = 'In-App' and log_rec.recipient_id is not null then
      insert into public.notifications (
        user_id, announcement_id, title, body, channel, priority
      ) values (
        log_rec.recipient_id, target_announcement_id, notif_title, left(notif_body, 500), 'In-App', notif_priority
      )
      on conflict (user_id, announcement_id) do update
      set title = excluded.title,
          body = excluded.body,
          priority = excluded.priority;

      new_status := 'Delivered';
      new_err_code := '';
      new_err_msg := '';
      delivered_cnt := delivered_cnt + 1;
    else
      new_status := 'Gateway Not Configured';
      new_err_code := 'GATEWAY_NOT_CONFIGURED';
      new_err_msg := log_rec.channel || ' delivery gateway credentials are not configured on this Supabase project.';
      not_configured_cnt := not_configured_cnt + 1;
      remaining_cnt := remaining_cnt + 1;
    end if;

    update public.notification_delivery_logs
    set status = new_status,
        error_code = new_err_code,
        error_message = new_err_msg,
        attempt_count = next_attempt,
        last_attempt_at = now_ts,
        delivered_at = case when new_status = 'Delivered' then now_ts else delivered_at end
    where id = log_rec.id;

    insert into public.notification_retry_history (
      delivery_log_id, announcement_id, channel, attempt_number,
      previous_status, new_status, error_code, error_message,
      retried_by, retried_by_name
    ) values (
      log_rec.id, target_announcement_id, log_rec.channel, next_attempt,
      log_rec.status, new_status, new_err_code, new_err_msg,
      actor_profile.id, actor_profile.full_name
    );
  end loop;

  perform public.recalculate_announcement_delivery_metrics(target_announcement_id);

  if retried_cnt > 0 then
    insert into public.activity_logs (
      user_id, user_email, user_name, actor_id, actor_name,
      action, category, details
    ) values (
      actor_profile.id, actor_profile.email, actor_profile.full_name,
      actor_profile.id, actor_profile.full_name,
      'delivery_retry_executed', 'notifications',
      'Retried ' || retried_cnt || ' deliveries for "' || notif_title ||
        '" (' || delivered_cnt || ' delivered, ' || not_configured_cnt || ' gateway not configured)'
    );
  end if;

  return jsonb_build_object(
    'retriedCount', retried_cnt,
    'deliveredCount', delivered_cnt,
    'remainingCount', remaining_cnt,
    'notConfiguredCount', not_configured_cnt
  );
end;
$$;

revoke all on function public.retry_failed_deliveries(text, uuid) from public;
grant execute on function public.retry_failed_deliveries(text, uuid) to authenticated;

-- ============================================================================
-- 3. ACTIVE USER SESSIONS & ONLINE PRESENCE HYGIENE
-- ============================================================================

create table if not exists public.active_user_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'Online' check (status in ('Online', 'Away', 'Offline')),
  current_route text not null default '',
  last_heartbeat_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_active_user_sessions_user
  on public.active_user_sessions (user_id, last_heartbeat_at desc);

alter table public.active_user_sessions enable row level security;
revoke all on public.active_user_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.active_user_sessions to authenticated;

drop policy if exists "Users manage own sessions and staff read sessions" on public.active_user_sessions;
create policy "Users manage own sessions and staff read sessions"
  on public.active_user_sessions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_active_staff()));

drop policy if exists "Users insert own sessions" on public.active_user_sessions;
create policy "Users insert own sessions"
  on public.active_user_sessions for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users update own sessions" on public.active_user_sessions;
create policy "Users update own sessions"
  on public.active_user_sessions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.upsert_my_active_session(
  p_session_id text,
  p_status text default 'Online',
  p_route text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_uid uuid := auth.uid();
  now_ts timestamptz := now();
  safe_status text := case when p_status in ('Online', 'Away', 'Offline') then p_status else 'Online' end;
begin
  if caller_uid is null or btrim(coalesce(p_session_id, '')) = '' then
    return;
  end if;

  -- Prune expired sessions older than 2 minutes without heartbeat
  update public.active_user_sessions
  set status = 'Offline',
      ended_at = coalesce(ended_at, last_heartbeat_at)
  where ended_at is null
    and last_heartbeat_at < now_ts - interval '2 minutes';

  -- Reset stale DB presence for users who have no fresh active session
  update public.user_profiles p
  set presence_status = 'Offline'
  where p.presence_status <> 'Offline'
    and p.id <> caller_uid
    and not exists (
      select 1 from public.active_user_sessions s
      where s.user_id = p.id
        and s.ended_at is null
        and s.status in ('Online', 'Away')
        and s.last_heartbeat_at >= now_ts - interval '2 minutes'
    );

  insert into public.active_user_sessions (
    session_id, user_id, status, current_route, last_heartbeat_at, ended_at
  ) values (
    left(btrim(p_session_id), 120),
    caller_uid,
    safe_status,
    left(coalesce(p_route, ''), 120),
    now_ts,
    case when safe_status = 'Offline' then now_ts else null end
  )
  on conflict (session_id) do update
  set user_id = caller_uid,
      status = safe_status,
      current_route = excluded.current_route,
      last_heartbeat_at = now_ts,
      ended_at = case when safe_status = 'Offline' then now_ts else null end;

  perform set_config('app.bypass_profile_guard', 'true', true);
  update public.user_profiles
  set presence_status = safe_status,
      last_seen_at = now_ts
  where id = caller_uid;
  perform set_config('app.bypass_profile_guard', 'false', true);
end;
$$;

revoke all on function public.upsert_my_active_session(text, text, text) from public;
grant execute on function public.upsert_my_active_session(text, text, text) to authenticated;

create or replace function public.end_my_active_session(
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_uid uuid := auth.uid();
  now_ts timestamptz := now();
  has_other_live boolean := false;
begin
  if caller_uid is null then
    return;
  end if;

  if p_session_id is not null and btrim(p_session_id) <> '' then
    update public.active_user_sessions
    set status = 'Offline',
        ended_at = coalesce(ended_at, now_ts)
    where session_id = btrim(p_session_id)
      and user_id = caller_uid;
  else
    update public.active_user_sessions
    set status = 'Offline',
        ended_at = coalesce(ended_at, now_ts)
    where user_id = caller_uid
      and ended_at is null;
  end if;

  select exists (
    select 1 from public.active_user_sessions s
    where s.user_id = caller_uid
      and s.ended_at is null
      and s.status in ('Online', 'Away')
      and s.last_heartbeat_at >= now_ts - interval '2 minutes'
  ) into has_other_live;

  if not has_other_live then
    perform set_config('app.bypass_profile_guard', 'true', true);
    update public.user_profiles
    set presence_status = 'Offline',
        last_seen_at = now_ts
    where id = caller_uid;
    perform set_config('app.bypass_profile_guard', 'false', true);
  end if;
end;
$$;

revoke all on function public.end_my_active_session(text) from public;
grant execute on function public.end_my_active_session(text) to authenticated;

-- ============================================================================
-- 4. STRICT ORGANIZER VS SUPER ADMIN RBAC HARDENING
-- ============================================================================

-- Announcements: Super Admin sees all; Organizer sees own notices OR Delivered notices targeted to them;
-- Other active users see Delivered notices targeted to them (supporting targetUserIds).
drop policy if exists "Active users read announcements" on public.announcements;
create policy "Active users read announcements"
  on public.announcements for select to authenticated
  using (
    (select public.is_active_super_admin())
    or (
      (select public.is_active_staff())
      and coalesce(nullif(payload->>'senderId', ''), updated_by::text) = (select auth.uid())::text
    )
    or exists (
      select 1
      from public.user_profiles p
      where p.id = (select auth.uid())
        and p.account_status = 'Active'
        and p.approval_status <> 'Rejected'
        and not coalesce(p.is_deleted, false)
        and not coalesce(p.is_archived, false)
        and coalesce(payload->>'status', '') = 'Delivered'
        and nullif(coalesce(payload->>'trashedAt', ''), '') is null
        and (
          coalesce((payload->'targeting'->>'everyoneAttending')::boolean, false) = true
          or (
            jsonb_array_length(coalesce(payload->'targeting'->'targetUserIds', '[]'::jsonb)) > 0
            and coalesce(payload->'targeting'->'targetUserIds', '[]'::jsonb) ? p.id::text
          )
          or (
            jsonb_array_length(coalesce(payload->'targeting'->'targetUserIds', '[]'::jsonb)) = 0
            and (
              (p.approval_status = 'Pending' and coalesce(payload->'targeting'->'roles', '[]'::jsonb) ? 'Participant')
              or (p.approval_status = 'Approved' and coalesce(payload->'targeting'->'roles', '[]'::jsonb) ? p.role)
            )
          )
        )
    )
  );

drop policy if exists "Staff update announcements" on public.announcements;
create policy "Staff update announcements"
  on public.announcements for update to authenticated
  using (
    (select public.is_active_super_admin())
    or (
      (select public.is_active_staff())
      and coalesce(nullif(payload->>'senderId', ''), updated_by::text) = (select auth.uid())::text
    )
  )
  with check (
    (select public.is_active_super_admin())
    or (
      (select public.is_active_staff())
      and coalesce(nullif(payload->>'senderId', ''), updated_by::text) = (select auth.uid())::text
    )
  );

-- Restrict global deletion & system activity logs strictly to Super Admin (own rows allowed for personal activity)
drop policy if exists "Staff read deletion audit logs" on public.user_deletion_audit_logs;
create policy "Super admin read deletion audit logs"
  on public.user_deletion_audit_logs for select to authenticated
  using ((select public.is_active_super_admin()));

drop policy if exists "Staff read all activity logs and users read own" on public.activity_logs;
drop policy if exists "Staff read announcement audit logs" on public.announcement_audit_logs;

create policy "Super admin read all activity logs and users read own"
  on public.activity_logs for select to authenticated
  using (
    (select public.is_active_super_admin())
    or user_id = (select auth.uid())
  );

create policy "Super admin and owner read announcement audit logs"
  on public.announcement_audit_logs for select to authenticated
  using (
    (select public.is_active_super_admin())
    or (
      (select public.is_active_staff())
      and actor_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 5. ATOMIC SUPER ADMIN PERMANENT DELETE RPC (FALLBACK & EDGE FUNCTION BACKING)
-- ============================================================================

create or replace function public.super_admin_permanent_delete_user(
  target_user_id uuid,
  delete_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile public.user_profiles%rowtype;
  target_profile public.user_profiles%rowtype;
  now_ts timestamptz := now();
  clean_notes text := left(btrim(coalesce(delete_notes, '')), 500);
begin
  select * into actor_profile
  from public.user_profiles
  where id = (select auth.uid())
    and account_status = 'Active'
    and approval_status = 'Approved'
    and not coalesce(is_deleted, false)
    and not coalesce(is_archived, false)
    and role = 'Super Admin';

  if not found then
    raise exception 'Only an active approved Super Admin can permanently delete user accounts';
  end if;

  if target_user_id is null then
    raise exception 'A valid target user ID is required';
  end if;

  if target_user_id = actor_profile.id then
    raise exception 'Self deletion is strictly prohibited';
  end if;

  select * into target_profile
  from public.user_profiles
  where id = target_user_id;

  if not found then
    raise exception 'The target account was not found';
  end if;

  if target_profile.role = 'Super Admin' then
    raise exception 'Active Super Admin accounts cannot be permanently deleted';
  end if;

  insert into public.user_deletion_audit_logs (
    target_user_id, target_user_email, target_user_name, target_user_role,
    action, actor_id, actor_name, notes, deleted_at, permanently_deleted_at
  ) values (
    target_profile.id,
    target_profile.email,
    target_profile.full_name,
    target_profile.role,
    'permanently_deleted',
    actor_profile.id,
    actor_profile.full_name,
    coalesce(nullif(clean_notes, ''), 'Permanently deleted from Recycle Bin (account, profile, role assignments, approval history, and authentication record removed)'),
    coalesce(target_profile.deleted_at, now_ts),
    now_ts
  );

  insert into public.activity_logs (
    user_id, user_email, user_name, actor_id, actor_name,
    action, category, details
  ) values (
    null,
    target_profile.email,
    target_profile.full_name,
    actor_profile.id,
    actor_profile.full_name,
    'user_permanently_deleted',
    'governance',
    'Permanently deleted user ' || target_profile.full_name || ' (' || target_profile.email || ')'
  );

  delete from public.role_change_logs where user_id = target_user_id;
  delete from public.approval_logs where user_id = target_user_id;
  delete from public.verification_logs where user_id = target_user_id;
  delete from public.personal_notification_actions where user_id = target_user_id;
  delete from public.notifications where user_id = target_user_id;
  delete from public.organizer_message_replies where author_id = target_user_id;
  delete from public.organizer_messages where sender_id = target_user_id;
  delete from public.incident_reports where reporter_id = target_user_id;
  delete from public.event_info_requests where requester_id = target_user_id;
  delete from public.notification_delivery_logs where recipient_id = target_user_id;
  delete from public.active_user_sessions where user_id = target_user_id;
  delete from public.user_profiles where id = target_user_id;

  delete from auth.users where id = target_user_id;

  return jsonb_build_object(
    'deletedUserId', target_user_id,
    'permanentlyDeletedAt', now_ts
  );
end;
$$;

revoke all on function public.super_admin_permanent_delete_user(uuid, text) from public;
grant execute on function public.super_admin_permanent_delete_user(uuid, text) to authenticated;

-- ============================================================================
-- 6. REALTIME PUBLICATION & SCHEMA CACHE RELOAD
-- ============================================================================

do $$
declare
  tbl text;
  realtime_tables text[] := array[
    'rooms',
    'notification_delivery_logs',
    'notification_retry_history',
    'active_user_sessions'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array realtime_tables loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      exception
        when duplicate_object then null;
        when undefined_table then null;
      end;
    end loop;
  end if;
end;
$$;

notify pgrst, 'reload schema';
