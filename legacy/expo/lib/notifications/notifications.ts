import * as Notifications from "expo-notifications";

export async function registerForNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return null;
  return Notifications.getExpoPushTokenAsync();
}

export async function scheduleAttendanceReminder(title: string, body: string, date: Date) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: date as unknown as Notifications.NotificationTriggerInput,
  });
}
