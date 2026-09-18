import * as FileSystem from "expo-file-system";
import { supabase } from "@/lib/supabase/client";

export async function uploadTimetableImage(userId: string, uri: string): Promise<string> {
  const file = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const path = `${userId}/${Date.now()}-timetable.jpg`;
  const { error } = await supabase.storage.from("timetable-images").upload(path, decodeBase64(file), {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

function decodeBase64(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}
