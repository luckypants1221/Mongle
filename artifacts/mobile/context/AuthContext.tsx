import React, { createContext, useContext, useEffect, useState } from "react";
import { changePasswordApi } from "@/services/authApi";
// import { *asAccordionPrimitive } from '@radix-ui/react-accordion';

// interface User {
//   id: string;
//   name: string;
//   email: string;
// }
import { api, type RegisterInput, type User } from "@/lib/api";

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

  async function login(email: string, pwd: string): Promise<boolean> {
    try {
      const found = await api.login(email, pwd);
      setUser(found);
      return true;
    } catch {
      return false;
    }
  }

  async function register(data: RegisterInput): Promise<boolean> {
    try {
      const newUser = await api.register(data);
      setUser(newUser);
      return true;
    } catch {
      return false;
    }
  }

  async function logout() {
    api.logout();
    setUser(null);
  }

  async function updateUser(data: Partial<User>) {
    if (!user) return;
    const updated = await api.updateUser(user.id, data);
    setUser(updated);
  }

  async function changePassword(
    id: string,
    pwd: string,
    new_pwd: string
  ): Promise<boolean> {
    try {
      if (!user) return false;

      const res = await changePasswordApi(
        id,
        pwd,
        new_pwd
      );

      return (
        res.data.message ===
        "password changed"
      );
    } catch {
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
