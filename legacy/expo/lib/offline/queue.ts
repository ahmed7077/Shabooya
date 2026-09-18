import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "@/lib/supabase/client";
import { AttendanceStatus } from "@/types/domain";

const QUEUE_KEY = "attendance-offline-queue";

type QueuedAttendance = {
  sessionId: string;
  userId: string;
  status: AttendanceStatus;
  queuedAt: string;
};

export async function markAttendanceWithOfflineQueue(input: QueuedAttendance) {
  const network = await NetInfo.fetch();
  if (!network.isConnected) {
    await enqueue(input);
    return { queued: true };
  }
  await upsertAttendance(input);
  return { queued: false };
}

export async function syncAttendanceQueue() {
  const queued = await readQueue();
  const remaining: QueuedAttendance[] = [];
  for (const item of queued) {
    try {
      await upsertAttendance(item);
    } catch {
      remaining.push(item);
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { synced: queued.length - remaining.length, remaining: remaining.length };
}

async function enqueue(input: QueuedAttendance) {
  const queued = await readQueue();
  const withoutDuplicate = queued.filter((item) => item.sessionId !== input.sessionId);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...withoutDuplicate, input]));
}

async function readQueue(): Promise<QueuedAttendance[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function upsertAttendance(input: QueuedAttendance) {
  const { error } = await supabase.from("attendance").upsert(
    {
      user_id: input.userId,
      session_id: input.sessionId,
      status: input.status,
      marked_at: input.queuedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,session_id" },
  );
  if (error) throw error;
}
