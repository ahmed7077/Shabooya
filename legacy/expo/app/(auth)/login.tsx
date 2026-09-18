import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, TextInput } from "react-native";
import { Button, Card, Screen, Title } from "@/components/ui";
import { supabase } from "@/lib/supabase/client";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert("Login failed", error.message);
    else router.replace("/(tabs)");
  }

  return (
    <Screen>
      <Title>Welcome back</Title>
      <Card>
        <TextInput placeholder="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <TextInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Button loading={loading} onPress={login}>Log in</Button>
        <Link href="/(auth)/signup">Create an account</Link>
        <Link href="/(auth)/reset-password">Forgot password?</Link>
      </Card>
    </Screen>
  );
}
