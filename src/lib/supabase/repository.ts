import { db } from './client';
import {
  defaultSettings,
  type Entry,
  type Session,
  type Snapshot,
  type Timetable,
} from '@/types/domain';
export async function loadSnapshot(userId: string): Promise<Snapshot> {
  const client = db();
  const [profile, settings, timetables] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    client
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('timetables')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle(),
  ]);
  if (profile.error || settings.error || timetables.error)
    throw new Error(
      'Your data could not be loaded. Check your connection and try again.',
    );
  let timetable: Timetable | null = null;
  if (timetables.data) {
    const entries = await client
      .from('timetable_entries')
      .select('*')
      .eq('timetable_id', timetables.data.id);
    if (entries.error) throw new Error('Unable to load timetable.');
    timetable = {
      ...timetables.data,
      entries: (entries.data as Entry[]).map((e) => ({
        ...e,
        start_time: e.start_time.slice(0, 5),
        end_time: e.end_time.slice(0, 5),
        on_date: e.on_date || '',
        needs_review: !!e.review_reason,
      })),
    };
  }
  const sessions: Session[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await client
      .from('sessions_with_attendance')
      .select('*')
      .eq('user_id', userId)
      .order('starts_at')
      .order('id')
      .range(offset, offset + 999);
    if (page.error)
      throw new Error('Your classes could not be loaded. Try again.');
    sessions.push(...(page.data as Session[]));
    if (page.data.length < 1000) break;
  }
  return {
    profile: profile.data,
    settings: settings.data || defaultSettings(userId),
    timetable,
    sessions,
  };
}
export async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await db().rpc(name, args);
  if (error)
    throw new Error(
      /overlap/i.test(error.message)
        ? 'These classes overlap. Adjust the times and try again.'
        : /eligible/i.test(error.message)
          ? 'This class has not finished or was cancelled. Refresh your classes.'
          : /outside academic/i.test(error.message)
            ? 'Choose a date within your academic period.'
            : 'Unable to save this change. Check your connection, refresh, and try again.',
    );
  return data;
}
export async function removeImages(userId: string) {
  const client = db();
  for (;;) {
    const { data, error } = await client.storage
      .from('timetable-images')
      .list(userId, { limit: 100 });
    if (error) throw new Error('Could not load your images. Try again.');
    if (!data?.length) break;
    const result = await client.storage
      .from('timetable-images')
      .remove(data.map((f) => `${userId}/${f.name}`));
    if (result.error)
      throw new Error('Could not remove your images. Try again.');
  }
}
