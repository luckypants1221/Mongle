/** The endpoint returns a percentage (1–100), not a 0–1 fraction. */
export function parseSnoringProbability(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 1 && value <= 100 ? value : null;
  if (typeof value === "string" && /^\d+(\.\d+)?%?$/.test(value.trim())) {
    return parseSnoringProbability(Number(value.trim().replace(/%$/, "")));
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["snoring_probability", "snoring_probability_percent", "probability_percent", "probability", "snore_probability", "data", "result"]) {
    if (record[key] !== undefined) {
      const parsed = parseSnoringProbability(record[key]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

export function probabilityQuery(userId: string | number, score?: number | null) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("사용자 ID를 확인해주세요.");
  return {
    id,
    ...(typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100
      ? { sleep_score: Math.round(score) } : {}),
  };
}

export function isTrainingDataInsufficient(error: unknown): boolean {
  const detail = (error as { response?: { status?: number; data?: { detail?: { training_samples?: unknown; required_samples?: unknown } } } } | null)?.response;
  const data = detail?.data?.detail;
  return detail?.status === 422 && typeof data?.training_samples === "number" && typeof data?.required_samples === "number" && data.training_samples < data.required_samples;
}
