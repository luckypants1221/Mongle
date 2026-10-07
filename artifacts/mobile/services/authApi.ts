import axios from "axios";
import { AuthenticatedAccount, requireAccountId } from "@/lib/accountData";


const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL || "http://13.125.10.228/",
  timeout: 8000,
});
const authenticatedAccount = new AuthenticatedAccount();
export const setApiAccount = (id: string | null) => authenticatedAccount.set(id);
export const apiAccountVersion = () => authenticatedAccount.version();
async function accountRequest<T>(id: unknown, request: (account: string) => Promise<T>): Promise<T> {
  const ticket = authenticatedAccount.begin(id);
  const response = await request(ticket.id);
  if (!authenticatedAccount.current(ticket)) throw new Error("계정이 변경되어 이전 응답을 폐기했습니다.");
  return response;
}

//로그안
export const loginApi = (
  email: string,
  pwd: string
) => api.post("/login", { name: "", email: email.trim(), pwd });
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
  accountRequest(id, account => api.get("/sleepinfo", { params: { id: Number(account) } }));

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
) => accountRequest(id, account => api.post("/delete", { id: Number(account), pwd }));

//회원정보 조회
export const profileApi = (
  id: string
) => accountRequest(id, account => api.get(`/profile/${account}`));
// Authentication may verify a login response before binding the account.
export const loginProfileApi = (id: string) => api.get(`/profile/${requireAccountId(id)}`);

//회원정보 수정
export const updateProfileApi = (
  id: string,
  name: string,
  email: string
) => accountRequest(id, account => api.put(`/profile/${account}`, { user_id: Number(account), name, email }));

// 수면 기록 조회
export const getSleepInfoApi = (
  id: string
) =>
  accountRequest(id, account => api.get("/sleepinfo", { params: { id: Number(account) } }));

// 실시간 센서 조회
export const getSensorApi = (
  id: string
) =>
  accountRequest(id, account => api.get("/sensor", { params: { id: Number(account) } }));

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
) => accountRequest(data.id, () => api.post("/sleepinfo", data));
export const updateSleepInfoApi = (data: Parameters<typeof createSleepInfoApi>[0]) => accountRequest(data.id, () => api.put("/sleepinfo", data));
