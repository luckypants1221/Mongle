import { parseSnoringProbability, probabilityQuery } from "../lib/snoringProbability";
import { toSurveyPayload, type PreSleepSurveyAnswers } from "../lib/preSleepSurvey";
import axios from "axios";


const api = axios.create({
  baseURL: "http://13.125.10.228",
  timeout: 10000,
});

//로그안
export const loginApi = (
  email: string,
  pwd: string
) => api.post("/login", { name: "", email, pwd });
//회원가입
export const signupApi = (
  name: string,
  pwd: string,
  email: string
) => {
  console.log("회원가입 요청", {
    name,
    email,
    pwd,
  });

  return api.post("/signup", {
    name,
    email,
    pwd,
  });
};

//수면 기록
export const sleepinfoApi = (
  id: string | number
) =>
  api.get("/sleepinfo", {
    params: { id }
  });


//비밀번호 변경
export const changePasswordApi = (
  id: string,
  pwd: string,
  new_pwd: string
) =>
  api.post("/changepw", { id, pwd, new_pwd });

//회원탈퇴
export const deleteApi = (
  id: string,
  pwd: string
) =>
  api.post(`/delete`, { id, pwd });

//회원정보 조회
export const profileApi = (
  id: string
) => api.get(`/profile?user_id=${id}`);

//회원정보 수정
export const updateProfileApi = (
  id: string,
  name: string,
  email: string
) => api.put(`/profile?user_id=${id}`, { name, email });

// 수면 기록 저장 (엔드포인트와 필드명은 서버 /docs에서 확인해서 맞추세요)
export interface SleepInfoPayload {
  id: number;
  sleep_score: number;
  start_sleep: string;   // ISO 문자열
  end_sleep: string;     // ISO 문자열
  temp_avg: number;
  hum_avg: number;
  audio_path: string;
  duration: number;
  snoring_count: number;
  memo: string;
}

export const saveSleepApi = (data: SleepInfoPayload) => api.post("/sleepinfo", data);

export const updateSleepApi = (recordId: number, data: SleepInfoPayload) =>
  api.put("/sleepinfo", data, { params: { record_id: recordId } });



api.interceptors.request.use((config) => {
  console.log("[REQ]", config.method?.toUpperCase(), (config.baseURL ?? "") + (config.url ?? ""), JSON.stringify(config.data));
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.config.url === "/analysis/survey") {
      console.log("[SURVEY SAVED]", res.status, JSON.stringify(res.data));
    }
    return res;
  },
  (err) => {
    console.log("[ERR]", err.config?.url, err.message, err.response?.status);
    if (err.config?.url?.startsWith("/analysis/probability")) {
      console.log("[PROBABILITY ERROR]", JSON.stringify(err.response?.data));
    }
    if (err.config?.url === "/analysis/survey") {
      console.log("[SURVEY SAVE ERROR]", err.response?.status, JSON.stringify(err.response?.data));
    }
    return Promise.reject(err);
  }
);

export const saveSurveyApi = (userId: string | number, answers: PreSleepSurveyAnswers) =>
  api.post("/analysis/survey", toSurveyPayload(userId, answers));

export async function getSnoringProbabilityApi(userId: string | number, sleepScore?: number | null, signal?: AbortSignal) {
  const params = probabilityQuery(userId, sleepScore);
  const query = new URLSearchParams({ id: String(params.id) });
  if (params.sleep_score !== undefined) query.set("sleep_score", String(params.sleep_score));
  const response = await api.get(`/analysis/probability?${query.toString()}`, { signal });
  const probability = parseSnoringProbability(response.data);
  if (probability === null) throw new Error("코골이 확률 데이터가 없거나 응답 형식이 올바르지 않습니다.");
  return probability;
}
