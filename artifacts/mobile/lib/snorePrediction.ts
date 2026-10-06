export type SnoreAnswers = {
  alcohol: boolean;
  exercise: boolean;
  congestion: boolean;
  backSleeping: boolean;
};

export const SNORE_QUESTIONS: { key: keyof SnoreAnswers; label: string; detail: string }[] = [
  { key: "alcohol", label: "오늘 술을 마셨나요?", detail: "취침 전 음주를 포함해 답해주세요." },
  { key: "exercise", label: "오늘 가벼운 운동을 했나요?", detail: "걷기나 운동 등 몸을 움직인 활동이 있었나요?" },
  { key: "congestion", label: "지금 코가 막혀 있나요?", detail: "감기나 비염 등으로 코로 숨쉬기 불편한가요?" },
  { key: "backSleeping", label: "주로 똑바로 누워 자나요?", detail: "옆으로 눕기보다 등을 대고 자는 편인가요?" },
];

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function previousDateKey(date: Date) {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  return localDateKey(yesterday);
}

export function isCompleteSurvey(answers: Partial<SnoreAnswers>): answers is SnoreAnswers {
  return SNORE_QUESTIONS.every(({ key }) => typeof answers[key] === "boolean");
}

export function validSleepScore(score: unknown): number | null {
  return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
}

export function parseSleepScore(score: unknown): number | null {
  if (typeof score !== "number" && typeof score !== "string") return null;
  if (typeof score === "string" && !score.trim()) return null;
  return validSleepScore(Number(score));
}

// Product prototype only: these weights are design choices, not fitted or
// clinically validated probabilities. A sleep score is contextual input, not
// evidence that a person snores. Missing scores contribute nothing.
export function estimateSnoring(answers: Partial<SnoreAnswers>, previousScore?: number | null) {
  if (!isCompleteSurvey(answers)) return null;
  const score = validSleepScore(previousScore);
  const factors: string[] = [];
  let percentage = 20;
  if (answers.alcohol) { percentage += 25; factors.push("음주"); }
  if (answers.congestion) { percentage += 20; factors.push("코막힘"); }
  if (answers.backSleeping) { percentage += 15; factors.push("똑바로 눕는 자세"); }
  if (answers.exercise) percentage -= 5;
  if (score !== null) {
    percentage += Math.round((70 - score) * 0.2);
    if (score < 70) factors.push("낮은 전날 수면점수");
  }
  percentage = Math.max(5, Math.min(95, percentage));
  return {
    percentage,
    level: percentage < 35 ? "낮음" : percentage < 65 ? "보통" : "높음",
    color: percentage < 35 ? "#80CBC4" : percentage < 65 ? "#FFE082" : "#F48FB1",
    previousScore: score,
    factors,
  };
}
