import { router } from "expo-router";
import { useState } from "react";
import { TextInput } from "react-native";
import { Button, Card, Screen, Title } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";

export default function OnboardingProfileScreen() {
  const { user } = useAuth();
  const [university, setUniversity] = useState("KBN University");
  const [course, setCourse] = useState("MBBS Phase II");
  const [semester, setSemester] = useState("");
  const [studentId, setStudentId] = useState("");

  async function save() {
    if (user) await supabase.from("profiles").update({ university, course, semester, student_id: studentId }).eq("id", user.id);
    router.replace("/timetable-import");
  }

  return (
    <Screen>
      <Title>Academic profile</Title>
      <Card>
        <TextInput placeholder="University / college" value={university} onChangeText={setUniversity} />
        <TextInput placeholder="Course" value={course} onChangeText={setCourse} />
        <TextInput placeholder="Semester / year" value={semester} onChangeText={setSemester} />
        <TextInput placeholder="Student ID (optional)" value={studentId} onChangeText={setStudentId} />
        <Button onPress={save}>Continue</Button>
      </Card>
    </Screen>
  );
}
