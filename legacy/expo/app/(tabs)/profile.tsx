import { router } from "expo-router";
import { Alert, TextInput } from "react-native";
import { useState } from "react";
import { Button, Card, Screen, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";
import { registerForNotifications } from "@/lib/notifications/notifications";

export default function ProfileScreen() {
  const [target, setTarget] = useState("75");

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  async function deleteAccount() {
    Alert.alert("Delete account?", "This removes your private attendance data. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.rpc("delete_current_user_data");
        await supabase.auth.signOut();
        router.replace("/(auth)/login");
      } },
    ]);
  }

  return (
    <Screen>
      <Title>Profile</Title>
      <Card>
        <TextInput keyboardType="numeric" value={target} onChangeText={setTarget} placeholder="Attendance target %" />
        <Button onPress={async () => {
          const { data } = await supabase.auth.getUser();
          if (data.user) await supabase.from("app_settings").upsert({ user_id: data.user.id, attendance_target: Number(target) });
        }}>Save target</Button>
      </Card>
      <Button tone="neutral" onPress={registerForNotifications}>Enable notifications</Button>
      <Button tone="neutral" onPress={logout}>Logout</Button>
      <Button tone="danger" onPress={deleteAccount}>Delete account</Button>
    </Screen>
  );
}
