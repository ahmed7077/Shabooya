import { router } from "expo-router";
import { useState } from "react";
import { Alert, TextInput } from "react-native";
import { Button, Card, Screen, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  async function signup() {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (error) return Alert.alert("Sign up failed", error.message);
    if (data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, email, name });
      router.replace("/onboarding/profile");
    }
  }

  return (
    <Screen>
      <Title>Create your tracker</Title>
      <Card>
        <TextInput placeholder="Name" value={name} onChangeText={setName} />
        <TextInput placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Button onPress={signup}>Create account</Button>
      </Card>
    </Screen>
  );
}
