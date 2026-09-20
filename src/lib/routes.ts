export const screens = [
  'login',
  'signup',
  'forgot-password',
  'reset-password',
  'onboarding',
  'home',
  'timetable',
  'attendance',
  'calendar',
  'profile',
  'pending',
  'subject',
  'timetable-editor',
];
export function tabFromLocation() {
  const path = location.pathname.slice(1);
  if (path === 'subject')
    return `Subject:${new URLSearchParams(location.search).get('name') || ''}`;
  return (
    ['Home', 'Timetable', 'Attendance', 'Calendar', 'Profile', 'Pending'].find(
      (tab) => tab.toLowerCase() === path,
    ) || 'Home'
  );
}
export function tabPath(tab: string) {
  return tab.startsWith('Subject:')
    ? `/subject?name=${encodeURIComponent(tab.slice(8))}`
    : `/${tab.toLowerCase()}`;
}
