import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
function validPublicConfig() {
  if (!url || !key || /YOUR_PROJECT|YOUR_PUBLIC/.test(`${url} ${key}`))
    return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))
    );
  } catch {
    return false;
  }
}
export const configured = validPublicConfig();
export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export function db() {
  if (!supabase)
    throw new Error('Connect Supabase to start. See README.md for setup.');
  return supabase;
}
