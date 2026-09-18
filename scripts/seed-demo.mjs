// Explicit, optional development seed. Never called by dev, build, CI or the app.
import { createClient } from '@supabase/supabase-js';
if(!process.argv.includes('--confirm-development')||!process.env.DEMO_EMAIL||!process.env.DEMO_PASSWORD)throw new Error('Use a disposable development account. Set DEMO_EMAIL and DEMO_PASSWORD, then pass --confirm-development. Never run on production.');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const {data,error}=await client.auth.signInWithPassword({email:process.env.DEMO_EMAIL,password:process.env.DEMO_PASSWORD});if(error)throw error;
const user=data.user;
const profile=await client.from('profiles').upsert({id:user.id,name:'Demo Student',email:user.email,university:'Example College',course:'Medicine',semester:'Year 2',student_id:'',timezone:'Asia/Kolkata'});if(profile.error)throw profile.error;
const start=new Date();start.setDate(start.getDate()-21);const end=new Date();end.setDate(end.getDate()+60);
const subjects=['Pathology','Pharmacology','Microbiology','Clinical Posting'];
const entries=Array.from({length:5},(_,i)=>[0,1,2].map((slot)=>({id:crypto.randomUUID(),subject_name:subjects[(i+slot)%4],subject_code:'',day_of_week:i+1,start_time:['09:00','10:00','14:00'][slot],end_time:['10:00','12:00','15:00'][slot],session_type:slot===1?'Practical':'Lecture',batch:'A',group_name:'',recurrence:'weekly',on_date:'',is_active:true}))).flat();
const result=await client.rpc('activate_timetable',{draft:{name:'Development demo only',academic_start_date:start.toISOString().slice(0,10),academic_end_date:end.toISOString().slice(0,10),timezone:'Asia/Kolkata',source_image_path:null,entries}});if(result.error)throw result.error;
const sessions=await client.from('sessions').select('id,attendance_version').lt('ends_at',new Date().toISOString()).eq('status','scheduled').order('starts_at').limit(40);if(sessions.error)throw sessions.error;
for(const [i,s]of sessions.data.entries()){const r=await client.rpc('mark_attendance',{session_id_input:s.id,status_input:i%5===0?'absent':'present',expected_version:s.attendance_version,mutation_id_input:crypto.randomUUID()});if(r.error)throw r.error;}
await client.auth.signOut();console.log('Development account seeded. No production code imports this script.');
