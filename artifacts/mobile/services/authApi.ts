import axios from "axios";


const api = axios.create({
  baseURL: "http://13.125.10.228/",
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
export const saveSleepApi = (data: {
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
}) => api.post("/sleepinfo", data);
