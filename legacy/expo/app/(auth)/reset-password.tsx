import { useState } from "react";
import { Alert, TextInput } from "react-native";
import { Button, Card, Screen, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState("");

  async function reset() {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    Alert.alert(error ? "Unable to send reset" : "Check your email", error?.message ?? "Password reset instructions were sent.");
  }

  return (
    <Screen>
      <Title>Reset password</Title>
      <Card>
        <TextInput placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <Button onPress={reset}>Send reset link</Button>
      </Card>
    </Screen>
  );
}
