/** Trailing debounce — waits until burst stops, then fires once. */
export function debounceTrailing<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number
): (...args: TArgs) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: TArgs) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Leading debounce — fires immediately on the first call,
 * then ignores subsequent calls for `ms` milliseconds.
 * Ideal for realtime events where instant feedback matters (e.g. new message arrived).
 */
export function debounceLeading<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number
): (...args: TArgs) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  let ready = true;
  return (...args: TArgs) => {
    if (ready) {
      ready = false;
      fn(...args);
    }
    clearTimeout(t);
    t = setTimeout(() => { ready = true; }, ms);
  };
}

/**
 * Throttle — fires at most once every `ms` milliseconds.
 * Useful for presence heartbeats and typing indicators.
 */
export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number
): (...args: TArgs) => void {
  let last = 0;
  return (...args: TArgs) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}
