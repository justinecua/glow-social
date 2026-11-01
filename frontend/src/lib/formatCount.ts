/**
 * Short counts for likes/comments/etc.
 *   999 → "999", 1000 → "1k", 1250 → "1.2k", 1999 → "1.9k",
 *   15000 → "15k", 999999 → "999.9k", 1_200_000 → "1.2M", 2_500_000_000 → "2.5B"
 * Rounds down (never overstates), drops a trailing ".0".
 */
export function formatCount(value: number | string | null | undefined): string {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  if (n < 1000) return String(n);

  const units: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) {
      // One decimal, rounded down (so 999,999 is "999.9k", never "1000k")
      const short = Math.floor((n / size) * 10) / 10;
      return `${short}`.replace(/\.0$/, "") + suffix;
    }
  }
  return String(n);
}
