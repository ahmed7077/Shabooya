export const PRIMARY_TABS = [
  'Home',
  'Timetable',
  'Attendance',
  'Calendar',
  'Profile',
] as const;

export type PrimaryTab = (typeof PRIMARY_TABS)[number];
export type MotionDirection = 'forward' | 'backward';

export const PRIMARY_TAB_INDEX: Record<PrimaryTab, number> = {
  Home: 0,
  Timetable: 1,
  Attendance: 2,
  Calendar: 3,
  Profile: 4,
};

export function primaryTabFor(value: string): PrimaryTab {
  if (value.startsWith('Subject:') || value === 'Pending') return 'Attendance';
  return PRIMARY_TABS.includes(value as PrimaryTab)
    ? (value as PrimaryTab)
    : 'Home';
}

export function navigationDirection(from: string, to: string): MotionDirection {
  return PRIMARY_TAB_INDEX[primaryTabFor(to)] >=
    PRIMARY_TAB_INDEX[primaryTabFor(from)]
    ? 'forward'
    : 'backward';
}

export function clampTilt(value: number, limit = 8) {
  return Math.max(-limit, Math.min(limit, value));
}

export function pointerParallax(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
  limit = 18,
) {
  const x = (clientX / Math.max(1, width) - 0.5) * 2;
  const y = (clientY / Math.max(1, height) - 0.5) * 2;
  const offsetX = clampTilt(-x * limit, limit);
  const offsetY = clampTilt(-y * limit, limit);
  return {
    x: Object.is(offsetX, -0) ? 0 : offsetX,
    y: Object.is(offsetY, -0) ? 0 : offsetY,
  };
}

export function orientationParallax(
  gamma: number | null,
  beta: number | null,
  limit = 18,
) {
  const stableGamma = Math.abs(gamma || 0) < 0.6 ? 0 : gamma || 0;
  const stableBeta = Math.abs(beta || 0) < 0.8 ? 0 : beta || 0;
  const offsetX = clampTilt(stableGamma * -0.62, limit);
  const offsetY = clampTilt(stableBeta * -0.36, limit);
  return {
    x: Object.is(offsetX, -0) ? 0 : offsetX,
    y: Object.is(offsetY, -0) ? 0 : offsetY,
  };
}

export function smoothParallax(
  current: number,
  target: number,
  easing: number,
) {
  return current + (target - current) * easing;
}

export type SwipeIntent = 'horizontal' | 'vertical' | 'pending';

export function swipeIntent(dx: number, dy: number): SwipeIntent {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return 'pending';
  return Math.abs(dx) > Math.abs(dy) * 1.15 ? 'horizontal' : 'vertical';
}

export function swipeAction(
  dx: number,
  threshold = 72,
): 'present' | 'absent' | null {
  if (Math.abs(dx) < threshold) return null;
  return dx > 0 ? 'present' : 'absent';
}

export function daySwipeDelta(dx: number, threshold = 60): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold) return 0;
  return dx < 0 ? 1 : -1;
}
