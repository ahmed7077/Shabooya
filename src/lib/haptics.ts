export type HapticKind = 'selection' | 'success' | 'warning';

export function haptic(kind: HapticKind = 'selection') {
  if (
    typeof navigator === 'undefined' ||
    typeof window === 'undefined' ||
    typeof navigator.vibrate !== 'function' ||
    !window.matchMedia('(pointer: coarse)').matches
  )
    return;
  try {
    navigator.vibrate(
      kind === 'success' ? [10, 24, 14] : kind === 'warning' ? 18 : 8,
    );
  } catch {
    // Haptics are progressive enhancement and must never block an action.
  }
}
