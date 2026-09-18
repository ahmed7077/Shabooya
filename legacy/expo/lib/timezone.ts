export const DEFAULT_TIMEZONE = process.env.EXPO_PUBLIC_DEFAULT_TIMEZONE ?? "Asia/Kolkata";

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentDateLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: DEFAULT_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(now);
}
