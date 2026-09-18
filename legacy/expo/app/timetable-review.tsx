import { useLocalSearchParams, router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, FlatList, Text, TextInput, View } from "react-native";
import { Button, Card, Screen, Title } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";
import { uploadTimetableImage } from "@/lib/storage/timetableImages";
import { generateSessions } from "@/lib/timetable/generator";
import { ExtractedTimetable, TimetableEntry, Weekday } from "@/types/domain";

const dayMap: Record<string, Weekday> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

type EditableEntry = {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  sessionType: string;
  needsReview: boolean;
  active: boolean;
};

export default function TimetableReviewScreen() {
  const { payload, imageUri } = useLocalSearchParams<{ payload: string; imageUri: string }>();
  const { user } = useAuth();
  const extracted = useMemo(() => JSON.parse(payload ?? "{}") as ExtractedTimetable, [payload]);
  const [startDate, setStartDate] = useState(extracted.academicStartDate.value ?? "");
  const [endDate, setEndDate] = useState(extracted.academicEndDate.value ?? "");
  const [entries, setEntries] = useState<EditableEntry[]>(
    extracted.entries.map((entry, index) => ({
      id: String(index),
      day: entry.day.value ?? "",
      startTime: entry.startTime.value ?? "",
      endTime: entry.endTime.value ?? "",
      subjectName: entry.subjectName.value ?? "",
      sessionType: entry.excluded ? "Break" : entry.sessionType.value ?? "Lecture",
      needsReview: entry.day.needsReview || entry.startTime.needsReview || entry.endTime.needsReview || entry.subjectName.needsReview,
      active: !entry.excluded,
    })),
  );

  function update(id: string, patch: Partial<EditableEntry>) {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  async function confirm() {
    if (!user) return;
    if (!startDate || !endDate) return Alert.alert("Dates required", "Set the academic start and end dates before generating sessions.");
    const valid = entries.filter((entry) => entry.active && entry.subjectName && entry.startTime && entry.endTime && dayMap[entry.day.toLowerCase()] !== undefined);
    if (valid.length === 0) return Alert.alert("No classes", "Add at least one attendance session.");

    const sourceImagePath = imageUri ? await uploadTimetableImage(user.id, imageUri) : null;
    await supabase.from("timetables").update({ is_active: false }).eq("user_id", user.id).eq("is_active", true);
    const { data: timetable, error } = await supabase
      .from("timetables")
      .insert({ user_id: user.id, name: "Personal timetable", academic_start_date: startDate, academic_end_date: endDate, source_image_path: sourceImagePath, is_active: true })
      .select()
      .single();
    if (error) throw error;

    const entryRows = valid.map((entry) => ({
      timetable_id: timetable.id,
      day_of_week: dayMap[entry.day.toLowerCase()],
      start_time: entry.startTime,
      end_time: entry.endTime,
      subject_name: entry.subjectName,
      session_type: entry.sessionType,
      is_active: true,
    }));
    const { data: createdEntries, error: entryError } = await supabase.from("timetable_entries").insert(entryRows).select();
    if (entryError) throw entryError;

    const domainEntries: TimetableEntry[] = createdEntries.map((row) => ({
      id: row.id,
      timetableId: row.timetable_id,
      dayOfWeek: row.day_of_week,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
      subjectName: row.subject_name,
      subjectCode: row.subject_code,
      sessionType: row.session_type,
      batch: row.batch,
      groupName: row.group_name,
      isActive: row.is_active,
    }));
    const sessions = generateSessions({ userId: user.id, academicStartDate: startDate, academicEndDate: endDate, entries: domainEntries });
    await supabase.from("sessions").insert(sessions.map((session) => ({
      user_id: session.userId,
      timetable_entry_id: session.timetableEntryId,
      session_date: session.sessionDate,
      start_time: session.startTime,
      end_time: session.endTime,
      subject_name: session.subjectName,
      subject_code: session.subjectCode,
      session_type: session.sessionType,
      batch: session.batch,
      group_name: session.groupName,
      status: session.status,
      is_exception: session.isException,
    })));
    router.replace("/(tabs)");
  }

  return (
    <Screen>
      <Title>Review timetable</Title>
      <Card>
        <TextInput placeholder="Academic start date YYYY-MM-DD" value={startDate} onChangeText={setStartDate} />
        <TextInput placeholder="Academic end date YYYY-MM-DD" value={endDate} onChangeText={setEndDate} />
      </Card>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card>
            {item.needsReview ? <Text style={{ color: "#B45309", fontWeight: "700" }}>Needs review</Text> : null}
            <View style={{ gap: 8 }}>
              <TextInput placeholder="Day" value={item.day} onChangeText={(day) => update(item.id, { day })} />
              <TextInput placeholder="Start time" value={item.startTime} onChangeText={(startTime) => update(item.id, { startTime })} />
              <TextInput placeholder="End time" value={item.endTime} onChangeText={(endTime) => update(item.id, { endTime })} />
              <TextInput placeholder="Subject" value={item.subjectName} onChangeText={(subjectName) => update(item.id, { subjectName })} />
              <TextInput placeholder="Type" value={item.sessionType} onChangeText={(sessionType) => update(item.id, { sessionType })} />
              <Button tone="neutral" onPress={() => update(item.id, { active: !item.active })}>{item.active ? "Active" : "Inactive"}</Button>
            </View>
          </Card>
        )}
      />
      <Button onPress={() => setEntries((current) => [...current, { id: String(Date.now()), day: "Monday", startTime: "09:00", endTime: "10:00", subjectName: "", sessionType: "Lecture", needsReview: true, active: true }])}>Add session</Button>
      <Button onPress={confirm}>Confirm and generate sessions</Button>
    </Screen>
  );
}
