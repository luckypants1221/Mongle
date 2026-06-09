import React, { createContext, useContext, useEffect, useState } from "react";
import { changePasswordApi, loginApi, signupApi } from "@/services/authApi";
// import { *asAccordionPrimitive } from '@radix-ui/react-accordion';

// interface User {
//   id: string;
//   name: string;
//   email: string;
// }
import { type RegisterInput, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, pwd: string) => Promise<boolean>;
  register: (data: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  changePassword: (
    id: string,
    pwd: string,
    new_pwd: string
  ) => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    setIsLoading(false);
  }

  async function login(
    email: string,
    pwd: string
  ): Promise<boolean> {
    try {
      const res = await loginApi(email, pwd);

      console.log("응답 전체");
      console.log(res);

      console.log("응답 데이터");
      console.log(res?.data);

      if (!res?.data) {
        console.log("data 없음");
        return false;
      }

      if (res.data.message !== "login success") {
        return false;
      }

      setUser({
        id: String(res.data.user_id),
        name: res.data.user_name,
        email,
      });

      return true;
    } catch (error: any) {
      console.log("로그인 에러");

      console.log(error);
      console.log(error?.response?.status);
      console.log(error?.response?.data);

      console.log(
        JSON.stringify(
          error.response?.data,
          null,
          2
        )
      );

      return false;
    }
  }

  async function register(
    data: RegisterInput
  ): Promise<boolean> {
    try {
      const res = await signupApi(
        data.name,
        data.email,
        data.pwd
      );

      console.log("회원가입 응답");
      // console.log(res.data);

      return true;
    } catch (error: any) {
      console.log("회원가입 에러");

      console.log(error.response?.status);
      console.log(error.response?.data);



      return false;
    }
  }

  async function logout(): Promise<void> {
    try {
      setUser(null);

      console.log("로그아웃 완료");
    } catch (error) {
      console.log("로그아웃 실패");
      console.log(error);
    }
  }


  async function updateUser(
    data: Partial<User>
  ): Promise<void> {
    console.log("updateUser 미구현");
  }

  async function changePassword(
    email: string,
    pwd: string,
    new_pwd: string
  ): Promise<boolean> {
    try {
      const res = await changePasswordApi(
        email,
        pwd,
        new_pwd
      );
      console.log("비밀번호 변경 응답");
      console.log(res.data);
      return res.data?.message === "password changed successfully";
    } catch (error: any) {
      console.log("비밀번호 변경 에러");
      console.log(error.response?.data);
      return false;
    }
  }


  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
