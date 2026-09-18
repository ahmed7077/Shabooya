import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, FlatList, Text, View } from "react-native";
import { Button, Card, Screen, Title } from "@/components/ui";
import { markAttendanceWithOfflineQueue } from "@/lib/offline/queue";
import { useAuth } from "@/hooks/useAuth";
import { useSessions } from "@/lib/data/attendanceQueries";

export default function AttendanceScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sessions = useSessions();

  async function mark(sessionId: string, status: "present" | "absent", existing?: string | null) {
    if (!user) return;
    if (existing && existing !== status) {
      const confirmed = await new Promise<boolean>((resolve) =>
        Alert.alert("Change attendance?", "This will update your existing attendance record.", [
          { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
          { text: "Change", onPress: () => resolve(true) },
        ]),
      );
      if (!confirmed) return;
    }
    await markAttendanceWithOfflineQueue({ userId: user.id, sessionId, status, queuedAt: new Date().toISOString() });
    await Haptics.selectionAsync();
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  }

  return (
    <Screen>
      <Title>Attendance</Title>
      <FlatList
        data={sessions.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card>
            <Text>{item.startTime} - {item.endTime}</Text>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{item.subjectName}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button tone={item.attendanceStatus === "present" ? "primary" : "neutral"} onPress={() => mark(item.id, "present", item.attendanceStatus)}>Present</Button>
              <Button tone={item.attendanceStatus === "absent" ? "danger" : "neutral"} onPress={() => mark(item.id, "absent", item.attendanceStatus)}>Absent</Button>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
