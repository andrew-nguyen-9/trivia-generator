// Tiny haptics wrapper. navigator.vibrate is a no-op on desktop and unsupported
// browsers, so callers never need to feature-detect.

export function buzz(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // some browsers throw if called without a user gesture — ignore
    }
  }
}

export const haptic = {
  tap: () => buzz(10),
  correct: () => buzz(20),
  wrong: () => buzz([40, 30, 40]),
  win: () => buzz([20, 40, 20, 40, 60]),
};
