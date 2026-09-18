import { FlatList, Text, View } from "react-native";
import { Link } from "expo-router";
import { calculateAttendance } from "@/lib/attendance/calculator";
import { currentDateLabel } from "@/lib/timezone";
import { useAllSessions, useSessions } from "@/lib/data/attendanceQueries";
import { Body, Button, Card, Screen, Title } from "@/components/ui";

export default function HomeScreen() {
  const today = useSessions();
  const all = useAllSessions();
  const summary = calculateAttendance(all.data ?? []);
  const markedToday = (today.data ?? []).filter((session) => session.attendanceStatus).length;

  return (
    <Screen>
      <Title>Today</Title>
      <Body>{currentDateLabel()}</Body>
      <Card>
        <Text>{today.data?.length ?? 0} classes</Text>
        <Text>{markedToday} marked</Text>
        <Text>{Math.max(0, (today.data?.length ?? 0) - markedToday)} pending</Text>
      </Card>
      <Card>
        <Text style={{ fontSize: 34, fontWeight: "800" }}>{summary.percentage === null ? "No data" : `${summary.percentage.toFixed(1)}%`}</Text>
        <Body>{summary.present} present · {summary.absent} absent · {summary.conducted} counted</Body>
        <Link href="/calculator">Open calculator</Link>
      </Card>
      <FlatList
        data={today.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card>
            <Text>{item.startTime} - {item.endTime}</Text>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{item.subjectName}</Text>
            <Body>{item.sessionType} · {item.attendanceStatus ?? "Pending"}</Body>
          </Card>
        )}
      />
      <Link href="/timetable-import" asChild><Button>Import timetable</Button></Link>
    </Screen>
  );
}
