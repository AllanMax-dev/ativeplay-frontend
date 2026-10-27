import type { SessaoResponse } from "@/types/api";

const SESSION_STORAGE_KEY = "ativeplay.session";

export function getStoredSession(): SessaoResponse | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!value) return null;

    const session = JSON.parse(value) as SessaoResponse;
    if (!session.accessToken || !session.refreshToken || !session.usuario?.perfil) {
      clearStoredSession();
      return null;
    }
    return session;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function saveStoredSession(session: SessaoResponse): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
