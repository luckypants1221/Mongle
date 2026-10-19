export interface PreSleepSurveyAnswers {
  drankAlcohol: boolean;
  exercised: boolean;
  nasalCongestion: boolean;
  sleepsOnBack: boolean;
}

export interface PreSleepSurvey extends PreSleepSurveyAnswers {
  answeredAt: string;
  previousSleepDate: string;
  previousSleepScore: number | null;
}

export const PRE_SLEEP_QUESTIONS = [
  { key: "drankAlcohol", title: "오늘 술을 마셨나요?", description: "취침 전 음주를 포함해 답해주세요." },
  { key: "exercised", title: "오늘 가벼운 운동을 했나요?", description: "걷기나 운동 등 몸을 움직인 활동이 있었나요?" },
  { key: "nasalCongestion", title: "지금 코가 막혀 있나요?", description: "감기나 비염 등으로 코로 숨쉬기 불편한가요?" },
  { key: "sleepsOnBack", title: "주로 똑바로 누워 자나요?", description: "옆으로 눕기보다 등을 대고 자는 편인가요?" },
] as const;

export function isSurveyComplete(answers: Partial<PreSleepSurveyAnswers>): answers is PreSleepSurveyAnswers {
  return PRE_SLEEP_QUESTIONS.every(({ key }) => typeof answers[key] === "boolean");
}
