import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { todayISO } from "@/lib/timezone";
import { SessionWithAttendance } from "@/types/domain";

export function useSessions(date?: string) {
  const sessionDate = date ?? todayISO();
  return useQuery({
    queryKey: ["sessions", sessionDate],
    queryFn: async (): Promise<SessionWithAttendance[]> => {
      const { data, error } = await supabase
        .from("sessions_with_attendance")
        .select("*")
        .eq("session_date", sessionDate)
        .order("start_time");
      if (error) throw error;
      return (data ?? []).map(mapSession);
    },
  });
}

export function useAllSessions() {
  return useQuery({
    queryKey: ["sessions", "all"],
    queryFn: async (): Promise<SessionWithAttendance[]> => {
      const { data, error } = await supabase.from("sessions_with_attendance").select("*").order("session_date");
      if (error) throw error;
      return (data ?? []).map(mapSession);
    },
  });
}

function mapSession(row: Record<string, string | boolean | null>): SessionWithAttendance {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    timetableEntryId: row.timetable_entry_id ? String(row.timetable_entry_id) : null,
    sessionDate: String(row.session_date),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    subjectName: String(row.subject_name),
    subjectCode: row.subject_code ? String(row.subject_code) : null,
    sessionType: row.session_type as SessionWithAttendance["sessionType"],
    batch: row.batch ? String(row.batch) : null,
    groupName: row.group_name ? String(row.group_name) : null,
    status: row.status as SessionWithAttendance["status"],
    isException: Boolean(row.is_exception),
    attendanceStatus: row.attendance_status as SessionWithAttendance["attendanceStatus"],
  };
}
