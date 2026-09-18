-- Fresh Next.js schema. The archived Expo migration must NOT be applied to this project.
create table public.profiles (
 id uuid primary key references auth.users on delete cascade, name text not null check(length(name) between 1 and 100), email text not null,
 university text not null, course text not null, semester text not null, student_id text not null default '', timezone text not null default 'Asia/Kolkata', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_settings (
 user_id uuid primary key references auth.users on delete cascade, target numeric not null default .75 check(target between 0 and 1), subject_targets jsonb not null default '{}', subject_labels jsonb not null default '{}', theme text not null default 'system' check(theme in ('system','light','dark')), reminders boolean not null default true
);
create table public.timetables (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, name text not null check(length(name) between 1 and 100), academic_start_date date not null, academic_end_date date not null, timezone text not null, source_image_path text, is_active boolean not null default true, created_at timestamptz not null default now(), unique(id,user_id), check(academic_end_date >= academic_start_date and academic_end_date-academic_start_date <= 370)
);
create unique index one_active_timetable on public.timetables(user_id) where is_active;
create table public.timetable_entries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, timetable_id uuid not null, day_of_week int not null check(day_of_week between 0 and 6), start_time time not null, end_time time not null, subject_name text not null check(length(subject_name) between 1 and 100 and lower(subject_name) not in ('lunch','break')), subject_code text not null default '', session_type text not null check(session_type in ('Lecture','Clinical','Practical','DOAP','SGT','SDL','AETCOM','FAP','Sports/Activity','Other')), batch text not null default '', group_name text not null default '', recurrence text not null check(recurrence in ('weekly','once')), on_date date, is_active boolean not null default true,
 unique(id,user_id), foreign key(timetable_id,user_id) references public.timetables(id,user_id) on delete cascade, check(end_time>start_time), check(recurrence='weekly' or on_date is not null)
);
create table public.sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, timetable_id uuid not null, timetable_entry_id uuid, session_date date not null, start_time time not null, end_time time not null, starts_at timestamptz not null, ends_at timestamptz not null, subject_name text not null, subject_code text not null default '', session_type text not null, batch text not null default '', group_name text not null default '', status text not null default 'scheduled' check(status in ('scheduled','cancelled')), attendance_version bigint not null default 0,
 unique(id,user_id), unique(timetable_entry_id,session_date), foreign key(timetable_id,user_id) references public.timetables(id,user_id), foreign key(timetable_entry_id,user_id) references public.timetable_entries(id,user_id), check(ends_at>starts_at), check(end_time>start_time)
);
create index sessions_owner_date on public.sessions(user_id,session_date);
alter table public.sessions add column last_mutation_id uuid;
create table public.attendance (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, session_id uuid not null, status text not null check(status in ('present','absent')), marked_at timestamptz not null default now(), mutation_id uuid not null,
 foreign key(session_id,user_id) references public.sessions(id,user_id) on delete cascade, unique(user_id,session_id)
);
create table public.calendar_exceptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, exception_date date not null, reason text not null, unique(user_id,exception_date));
create function public.validate_profile() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
 if length(trim(new.university)) not between 1 and 160 or length(trim(new.course)) not between 1 and 100 or length(trim(new.semester)) not between 1 and 60 or length(new.student_id)>60 or length(trim(new.name))<1 or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid profile'; end if;
 new.updated_at:=now(); return new;
end $$;
create trigger profile_validation before insert or update on public.profiles for each row execute function public.validate_profile();
create function public.validate_settings() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if jsonb_typeof(new.subject_targets)<>'object' or jsonb_typeof(new.subject_labels)<>'object' or length(new.subject_targets::text)>50000 or length(new.subject_labels::text)>50000 then raise exception 'Invalid subject settings'; end if;
 if exists(select 1 from jsonb_each(new.subject_targets) where jsonb_typeof(value)<>'number' or (value::text)::numeric not between 0 and 1) then raise exception 'Invalid subject target'; end if;
 if exists(select 1 from jsonb_each(new.subject_labels) where jsonb_typeof(value)<>'string' or length(value #>> '{}') not between 1 and 100) then raise exception 'Invalid subject label'; end if;
 return new;
end $$;
create trigger settings_validation before insert or update on public.user_settings for each row execute function public.validate_settings();
revoke all on function public.validate_profile(),public.validate_settings() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['profiles','user_settings','timetables','timetable_entries','sessions','attendance','calendar_exceptions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_read on public.%I for select to authenticated using (%I = (select auth.uid()))', t, case when t='profiles' then 'id' else 'user_id' end);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy owner_write on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy owner_write on public.user_settings for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant insert,update,delete on public.profiles,public.user_settings to authenticated;
-- Schedule and attendance writes use validated RPCs; direct writes cannot bypass invariants.
revoke insert,update,delete on public.sessions,public.attendance,public.timetables,public.timetable_entries,public.calendar_exceptions from anon,authenticated;
create view public.sessions_with_attendance with (security_invoker=true) as select s.*,a.status as attendance_status from public.sessions s left join public.attendance a on a.session_id=s.id and a.user_id=s.user_id;
grant select on public.sessions_with_attendance to authenticated;

create function public.activate_timetable(draft jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); tid uuid:=gen_random_uuid(); e jsonb; eid uuid; existing boolean; start_date date; end_date date; tz text;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtext(uid::text));
 start_date:=(draft->>'academic_start_date')::date; end_date:=(draft->>'academic_end_date')::date; tz:=draft->>'timezone';
 if not exists(select 1 from pg_timezone_names where name=tz) then raise exception 'Invalid timezone'; end if;
 if jsonb_typeof(draft->'entries') is distinct from 'array' or jsonb_array_length(draft->'entries') not between 1 and 100 then raise exception 'Invalid entries'; end if;
 if draft->>'source_image_path' is not null and split_part(draft->>'source_image_path','/',1)<>uid::text then raise exception 'Invalid image owner'; end if;
 select exists(select 1 from timetables where user_id=uid) into existing;
 -- Never touch started sessions or marked history. Replacement is one atomic transaction.
 delete from sessions s where s.user_id=uid and s.starts_at>now() and not exists(select 1 from attendance a where a.session_id=s.id);
 update timetables set is_active=false where user_id=uid;
 insert into timetables(id,user_id,name,academic_start_date,academic_end_date,timezone,source_image_path) values(tid,uid,draft->>'name',start_date,end_date,tz,draft->>'source_image_path');
 for e in select value from jsonb_array_elements(draft->'entries') loop
 eid:=gen_random_uuid();
 if e->>'recurrence'='once' and (e->>'on_date')::date not between start_date and end_date then raise exception 'Class outside academic period'; end if;
 insert into timetable_entries(id,user_id,timetable_id,day_of_week,start_time,end_time,subject_name,subject_code,session_type,batch,group_name,recurrence,on_date,is_active)
 values(eid,uid,tid,(e->>'day_of_week')::int,(e->>'start_time')::time,(e->>'end_time')::time,trim(e->>'subject_name'),coalesce(e->>'subject_code',''),e->>'session_type',coalesce(e->>'batch',''),coalesce(e->>'group_name',''),e->>'recurrence',nullif(e->>'on_date','')::date,coalesce((e->>'is_active')::boolean,true));
 insert into sessions(user_id,timetable_id,timetable_entry_id,session_date,start_time,end_time,starts_at,ends_at,subject_name,subject_code,session_type,batch,group_name,status)
 select uid,tid,eid,d::date,(e->>'start_time')::time,(e->>'end_time')::time,(d::date+(e->>'start_time')::time) at time zone tz,(d::date+(e->>'end_time')::time) at time zone tz,trim(e->>'subject_name'),coalesce(e->>'subject_code',''),e->>'session_type',coalesce(e->>'batch',''),coalesce(e->>'group_name',''),case when exists(select 1 from calendar_exceptions c where c.user_id=uid and c.exception_date=d::date) then 'cancelled' else 'scheduled' end
 from generate_series(start_date::timestamp,end_date::timestamp,interval '1 day') d
 where coalesce((e->>'is_active')::boolean,true) and (case when e->>'recurrence'='once' then d::date=(e->>'on_date')::date else extract(dow from d)::int=(e->>'day_of_week')::int end)
 and (not existing or (d::date+(e->>'start_time')::time) at time zone tz>now());
 end loop;
 if exists(select 1 from sessions a join sessions b on a.user_id=b.user_id and a.id<b.id and a.starts_at<b.ends_at and b.starts_at<a.ends_at where a.user_id=uid and a.status='scheduled' and b.status='scheduled') then raise exception 'Classes overlap'; end if;
 return tid;
end $$;

create function public.mark_attendance(session_id_input uuid,status_input text,expected_version bigint,mutation_id_input uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s sessions; previous attendance;
begin
 select * into s from sessions where id=session_id_input and user_id=auth.uid() for update;
 if not found then raise exception 'Class unavailable'; end if;
 select * into previous from attendance where session_id=s.id;
 if mutation_id_input is null or expected_version is null or expected_version<0 then raise exception 'Mutation ID and expected version required'; end if;
 if s.last_mutation_id=mutation_id_input then return jsonb_build_object('version',s.attendance_version,'status',previous.status); end if;
 if s.attendance_version<>expected_version then return jsonb_build_object('conflict',true,'version',s.attendance_version,'status',previous.status); end if;
 if s.status='cancelled' then return jsonb_build_object('conflict',true,'cancelled',true,'version',s.attendance_version,'status',previous.status); end if;
 if s.ends_at>now() then raise exception 'Class is not eligible for attendance'; end if;
 if status_input is null then delete from attendance where session_id=s.id;
 else insert into attendance(user_id,session_id,status,mutation_id) values(auth.uid(),s.id,status_input,mutation_id_input) on conflict(user_id,session_id) do update set status=excluded.status,mutation_id=excluded.mutation_id,marked_at=now(); end if;
 update sessions set attendance_version=attendance_version+1,last_mutation_id=mutation_id_input where id=s.id;
 return jsonb_build_object('version',s.attendance_version+1,'status',status_input);
end $$;

create function public.change_session(session_id_input uuid,action_input text,scope_input text default 'one',new_date date default null,new_start time default null,new_end time default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s sessions; tz text; uid uuid:=auth.uid();
begin
 perform pg_advisory_xact_lock(hashtext(uid::text));
 select * into s from sessions where id=session_id_input and user_id=uid for update;
 if not found or scope_input not in ('one','future') then raise exception 'Invalid class'; end if;
 select timezone into tz from timetables where id=s.timetable_id;
 if action_input='cancel' then
 update sessions set status='cancelled' where user_id=uid and (id=s.id or (scope_input='future' and timetable_entry_id=s.timetable_entry_id and starts_at>now() and starts_at>=s.starts_at));
 elsif action_input='restore' then update sessions set status='scheduled' where id=s.id;
 elsif action_input='reschedule' then
 if s.starts_at<=now() or new_date is null or new_start is null or new_end is null or new_end<=new_start then raise exception 'Only future classes can be rescheduled'; end if;
 if not exists(select 1 from timetables where id=s.timetable_id and new_date between academic_start_date and academic_end_date) then raise exception 'Date outside academic period'; end if;
 if (new_date+new_start) at time zone tz<=now() then raise exception 'Choose a future time'; end if;
 update sessions set session_date=case when id=s.id then new_date else session_date end, start_time=new_start,end_time=new_end,starts_at=((case when id=s.id then new_date else session_date end)+new_start) at time zone tz,ends_at=((case when id=s.id then new_date else session_date end)+new_end) at time zone tz
 where user_id=uid and (id=s.id or (scope_input='future' and timetable_entry_id=s.timetable_entry_id and starts_at>now() and starts_at>=s.starts_at));
 else raise exception 'Invalid action'; end if;
 if exists(select 1 from sessions a join sessions b on a.user_id=b.user_id and a.id<b.id and a.starts_at<b.ends_at and b.starts_at<a.ends_at where a.user_id=uid and a.status='scheduled' and b.status='scheduled') then raise exception 'Classes overlap'; end if;
end $$;

create function public.add_holiday(date_input date,reason_input text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or length(trim(reason_input)) not between 1 and 150 then raise exception 'Invalid holiday'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 insert into calendar_exceptions(user_id,exception_date,reason) values(auth.uid(),date_input,reason_input) on conflict(user_id,exception_date) do update set reason=excluded.reason;
 update sessions set status='cancelled' where user_id=auth.uid() and session_date=date_input;
end $$;

create function public.delete_personal_data(kind text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtext(uid::text));
 if kind='history' then delete from attendance where user_id=uid; update sessions set attendance_version=attendance_version+1 where user_id=uid;
 elsif kind='timetable' then delete from sessions s where user_id=uid and starts_at>now() and not exists(select 1 from attendance a where a.session_id=s.id); update timetables set is_active=false where user_id=uid;
 elsif kind='images' then update timetables set source_image_path=null where user_id=uid;
 elsif kind='account' then
 if exists(select 1 from storage.objects where bucket_id='timetable-images' and split_part(name,'/',1)=uid::text) then raise exception 'Remove timetable images first'; end if;
 delete from attendance where user_id=uid; delete from sessions where user_id=uid; delete from timetables where user_id=uid; delete from auth.users where id=uid;
 else raise exception 'Invalid operation'; end if;
end $$;
-- PostgreSQL grants execute to PUBLIC by default: remove that default for every API function.
revoke all on function public.activate_timetable(jsonb),public.mark_attendance(uuid,text,bigint,uuid),public.change_session(uuid,text,text,date,time,time),public.add_holiday(date,text),public.delete_personal_data(text) from public,anon;
grant execute on function public.activate_timetable(jsonb),public.mark_attendance(uuid,text,bigint,uuid),public.change_session(uuid,text,text,date,time,time),public.add_holiday(date,text),public.delete_personal_data(text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('timetable-images','timetable-images',false,5242880,array['image/jpeg','image/png']) on conflict(id) do nothing;
create policy own_image_read on storage.objects for select to authenticated using(bucket_id='timetable-images' and split_part(name,'/',1)=auth.uid()::text);
create policy own_image_insert on storage.objects for insert to authenticated with check(bucket_id='timetable-images' and split_part(name,'/',1)=auth.uid()::text);
create policy own_image_delete on storage.objects for delete to authenticated using(bucket_id='timetable-images' and split_part(name,'/',1)=auth.uid()::text);
