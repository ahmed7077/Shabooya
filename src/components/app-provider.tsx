'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { db, supabase } from '@/lib/supabase/client';
import { loadSnapshot, rpc } from '@/lib/supabase/repository';
import { clearLocal, readLocal, writeLocal } from '@/lib/offline/storage';
import { hasOccurred } from '@/lib/attendance/calculator';
import type { AttendanceStatus, PendingMark, Snapshot } from '@/types/domain';
interface Conflict {
  mark: PendingMark;
  remoteVersion: number;
  remoteStatus: AttendanceStatus | null;
  cancelled?: boolean;
}
interface AppContextValue {
  user: User | null;
  data: Snapshot | null;
  loading: boolean;
  online: boolean;
  syncing: boolean;
  pending: number;
  error: string;
  setError: (s: string) => void;
  refresh: () => Promise<void>;
  mark: (id: string, status: AttendanceStatus | null) => Promise<void>;
  conflicts: Conflict[];
  resolveConflict: (id: string, keep: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  recovery: boolean;
  finishRecovery: () => void;
}
const AppContext = createContext<AppContextValue | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [data, setData] = useState<Snapshot | null>(null),
    [loading, setLoading] = useState(true),
    [online, setOnline] = useState(true),
    [syncing, setSyncing] = useState(false),
    [pending, setPending] = useState(0),
    [error, setError] = useState(''),
    [conflicts, setConflicts] = useState<Conflict[]>([]),
    [recovery, setRecovery] = useState(false);
  const userRef = useRef<User | null>(null),
    busy = useRef(false);
  const apply = useCallback(
    (snapshot: Snapshot | null, queue: PendingMark[]) => {
      if (snapshot)
        setData({
          ...snapshot,
          sessions: snapshot.sessions.map((s) => {
            const m = queue.find((q) => q.session_id === s.id);
            return m ? { ...s, attendance_status: m.status } : s;
          }),
        });
      else setData(null);
      setPending(queue.length);
    },
    [],
  );
  const sync = useCallback(async (reload = true) => {
    const current = userRef.current;
    if (!current || !navigator.onLine || busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      await navigator.locks.request('rollcall-data', async () => {
        const local = await readLocal(current.id);
        const unresolved: Conflict[] = [];
        for (const mark of [...local.queue]) {
          if (userRef.current?.id !== current.id) return;
          const result = await rpc('mark_attendance', {
            session_id_input: mark.session_id,
            status_input: mark.status,
            expected_version: mark.expected_version,
            mutation_id_input: mark.id,
          });
          if (result.conflict) {
            unresolved.push({
              mark,
              remoteVersion: result.version,
              remoteStatus: result.status,
              cancelled: result.cancelled,
            });
            continue;
          }
          local.queue = local.queue.filter((m) => m.id !== mark.id);
          if (local.snapshot)
            local.snapshot.sessions = local.snapshot.sessions.map((s) =>
              s.id === mark.session_id
                ? {
                    ...s,
                    attendance_version: result.version,
                    attendance_status: mark.status,
                  }
                : s,
            );
          await writeLocal(current.id, local);
        }
        const snapshot = reload || !local.snapshot || unresolved.length ? await loadSnapshot(current.id) : local.snapshot;
        if (userRef.current?.id !== current.id) return;
        await writeLocal(current.id, { snapshot, queue: local.queue });
        apply(snapshot, local.queue);
        setConflicts(unresolved);
        setError('');
      });
    } catch {
      setError(
        'Sync paused. Saved changes remain on this device. Check your connection or sign-in, then retry.',
      );
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [apply]);
  const refresh = useCallback(async () => {
    await sync();
  }, [sync]);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    const accept = async (next: User | null) => {
      const previous = userRef.current;
      userRef.current = next;
      setUser(next);
      if (!next) {
        if (previous) {
          const local = await readLocal(previous.id);
          if (local.queue.length) setError('Your session ended. Sign in to the same account to sync attendance saved on this device.');
          else await clearLocal(previous.id);
        }
        sessionStorage.clear();
        if (alive) {
          setData(null);
          setPending(0);
          setConflicts([]);
          setLoading(false);
        }
        return;
      }
      if (previous?.id === next.id) return;
      try {
        const local = await readLocal(next.id);
        if (alive && userRef.current?.id === next.id)
          apply(local.snapshot, local.queue);
      } catch {
        setError(
          'Device storage is unavailable. Enable browser storage to keep attendance safely.',
        );
      } finally {
        if (alive) setLoading(false);
      }
      void sync();
    };
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) void accept(data.session?.user || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') setRecovery(true);
        setTimeout(() => {
          if (alive) void accept(session?.user || null);
        }, 0);
      },
    );
    const onNetwork = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    onNetwork();
    window.addEventListener('online', onNetwork);
    window.addEventListener('offline', onNetwork);
    const onFocus = () => {
      void sync();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      window.removeEventListener('online', onNetwork);
      window.removeEventListener('offline', onNetwork);
      window.removeEventListener('focus', onFocus);
    };
  }, [apply, sync]);
  useEffect(() => {
    const theme = data?.settings.theme || 'system';
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () =>
      (document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [data?.settings.theme]);
  const mark = async (id: string, status: AttendanceStatus | null) => {
    const current = userRef.current;
    if (!current) return;
    try {
      await navigator.locks.request('rollcall-data', async () => {
        const local = await readLocal(current.id);
        const session = local.snapshot?.sessions.find((s) => s.id === id);
        if (!session || !hasOccurred(session) || session.status === 'cancelled')
          throw new Error('You can mark this class after it ends.');
        const existing = local.queue.find((m) => m.session_id === id);
        local.queue = local.queue.filter((m) => m.session_id !== id);
        local.queue.push({
          id: crypto.randomUUID(),
          session_id: id,
          status,
          expected_version:
            existing?.expected_version ?? session.attendance_version,
          queued_at: new Date().toISOString(),
        });
        await writeLocal(current.id, local);
        apply(local.snapshot, local.queue);
      });
      void sync(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save. Please retry.',
      );
    }
  };
  const resolveConflict = async (id: string, keep: boolean) => {
    const conflict = conflicts.find((c) => c.mark.session_id === id);
    if (!conflict || !user) return;
    await navigator.locks.request('rollcall-data', async () => {
      const local = await readLocal(user.id);
      local.queue = local.queue.filter((q) => q.session_id !== id);
      if (keep)
        local.queue.push({
          ...conflict.mark,
          id: crypto.randomUUID(),
          expected_version: conflict.remoteVersion,
        });
      await writeLocal(user.id, local);
      apply(local.snapshot, local.queue);
    });
    setConflicts((c) => c.filter((x) => x.mark.session_id !== id));
    await sync();
  };
  const signOut = async () => {
    if (pending)
      throw new Error(
        'Sync your pending attendance changes before signing out.',
      );
    const { error } = await db().auth.signOut({ scope: 'local' });
    if (error) throw new Error('Sign out failed. Please retry.');
    if (user) await clearLocal(user.id);
    setData(null);
    setUser(null);
  };
  return (
    <AppContext.Provider
      value={{
        user,
        data,
        loading,
        online,
        syncing,
        pending,
        error,
        setError,
        refresh,
        mark,
        conflicts,
        resolveConflict,
        signOut,
        recovery,
        finishRecovery: () => setRecovery(false),
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider required');
  return value;
}
