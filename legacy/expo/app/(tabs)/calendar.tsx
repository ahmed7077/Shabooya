import { addDays, formatISO, startOfMonth } from "date-fns";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Body, Card, Screen, Title } from "@/components/ui";
import { useAllSessions } from "@/lib/data/attendanceQueries";
import { todayISO } from "@/lib/timezone";

export default function CalendarScreen() {
  const [selected, setSelected] = useState(todayISO());
  const sessions = useAllSessions();
  const monthDays = useMemo(() => {
    const start = startOfMonth(new Date());
    return Array.from({ length: 35 }, (_, index) => formatISO(addDays(start, index), { representation: "date" }));
  }, []);
  const selectedSessions = (sessions.data ?? []).filter((session) => session.sessionDate === selected);

  return (
    <Screen>
      <Title>Calendar</Title>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {monthDays.map((date) => {
          const count = (sessions.data ?? []).filter((session) => session.sessionDate === date).length;
          return (
            <Pressable key={date} onPress={() => setSelected(date)} style={{ width: "13%", padding: 8, borderRadius: 8, backgroundColor: date === selected ? "#0F766E" : "#E2E8F0" }}>
              <Text style={{ textAlign: "center", color: date === selected ? "#FFF" : "#0F172A" }}>{Number(date.slice(-2))}</Text>
              <Text style={{ textAlign: "center", color: date === selected ? "#FFF" : "#64748B" }}>{count || ""}</Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={selectedSessions}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Body>No classes for this date.</Body>}
        renderItem={({ item }) => (
          <Card>
            <Text>{item.startTime} - {item.endTime}</Text>
            <Text style={{ fontWeight: "700" }}>{item.subjectName}</Text>
            <Body>{item.status === "cancelled" ? "Cancelled" : item.attendanceStatus ?? "Pending"}</Body>
          </Card>
        )}
      />
    </Screen>
  );
}
