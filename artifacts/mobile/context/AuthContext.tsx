import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { loginApi, signupApi } from "@/services/authApi";
// import { *asAccordionPrimitive } from '@radix-ui/react-accordion';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (id: string, pwd: string) => Promise<boolean>;
  register: (data: { name: string; email: string; pwd: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const stored = await AsyncStorage.getItem("@sleep_user");
      if (stored) setUser(JSON.parse(stored));
    } catch { }
    setIsLoading(false);
  }

  async function login(
    email: string,
    pwd: string
  ): Promise<boolean> {
    try {
      const res = await loginApi(email, pwd);

      if (
        res.data.message !==
        "login success"
      ) {
        return false;
      }

      const user = { id: res.data.id, name: res.data.name, email: res.data.email };

      await AsyncStorage.setItem(
        "@sleep_user",
        JSON.stringify(user)
      );

      setUser(user);

      return true;
    } catch {
      return false;
    }
  }

  async function register(data: {
    name: string;
    pwd: string;
    email: string;
  }): Promise<boolean> {
    try {
      const res = await signupApi(
        data.name,
        data.pwd,
        data.email
      );

      return (
        res.data.message ===
        "signup success"
      );
    } catch {
      return false;
    }
  }

  async function logout() {
    await AsyncStorage.removeItem("@sleep_user");
    setUser(null);
  }

  async function updateUser(data: Partial<User>) {
    if (!user) return;
    const updated = { ...user, ...data };
    await AsyncStorage.setItem("@sleep_user", JSON.stringify(updated));
    const stored = await AsyncStorage.getItem("@sleep_users");
    const users: User[] = stored ? JSON.parse(stored) : [];
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = updated;
      await AsyncStorage.setItem("@sleep_users", JSON.stringify(users));
    }
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}