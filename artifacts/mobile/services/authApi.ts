import axios from "axios";


const api = axios.create({
  baseURL: "http://13.125.10.228/",
});

//로그안
export const loginApi = (
  email: string,
  pwd: string
) => api.post("/login", { name: "test", email, pwd });
//회원가입
export const signupApi = (
  name: string,
  email: string,
  pwd: string,
) => {
  return api.post("/signup", {
    name,
    email,
    pwd,
  });
};

//수면 기록
export const sleepinfoApi = (
  id: string
) =>
  api.get(`/sleepinfo?id=${id}`);

//비밀번호 변경
export const changePasswordApi = (
  email: string,
  pwd: string,
  new_pwd: string
) =>
  api.post("/changepw", { email, pwd, new_pwd });

//회원탈퇴
export const deleteApi = (
  id: string,
  pwd: string
) =>
  api.post(`/delete`, { id, pwd });

//회원정보 조회
export const profileApi = (
  id: string
) => api.get(`/profile/${id}`);

//회원정보 수정
export const updateProfileApi = (
  id: string,
  name: string,
  email: string
) => api.put(`/profile/${id}`, { user_id: Number(id), name, email });

// 수면 기록 조회
export const getSleepInfoApi = (
  id: string
) =>
  api.get(`/sleepinfo?id=${id}`);

// 수면 기록 저장
export const createSleepInfoApi = (
  data: {
    id: number;
    sleep_score: number;
    start_sleep: string;
    end_sleep: string;
    temp_avg: number;
    hum_avg: number;
    audio_path: string;
    duration: number;
    snoring_count: number;
    memo: string;
  }
) =>
  api.post("/sleepinfo", data);
