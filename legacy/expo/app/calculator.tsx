import { useMemo, useState } from "react";
import { Text, TextInput } from "react-native";
import { calculateAttendance, calculateMissableClasses, calculateProjectedAttendance, calculateRecoveryClasses } from "@/lib/attendance/calculator";
import { useAllSessions } from "@/lib/data/attendanceQueries";
import { Body, Card, Screen, Title } from "@/components/ui";

export default function CalculatorScreen() {
  const sessions = useAllSessions();
  const [target, setTarget] = useState("75");
  const summary = useMemo(() => calculateAttendance(sessions.data ?? []), [sessions.data]);
  const targetNumber = Number(target) || 75;
  const missable = calculateMissableClasses(summary.present, summary.absent, targetNumber);
  const recovery = calculateRecoveryClasses(summary.present, summary.absent, targetNumber);
  const attendFive = calculateProjectedAttendance(summary.present, summary.absent, 5, 0);
  const missOne = calculateProjectedAttendance(summary.present, summary.absent, 0, 1);

  return (
    <Screen>
      <Title>Calculator</Title>
      <Card>
        <TextInput keyboardType="numeric" value={target} onChangeText={setTarget} placeholder="Target percentage" />
        <Text style={{ fontSize: 30, fontWeight: "800" }}>{summary.percentage === null ? "No marked classes" : `${summary.percentage.toFixed(1)}%`}</Text>
        <Body>{summary.present} present, {summary.absent} absent</Body>
      </Card>
      <Card>
        <Text>Can miss: {Number.isFinite(missable) ? missable : "unlimited"} classes</Text>
        <Text>Need to attend: {Number.isFinite(recovery) ? recovery : "not mathematically possible"} consecutive classes</Text>
        <Text>After attending 5: {attendFive.percentage?.toFixed(1) ?? "No data"}%</Text>
        <Text>After missing 1: {missOne.percentage?.toFixed(1) ?? "No data"}%</Text>
      </Card>
    </Screen>
  );
}
