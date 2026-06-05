import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { name: string; email: string; password: string }) => Promise<boolean>;
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
    } catch {}
    setIsLoading(false);
  }

  async function login(email: string, _password: string): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem("@sleep_users");
      const users: User[] = stored ? JSON.parse(stored) : [];
      const found = users.find((u) => u.email === email);
      if (!found) return false;
      await AsyncStorage.setItem("@sleep_user", JSON.stringify(found));
      setUser(found);
      return true;
    } catch {
      return false;
    }
  }

  async function register(data: { name: string; email: string; password: string }): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem("@sleep_users");
      const users: User[] = stored ? JSON.parse(stored) : [];
      if (users.find((u) => u.email === data.email)) return false;
      const newUser: User = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: data.name,
        email: data.email,
      };
      users.push(newUser);
      await AsyncStorage.setItem("@sleep_users", JSON.stringify(users));
      await AsyncStorage.setItem("@sleep_user", JSON.stringify(newUser));
      setUser(newUser);
      return true;
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
