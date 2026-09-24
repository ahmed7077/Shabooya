import { describe, expect, it } from 'vitest';
import {
  PRIMARY_TAB_INDEX,
  clampTilt,
  daySwipeDelta,
  navigationDirection,
  orientationParallax,
  pointerParallax,
  primaryTabFor,
  smoothParallax,
  swipeAction,
  swipeIntent,
} from '@/lib/navigation-motion';
import { haptic } from '@/lib/haptics';

describe('canonical navigation motion', () => {
  it('keeps one canonical tab order', () => {
    expect(PRIMARY_TAB_INDEX).toEqual({
      Home: 0,
      Timetable: 1,
      Attendance: 2,
      Calendar: 3,
      Profile: 4,
    });
  });

  it.each([
    ['Home', 'Timetable', 'forward'],
    ['Attendance', 'Profile', 'forward'],
    ['Timetable', 'Home', 'backward'],
    ['Profile', 'Calendar', 'backward'],
    ['Profile', 'Home', 'backward'],
  ])('derives %s → %s as %s', (from, to, expected) => {
    expect(navigationDirection(from, to)).toBe(expected);
  });

  it('maps attendance subroutes to the primary Attendance space', () => {
    expect(primaryTabFor('Pending')).toBe('Attendance');
    expect(primaryTabFor('Subject:Anatomy')).toBe('Attendance');
  });
});

describe('mobile gesture intent', () => {
  it('does not engage for small movement or vertical scrolling', () => {
    expect(swipeIntent(5, 2)).toBe('pending');
    expect(swipeIntent(18, 42)).toBe('vertical');
    expect(swipeAction(55)).toBeNull();
  });

  it('maps deliberate attendance swipes without duplicating mutation logic', () => {
    expect(swipeIntent(80, 12)).toBe('horizontal');
    expect(swipeAction(80)).toBe('present');
    expect(swipeAction(-80)).toBe('absent');
  });

  it('maps day swipes in the opposite content direction', () => {
    expect(daySwipeDelta(-75)).toBe(1);
    expect(daySwipeDelta(75)).toBe(-1);
    expect(daySwipeDelta(30)).toBe(0);
  });
});

describe('progressive enhancements', () => {
  it('clamps device tilt displacement', () => {
    expect(clampTilt(30, 7)).toBe(7);
    expect(clampTilt(-30, 7)).toBe(-7);
    expect(clampTilt(3, 7)).toBe(3);
  });

  it('filters sensor noise and clamps stronger orientation parallax', () => {
    expect(orientationParallax(0.2, 0.4)).toEqual({ x: 0, y: 0 });
    expect(orientationParallax(90, -90)).toEqual({ x: -18, y: 18 });
  });

  it('moves desktop backgrounds opposite the pointer', () => {
    expect(pointerParallax(500, 400, 1000, 800).x).toBeCloseTo(0);
    expect(pointerParallax(500, 400, 1000, 800).y).toBeCloseTo(0);
    expect(pointerParallax(1000, 0, 1000, 800)).toEqual({ x: -18, y: 18 });
  });

  it('interpolates rather than snapping to the parallax target', () => {
    expect(smoothParallax(0, 18, 0.1)).toBeCloseTo(1.8);
  });

  it('does not throw when vibration is unavailable', () => {
    expect(() => haptic('selection')).not.toThrow();
  });
});
