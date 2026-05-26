/** Trailing debounce for realtime bursts (fewer refetches, less UI jank). */

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
