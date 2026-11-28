-- Enterprise Notification Sound & Do-Not-Disturb Preferences Migration
-- Project: BAUST CSE Fest Notification & Announcement Management System

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  security_alerts_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  mute_all boolean not null default false,
  dnd_enabled boolean not null default false,
  volume integer not null default 75
    check (volume >= 0 and volume <= 100),
  per_type_settings jsonb not null default '{
    "general": { "enabled": true, "sound": "discord_pop" },
    "announcement": { "enabled": true, "sound": "teams_chime" },
    "approval_request": { "enabled": true, "sound": "slack_knock" },
    "approval_granted": { "enabled": true, "sound": "approval_chime" },
    "approval_rejected": { "enabled": true, "sound": "soft_drop" },
    "new_message": { "enabled": true, "sound": "crisp_bell" },
    "system_alert": { "enabled": true, "sound": "alert_pulse" },
    "high_priority": { "enabled": true, "sound": "urgent_siren" }
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;
revoke all on public.user_notification_preferences from anon;
grant select, insert, update, delete on public.user_notification_preferences to authenticated;

drop policy if exists "Users read own notification preferences" on public.user_notification_preferences;
create policy "Users read own notification preferences"
  on public.user_notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users insert own notification preferences" on public.user_notification_preferences;
create policy "Users insert own notification preferences"
  on public.user_notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users update own notification preferences" on public.user_notification_preferences;
create policy "Users update own notification preferences"
  on public.user_notification_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own notification preferences" on public.user_notification_preferences;
create policy "Users delete own notification preferences"
  on public.user_notification_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.upsert_my_notification_preferences(
  p_email_enabled boolean default true,
  p_push_enabled boolean default true,
  p_in_app_enabled boolean default true,
  p_security_alerts_enabled boolean default true,
  p_sound_enabled boolean default true,
  p_mute_all boolean default false,
  p_dnd_enabled boolean default false,
  p_volume integer default 75,
  p_per_type_settings jsonb default '{}'::jsonb
)
returns public.user_notification_preferences
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clamped_volume integer := greatest(0, least(100, coalesce(p_volume, 75)));
  clean_per_type jsonb := case
    when jsonb_typeof(p_per_type_settings) = 'object' then p_per_type_settings
    else '{}'::jsonb
  end;
  result_row public.user_notification_preferences;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  insert into public.user_notification_preferences (
    user_id,
    email_enabled,
    push_enabled,
    in_app_enabled,
    security_alerts_enabled,
    sound_enabled,
    mute_all,
    dnd_enabled,
    volume,
    per_type_settings,
    updated_at
  ) values (
    uid,
    coalesce(p_email_enabled, true),
    coalesce(p_push_enabled, true),
    coalesce(p_in_app_enabled, true),
    coalesce(p_security_alerts_enabled, true),
    coalesce(p_sound_enabled, true),
    coalesce(p_mute_all, false),
    coalesce(p_dnd_enabled, false),
    clamped_volume,
    clean_per_type,
    now()
  )
  on conflict (user_id) do update
  set email_enabled = excluded.email_enabled,
      push_enabled = excluded.push_enabled,
      in_app_enabled = excluded.in_app_enabled,
      security_alerts_enabled = excluded.security_alerts_enabled,
      sound_enabled = excluded.sound_enabled,
      mute_all = excluded.mute_all,
      dnd_enabled = excluded.dnd_enabled,
      volume = excluded.volume,
      per_type_settings = excluded.per_type_settings,
      updated_at = now()
  returning * into result_row;

  -- Keep legacy notification_preferences JSON on user_profiles synchronized
  update public.user_profiles
  set notification_preferences = jsonb_build_object(
        'email', result_row.email_enabled,
        'push', result_row.push_enabled,
        'inApp', result_row.in_app_enabled,
        'securityAlerts', result_row.security_alerts_enabled
      ),
      updated_at = now()
  where id = uid;

  return result_row;
end;
$$;

revoke all on function public.upsert_my_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb
) from public;
grant execute on function public.upsert_my_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, integer, jsonb
) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.user_notification_preferences;
    exception
      when duplicate_object then null;
      when undefined_table then null;
    end;
  end if;
end;
$$;

notify pgrst, 'reload schema';
