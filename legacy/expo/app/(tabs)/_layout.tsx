import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const icons = {
  index: "home-outline",
  timetable: "calendar-outline",
  attendance: "checkmark-done-outline",
  calendar: "grid-outline",
  profile: "person-outline",
} as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#0F766E",
        tabBarInactiveTintColor: "#64748B",
        tabBarStyle: { height: 64, paddingBottom: 10, paddingTop: 8 },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name as keyof typeof icons]} color={color} size={size} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="timetable" options={{ title: "Timetable" }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
