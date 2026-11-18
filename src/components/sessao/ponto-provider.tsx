"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { api, ApiError, AUTH_EXPIRED_EVENT, PONTO_ENCERRADO_MESSAGE } from "@/lib/api";
import { clearStoredSession, saveLoginNotice } from "@/lib/auth-storage";
import type { RegistroPonto } from "@/types/ponto";

const SINAL_INTERVAL_MS = 60_000;

interface PontoContextValue {
  /** Só funcionários têm ponto (CLIENTE não). */
  enabled: boolean;
  /** Registro aberto do login atual, ou null quando não há (GET /atual = 204). */
  registro: RegistroPonto | null;
  /** A primeira consulta terminou (com ou sem registro). */
  carregado: boolean;
  erro: boolean;
}

const PontoContext = createContext<PontoContextValue | null>(null);

/**
 * Ponto eletrônico: do login ao logout. Uma única instância (fica no AppShell) envia o sinal a
 * cada 60 s; sem sinal por 15 min o backend deixa o registro pendente. Sinal recusado (409) quer
 * dizer que o ponto foi encerrado (novo login em outro aparelho ou registro pendente): volta ao login.
 */
export function PontoProvider({ children }: { children: React.ReactNode }) {
  const { status, me } = useAuth();
  const enabled = status === "authenticated" && Boolean(me) && me?.perfil !== "CLIENTE";
  const [registro, setRegistro] = useState<RegistroPonto | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState(false);

  const encerrar = useCallback(() => {
    saveLoginNotice(PONTO_ENCERRADO_MESSAGE);
    clearStoredSession();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let ativo = true;

    async function enviarSinal() {
      try {
        await api.post<void>("/sessoes-acesso/sinal");
      } catch (cause) {
        if (ativo && cause instanceof ApiError && cause.status === 409) encerrar();
        // outras falhas (rede etc.): o próximo sinal tenta de novo
      }
    }

    api
      .get<RegistroPonto | undefined>("/sessoes-acesso/atual")
      .then((dados) => {
        if (!ativo) return;
        setRegistro(dados ?? null);
        setErro(false);
      })
      .catch(() => {
        if (ativo) setErro(true);
      })
      .finally(() => {
        if (ativo) setCarregado(true);
      });
    void enviarSinal();
    const intervalo = window.setInterval(() => void enviarSinal(), SINAL_INTERVAL_MS);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
    };
  }, [enabled, encerrar]);

  const value = useMemo<PontoContextValue>(
    () => ({ enabled, registro: enabled ? registro : null, carregado, erro }),
    [enabled, registro, carregado, erro],
  );

  return <PontoContext.Provider value={value}>{children}</PontoContext.Provider>;
}

export function usePonto(): PontoContextValue {
  const context = useContext(PontoContext);
  if (!context) throw new Error("usePonto deve ser usado dentro de PontoProvider");
  return context;
}
