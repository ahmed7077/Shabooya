import { openDB } from 'idb';
import type { PendingMark, Snapshot } from '@/types/domain';
const database = () =>
  openDB('rollcall-private-v1', 1, {
    upgrade(db) {
      db.createObjectStore('users');
    },
  });
export interface LocalData {
  snapshot: Snapshot | null;
  queue: PendingMark[];
}
export async function readLocal(id: string): Promise<LocalData> {
  const db = await database();
  return (await db.get('users', id)) || { snapshot: null, queue: [] };
}
export async function writeLocal(id: string, data: LocalData) {
  const db = await database();
  await db.put('users', data, id);
}
export async function clearLocal(id: string) {
  const db = await database();
  await db.delete('users', id);
}
