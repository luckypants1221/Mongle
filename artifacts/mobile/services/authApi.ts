import axios from "axios";


const api= axios.create({
  baseURL: "http://13.125.10.228/",
});

//로그안
export const loginApi =( 
    email: string,
    password: string) => api.post("/login", { email, password });
//회원가입
export const registerApi = ({ name, email, password }: { name: string; email: string; password: string }) => api.post("/signup", { name, email, password });

//수면 기록
export  const sleepinfoApi = (id: string) => api.get(`/sleepinfo?id=${id}`);

//비밀번호 변경
export const changePasswordApi = (id: string, currentPassword: string, newPassword: string) =>
  api.post("/changepw", { id, currentPassword, newPassword });
