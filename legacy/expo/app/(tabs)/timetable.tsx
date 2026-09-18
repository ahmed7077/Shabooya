import { useQuery } from "@tanstack/react-query";
import { FlatList, Text } from "react-native";
import { Body, Card, Screen, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TimetableScreen() {
  const entries = useQuery({
    queryKey: ["timetable_entries", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("active_timetable_entries")
        .select("*")
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Screen>
      <Title>Weekly timetable</Title>
      <FlatList
        data={entries.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card>
            <Body>{days[item.day_of_week]}</Body>
            <Text style={{ fontSize: 17, fontWeight: "700" }}>{item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)} · {item.subject_name}</Text>
            <Body>{item.session_type}{item.batch ? ` · Batch ${item.batch}` : ""}{item.group_name ? ` · ${item.group_name}` : ""}</Body>
          </Card>
        )}
      />
    </Screen>
  );
}
