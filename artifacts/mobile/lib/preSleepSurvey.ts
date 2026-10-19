export const SURVEY_LEVELS = [1, 2, 3, 4, 5] as const;
export type SurveyLevel = typeof SURVEY_LEVELS[number];

export interface PreSleepSurveyAnswers {
  drankAlcohol: SurveyLevel;
  exercised: SurveyLevel;
  nasalCongestion: SurveyLevel;
  sleepsOnBack: SurveyLevel;
}

export interface PreSleepSurvey extends PreSleepSurveyAnswers {
  answeredAt: string;
  previousSleepDate: string;
  previousSleepScore: number | null;
}

export const PRE_SLEEP_QUESTIONS = [
  { key: "drankAlcohol", title: "오늘 술을 얼마나 마셨나요?", description: "1단계: 전혀 마시지 않음 · 5단계: 많이 마심" },
  { key: "exercised", title: "오늘 가벼운 운동을 얼마나 했나요?", description: "1단계: 전혀 하지 않음 · 5단계: 많이 함" },
  { key: "nasalCongestion", title: "지금 코가 얼마나 막혀 있나요?", description: "1단계: 전혀 막히지 않음 · 5단계: 매우 심하게 막힘" },
  { key: "sleepsOnBack", title: "얼마나 자주 똑바로 누워 자나요?", description: "1단계: 전혀 그렇지 않음 · 5단계: 항상 그럼" },
] as const;

export function isSurveyLevel(value: unknown): value is SurveyLevel {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isSurveyComplete(answers: Partial<PreSleepSurveyAnswers>): answers is PreSleepSurveyAnswers {
  return PRE_SLEEP_QUESTIONS.every(({ key }) => isSurveyLevel(answers[key]));
}

export function toSurveyPayload(userId: string | number, answers: PreSleepSurveyAnswers) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("로그인 정보를 확인해주세요.");
  if (!isSurveyComplete(answers)) throw new Error("4개 질문에 1~5단계로 답해주세요.");
  return {
    id,
    drank_alcohol: answers.drankAlcohol,
    light_exercise: answers.exercised,
    nasal_congestion: answers.nasalCongestion,
    sleeps_supine: answers.sleepsOnBack,
  };
}
