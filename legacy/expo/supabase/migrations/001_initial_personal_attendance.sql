create extension if not exists "pgcrypto";

create type attendance_status as enum ('present', 'absent');
create type session_lifecycle as enum ('scheduled', 'conducted', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  university text,
  course text,
  semester text,
  student_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.timetables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  academic_start_date date not null,
  academic_end_date date not null,
  source_image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (academic_start_date <= academic_end_date)
);

create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references public.timetables(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  subject_name text not null,
  subject_code text,
  session_type text not null,
  batch text,
  group_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timetable_entry_id uuid references public.timetable_entries(id) on delete set null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  subject_name text not null,
  subject_code text,
  session_type text not null,
  batch text,
  group_name text,
  status session_lifecycle not null default 'scheduled',
  is_exception boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  status attendance_status not null,
  marked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  scheduled_for timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attendance_target numeric(5,2) not null default 75,
  theme text not null default 'system',
  notifications_enabled boolean not null default false,
  upcoming_class_minutes integer not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (attendance_target >= 0 and attendance_target <= 100)
);

alter table public.profiles enable row level security;
alter table public.timetables enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.notifications enable row level security;
alter table public.app_settings enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own timetables" on public.timetables for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own entries through timetable" on public.timetable_entries
  for all using (exists (select 1 from public.timetables t where t.id = timetable_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.timetables t where t.id = timetable_id and t.user_id = auth.uid()));
create policy "own sessions" on public.sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own attendance" on public.attendance for all using (user_id = auth.uid()) with check (
  user_id = auth.uid() and exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);
create policy "own notifications" on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own settings" on public.app_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create view public.sessions_with_attendance as
select
  s.*,
  a.status as attendance_status,
  a.marked_at
from public.sessions s
left join public.attendance a on a.session_id = s.id and a.user_id = s.user_id
where s.user_id = auth.uid();

create view public.active_timetable_entries as
select e.*
from public.timetable_entries e
join public.timetables t on t.id = e.timetable_id
where t.user_id = auth.uid() and t.is_active = true and e.is_active = true;

create or replace function public.delete_current_user_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications where user_id = auth.uid();
  delete from public.attendance where user_id = auth.uid();
  delete from public.sessions where user_id = auth.uid();
  delete from public.timetables where user_id = auth.uid();
  delete from public.app_settings where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger timetables_touch before update on public.timetables for each row execute function public.touch_updated_at();
create trigger timetable_entries_touch before update on public.timetable_entries for each row execute function public.touch_updated_at();
create trigger sessions_touch before update on public.sessions for each row execute function public.touch_updated_at();
create trigger attendance_touch before update on public.attendance for each row execute function public.touch_updated_at();
create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public)
values ('timetable-images', 'timetable-images', false)
on conflict (id) do nothing;

create policy "own timetable image read" on storage.objects for select using (
  bucket_id = 'timetable-images' and split_part(name, '/', 1) = auth.uid()::text
);
create policy "own timetable image insert" on storage.objects for insert with check (
  bucket_id = 'timetable-images' and split_part(name, '/', 1) = auth.uid()::text
);
create policy "own timetable image delete" on storage.objects for delete using (
  bucket_id = 'timetable-images' and split_part(name, '/', 1) = auth.uid()::text
);
