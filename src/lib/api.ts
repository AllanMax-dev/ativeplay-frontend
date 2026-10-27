import {
  clearStoredSession,
  getStoredSession,
  saveStoredSession,
} from "@/lib/auth-storage";
import type {
  LoginRequest,
  ProblemDetail,
  SessaoResponse,
} from "@/types/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export const AUTH_EXPIRED_EVENT = "ativeplay:auth-expired";

const STATUS_MESSAGES: Record<number, string> = {
  400: "Não foi possível processar os dados enviados.",
  401: "Sua sessão expirou. Entre novamente para continuar.",
  403: "Você não tem permissão para realizar esta ação.",
  404: "O recurso solicitado não foi encontrado.",
  409: "Não foi possível concluir porque há um conflito nos dados.",
  422: "Revise os dados informados e tente novamente.",
  500: "O servidor encontrou um problema. Tente novamente em instantes.",
};

export class ApiError extends Error {
  readonly status: number;
  readonly campos?: Record<string, string>;

  constructor(problem: ProblemDetail) {
    super(problem.detail);
    this.name = "ApiError";
    this.status = problem.status;
    this.campos = problem.campos;
  }
}

interface RequestOptions<TBody> {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: TBody;
  authenticated?: boolean;
  retryOnUnauthorized?: boolean;
}

let refreshPromise: Promise<SessaoResponse> | null = null;

async function readProblem(response: Response): Promise<ProblemDetail> {
  let body: Partial<ProblemDetail> = {};

  try {
    body = (await response.json()) as Partial<ProblemDetail>;
  } catch {
    // Respostas sem corpo usam a mensagem traduzida pelo status HTTP.
  }

  return {
    status: body.status ?? response.status,
    detail:
      body.detail ??
      STATUS_MESSAGES[response.status] ??
      "Não foi possível concluir a solicitação.",
    campos: body.campos,
  };
}

async function renewSession(): Promise<SessaoResponse> {
  if (refreshPromise) return refreshPromise;

  const session = getStoredSession();
  if (!session) {
    throw new ApiError({ status: 401, detail: STATUS_MESSAGES[401] });
  }

  refreshPromise = fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  })
    .then(async (response) => {
      if (!response.ok) throw new ApiError(await readProblem(response));
      const rotatedSession = (await response.json()) as SessaoResponse;
      saveStoredSession(rotatedSession);
      return rotatedSession;
    })
    .catch((error: unknown) => {
      clearStoredSession();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function request<TResponse, TBody = never>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
  const {
    method = "GET",
    body,
    authenticated = true,
    retryOnUnauthorized = authenticated,
  } = options;
  const session = authenticated ? getStoredSession() : null;
  const headers = new Headers({ Accept: "application/json" });

  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError({
      status: 0,
      detail:
        "Não foi possível conectar à API. Confira se o backend está disponível.",
    });
  }

  if (response.status === 401 && retryOnUnauthorized && session?.refreshToken) {
    await renewSession();
    return request<TResponse, TBody>(path, {
      ...options,
      retryOnUnauthorized: false,
    });
  }

  if (!response.ok) throw new ApiError(await readProblem(response));
  if (response.status === 204) return undefined as TResponse;
  return (await response.json()) as TResponse;
}

export const api = {
  get<TResponse>(path: string): Promise<TResponse> {
    return request<TResponse>(path);
  },

  post<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
    return request<TResponse, TBody>(path, { method: "POST", body });
  },

  login(credentials: LoginRequest): Promise<SessaoResponse> {
    return request<SessaoResponse, LoginRequest>("/auth/login", {
      method: "POST",
      body: credentials,
      authenticated: false,
      retryOnUnauthorized: false,
    });
  },

  async logout(): Promise<void> {
    const session = getStoredSession();
    try {
      if (session?.refreshToken) {
        await request<void, { refreshToken: string }>("/auth/logout", {
          method: "POST",
          body: { refreshToken: session.refreshToken },
          authenticated: false,
          retryOnUnauthorized: false,
        });
      }
    } finally {
      clearStoredSession();
    }
  },
};
