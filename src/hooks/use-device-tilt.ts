'use client';

import { useEffect, type RefObject } from 'react';
import { clampTilt } from '@/lib/navigation-motion';

type PermissionAwareOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export function useDeviceTilt(
  target: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    const node = target.current;
    if (
      !enabled ||
      !node ||
      typeof DeviceOrientationEvent === 'undefined' ||
      !matchMedia('(max-width: 850px) and (pointer: coarse)').matches ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;

    const orientation = DeviceOrientationEvent as PermissionAwareOrientation;
    // iOS requires a user-triggered permission prompt. Decorative motion is not
    // important enough to interrupt navigation, so it remains disabled there.
    if (typeof orientation.requestPermission === 'function') return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    const render = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      node.style.setProperty('--tilt-x', `${currentX.toFixed(2)}px`);
      node.style.setProperty('--tilt-y', `${currentY.toFixed(2)}px`);
      frame = requestAnimationFrame(render);
    };
    const onOrientation = (event: DeviceOrientationEvent) => {
      targetX = clampTilt((event.gamma || 0) * -0.18, 7);
      targetY = clampTilt((event.beta || 0) * -0.1, 7);
    };
    window.addEventListener('deviceorientation', onOrientation, {
      passive: true,
    });
    frame = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      cancelAnimationFrame(frame);
      node.style.removeProperty('--tilt-x');
      node.style.removeProperty('--tilt-y');
    };
  }, [enabled, target]);
}
