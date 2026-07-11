/** Arithmetic mean; returns 0 for empty arrays. */
export function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

/** Arithmetic mean; returns null for empty arrays. */
export function avgOrNull(arr: number[]): number | null {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null
}
