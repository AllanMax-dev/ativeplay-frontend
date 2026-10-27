"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, AUTH_EXPIRED_EVENT } from "@/lib/api";
import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
} from "@/lib/auth-storage";
import type {
  LoginRequest,
  MeResponse,
  SessaoResponse,
} from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  me: MeResponse | null;
  login: (credentials: LoginRequest) => Promise<SessaoResponse>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);

  const refreshProfile = useCallback(async () => {
    const profile = await api.get<MeResponse>("/auth/me");
    setMe(profile);
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!getStoredSession()) {
        if (active) setStatus("anonymous");
        return;
      }

      try {
        const profile = await api.get<MeResponse>("/auth/me");
        if (active) {
          setMe(profile);
          setStatus("authenticated");
        }
      } catch {
        clearStoredSession();
        if (active) {
          setMe(null);
          setStatus("anonymous");
        }
      }
    }

    function handleExpiredSession() {
      setMe(null);
      setStatus("anonymous");
      router.replace("/login");
    }

    void restoreSession();
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => {
      active = false;
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    };
  }, [router]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const session = await api.login(credentials);
    saveStoredSession(session);
    try {
      const profile = await api.get<MeResponse>("/auth/me");
      setMe(profile);
      setStatus("authenticated");
      return session;
    } catch (error) {
      clearStoredSession();
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setMe(null);
      setStatus("anonymous");
      router.replace("/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({ status, me, login, logout, refreshProfile }),
    [status, me, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
