import axios from "axios";


const api= axios.create({
  baseURL: "http://13.125.10.228/",
});

//로그안
export const loginApi =( 
    email: string,
    pwd: string) => api.post("/login", { email, pwd });
//회원가입
export const signupApi = (name: string, email: string, pwd: string) => api.post("/signup", { name, email, pwd });

//수면 기록
export  const sleepinfoApi = (id: string) => api.get(`/sleepinfo?id=${id}`);

//비밀번호 변경
export const changePasswordApi = (id: string, pwd: string, new_pwd: string) =>
  api.post("/changepw", { id, pwd, new_pwd });

//회원탈퇴
export const deleteApi = (id: string,pwd: string) => api.post(`/delete`,{ id, pwd});

//회원정보 조회
export const profileApi = (id: string) => api.get(`/profile?user_id=${id}`);

//회원정보 수정
export const updateProfileApi = (id: string, name: string, email: string) => api.put(`/profile?user_id=${id}`, { name, email });