import { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/components/ThemeProvider";

export function Screen({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.screen, { backgroundColor: theme.background }]}>{children}</View>;
}

export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}

export function Title({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.title, { color: theme.text }]}>{children}</Text>;
}

export function Body({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.body, { color: theme.muted }]}>{children}</Text>;
}

export function Button({
  children,
  onPress,
  tone = "primary",
  loading,
}: PropsWithChildren<{ onPress?: () => void; tone?: "primary" | "danger" | "neutral"; loading?: boolean }>) {
  const theme = useTheme();
  const backgroundColor = tone === "danger" ? theme.danger : tone === "neutral" ? theme.surface : theme.primary;
  const color = tone === "neutral" ? theme.text : "#FFFFFF";
  return (
    <Pressable onPress={onPress} style={[styles.button, { backgroundColor, borderColor: theme.border }]}>
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.buttonText, { color }]}>{children}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, gap: 16 },
  card: { borderWidth: 1, borderRadius: 8, padding: 16, gap: 10 },
  title: { fontSize: 28, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 22 },
  button: { minHeight: 48, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: "700" },
});
