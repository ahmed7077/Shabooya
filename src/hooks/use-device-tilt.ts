'use client';

import { useEffect, type RefObject } from 'react';
import {
  orientationParallax,
  pointerParallax,
  smoothParallax,
} from '@/lib/navigation-motion';

type PermissionAwareOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export function useResponsiveParallax(
  target: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    const node = target.current;
    if (
      !enabled ||
      !node ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;

    const mobile = matchMedia(
      '(max-width: 850px) and (pointer: coarse)',
    ).matches;
    const desktop = matchMedia(
      '(min-width: 851px) and (hover: hover) and (pointer: fine)',
    ).matches;
    if (!mobile && !desktop) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    const render = () => {
      const easing = mobile ? 0.095 : 0.075;
      currentX = smoothParallax(currentX, targetX, easing);
      currentY = smoothParallax(currentY, targetY, easing);
      node.style.setProperty('--parallax-bg-x', `${currentX.toFixed(2)}px`);
      node.style.setProperty('--parallax-bg-y', `${currentY.toFixed(2)}px`);
      node.style.setProperty(
        '--parallax-card-x',
        `${(-currentX * 0.17).toFixed(2)}px`,
      );
      node.style.setProperty(
        '--parallax-card-y',
        `${(-currentY * 0.17).toFixed(2)}px`,
      );
      node.style.setProperty(
        '--parallax-light-x',
        `${(50 - currentX * 0.75).toFixed(2)}%`,
      );
      node.style.setProperty(
        '--parallax-light-y',
        `${(50 - currentY * 0.75).toFixed(2)}%`,
      );
      frame = requestAnimationFrame(render);
    };
    const onOrientation = (event: DeviceOrientationEvent) => {
      const next = orientationParallax(event.gamma, event.beta);
      targetX = next.x;
      targetY = next.y;
    };
    const onPointerMove = (event: PointerEvent) => {
      const next = pointerParallax(
        event.clientX,
        event.clientY,
        innerWidth,
        innerHeight,
      );
      targetX = next.x;
      targetY = next.y;
    };
    const settle = () => {
      targetX = 0;
      targetY = 0;
    };
    if (mobile && typeof DeviceOrientationEvent !== 'undefined') {
      const orientation = DeviceOrientationEvent as PermissionAwareOrientation;
      // iOS requires a user-triggered prompt. Decorative motion stays disabled
      // instead of interrupting the core experience.
      if (typeof orientation.requestPermission !== 'function')
        window.addEventListener('deviceorientation', onOrientation, {
          passive: true,
        });
    } else if (desktop) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.addEventListener('mouseleave', settle);
      window.addEventListener('blur', settle);
    }
    frame = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('mouseleave', settle);
      window.removeEventListener('blur', settle);
      cancelAnimationFrame(frame);
      for (const property of [
        '--parallax-bg-x',
        '--parallax-bg-y',
        '--parallax-card-x',
        '--parallax-card-y',
        '--parallax-light-x',
        '--parallax-light-y',
      ])
        node.style.removeProperty(property);
    };
  }, [enabled, target]);
}
