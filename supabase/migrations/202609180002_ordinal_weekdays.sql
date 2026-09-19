-- Supports explicitly printed ordinal weekday patterns, e.g. 1st/3rd/5th Saturdays.
alter table public.timetable_entries add column month_weeks integer[] not null default '{}'
 check (month_weeks <@ array[1,2,3,4,5] and cardinality(month_weeks)<=5);
alter table public.timetable_entries
 add column source_text text not null default '' check(length(source_text)<=2000),
 add column review_reason text not null default '' check(length(review_reason)<=500);

create or replace function public.activate_timetable(draft jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
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
 insert into timetable_entries(id,user_id,timetable_id,day_of_week,start_time,end_time,subject_name,subject_code,session_type,batch,group_name,recurrence,on_date,is_active,month_weeks,source_text,review_reason)
 values(eid,uid,tid,(e->>'day_of_week')::int,(e->>'start_time')::time,(e->>'end_time')::time,trim(e->>'subject_name'),coalesce(e->>'subject_code',''),e->>'session_type',coalesce(e->>'batch',''),coalesce(e->>'group_name',''),e->>'recurrence',nullif(e->>'on_date','')::date,coalesce((e->>'is_active')::boolean,true),array(select jsonb_array_elements_text(coalesce(e->'month_weeks','[]'::jsonb))::integer),coalesce(e->>'source_text',''),coalesce(e->>'review_reason',''));
 insert into sessions(user_id,timetable_id,timetable_entry_id,session_date,start_time,end_time,starts_at,ends_at,subject_name,subject_code,session_type,batch,group_name,status)
 select uid,tid,eid,d::date,(e->>'start_time')::time,(e->>'end_time')::time,(d::date+(e->>'start_time')::time) at time zone tz,(d::date+(e->>'end_time')::time) at time zone tz,trim(e->>'subject_name'),coalesce(e->>'subject_code',''),e->>'session_type',coalesce(e->>'batch',''),coalesce(e->>'group_name',''),case when exists(select 1 from calendar_exceptions c where c.user_id=uid and c.exception_date=d::date) then 'cancelled' else 'scheduled' end
 from generate_series(start_date::timestamp,end_date::timestamp,interval '1 day') d
 where coalesce((e->>'is_active')::boolean,true) and (case when e->>'recurrence'='once' then d::date=(e->>'on_date')::date else extract(dow from d)::int=(e->>'day_of_week')::int and (jsonb_array_length(coalesce(e->'month_weeks','[]'::jsonb))=0 or ceil(extract(day from d)/7)::int in (select jsonb_array_elements_text(e->'month_weeks')::int)) end)
 and (not existing or (d::date+(e->>'start_time')::time) at time zone tz>now());
 end loop;
 if exists(select 1 from sessions a join sessions b on a.user_id=b.user_id and a.id<b.id and a.starts_at<b.ends_at and b.starts_at<a.ends_at where a.user_id=uid and a.status='scheduled' and b.status='scheduled') then raise exception 'Classes overlap'; end if;
 return tid;
end $$;
