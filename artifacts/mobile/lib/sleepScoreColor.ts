export const SLEEP_SCORE_COLORS = {
  good: "#AED581",
  average: "#FFE082",
  low: "#EF5350",
} as const;

export function sleepScoreColor(score: number): string {
  if (score >= 80) return SLEEP_SCORE_COLORS.good;
  if (score >= 60) return SLEEP_SCORE_COLORS.average;
  return SLEEP_SCORE_COLORS.low;
}
