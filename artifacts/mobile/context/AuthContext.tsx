import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { apiAccountVersion, changePasswordApi, loginApi, loginProfileApi, setApiAccount, signupApi, updateProfileApi } from "@/services/authApi";
import { identityId, identityRow, normalizeUser } from "@/lib/accountData";
import type { RegisterInput, User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  sessionVersion: number;
  isLoading: boolean;
  login: (email: string, pwd: string) => Promise<boolean>;
  register: (data: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  changePassword: (email: string, pwd: string, newPwd: string) => Promise<boolean>;
}
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const revision = useRef(0);
  useEffect(() => { setIsLoading(false); }, []);

  async function login(email: string, pwd: string): Promise<boolean> {
    const requestVersion = ++revision.current;
    setApiAccount(null);
    const apiVersion = apiAccountVersion();
    setSessionVersion(requestVersion);
    setUser(null);
    try {
      const response = await loginApi(email, pwd);
      if (requestVersion !== revision.current || apiVersion !== apiAccountVersion() || response.data?.message !== "login success") return false;
      const identity = identityRow(response.data);
      const id = identityId(identity);
      let verifiedIdentity: unknown = identity;
      if (typeof identity.email !== "string" || !(identity.name ?? identity.user_name)) {
        // Older login responses omit email. Verify the returned ID against its
        // profile rather than assigning the typed email to an unverified ID.
        const profile = await loginProfileApi(id);
        verifiedIdentity = { ...identity, ...identityRow(profile.data) };
      }
      const authenticatedUser = normalizeUser(verifiedIdentity, email, id);
      if (requestVersion !== revision.current || apiVersion !== apiAccountVersion()) return false;
      setApiAccount(authenticatedUser.id);
      setUser(authenticatedUser);
      return true;
    } catch (error) {
      console.warn("Login failed", error instanceof Error ? error.message : "Request failed");
      return false;
    }
  }
  async function register(data: RegisterInput): Promise<boolean> {
    try {
      const response = await signupApi(data.name, data.email.trim(), data.pwd);
      return response.status >= 200 && response.status < 300;
    } catch { return false; }
  }
  async function logout() {
    setApiAccount(null);
    setSessionVersion(++revision.current);
    setUser(null);
  }
  async function updateUser(data: Partial<User>) {
    if (!user) return;
    if (data.id !== undefined && data.id !== user.id) throw new Error("계정 ID는 변경할 수 없습니다.");
    const requestVersion = revision.current;
    const response = await updateProfileApi(user.id, data.name ?? user.name, data.email ?? user.email);
    if (requestVersion !== revision.current) return;
    const updated = { ...user, name: data.name ?? user.name, email: data.email ?? user.email };
    const body = identityRow(response.data);
    if (body.id !== undefined || body.user_id !== undefined) setUser(normalizeUser(body, updated.email, user.id));
    else setUser(updated);
  }
  async function changePassword(email: string, pwd: string, newPwd: string) {
    if (!user || email.trim().toLowerCase() !== user.email.toLowerCase()) return false;
    const requestVersion = revision.current;
    try {
      const response = await changePasswordApi(user.email, pwd, newPwd);
      return requestVersion === revision.current && response.data?.message === "password changed successfully";
    } catch { return false; }
  }
  return <AuthContext.Provider value={{ user, sessionVersion, isLoading, login, register, logout, updateUser, changePassword }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
