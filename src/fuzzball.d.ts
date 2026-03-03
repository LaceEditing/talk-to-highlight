declare module 'fuzzball' {
  /** Levenshtein-based similarity ratio, returns 0–100 */
  export function ratio(s1: string, s2: string): number
  export function partial_ratio(s1: string, s2: string): number
  export function token_sort_ratio(s1: string, s2: string): number
  export function WRatio(s1: string, s2: string): number
}
