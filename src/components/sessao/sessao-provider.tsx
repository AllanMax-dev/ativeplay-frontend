"use client";

import { ArrowRightLeft, Building2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canReadModule, canWriteModule } from "@/lib/access-control";
import { api, ApiError } from "@/lib/api";
import type { ResumoDia, SessaoTrabalho } from "@/types/cliente";

/** Resultado de "entrar" em uma empresa. */
export type EntradaResultado =
  | "aberta" // o contador começou nesta empresa
  | "ja-aberta" // o contador já estava nesta empresa
  | "mantida" // o usuário preferiu continuar na empresa atual
  | "cancelada" // o usuário fechou o aviso
  | "erro";

export interface EmpresaAlvo {
  id: string;
  nome: string;
}

interface SessaoContextValue {
  /** O usuário pode ver o contador geral (módulo TAREFAS). */
  enabled: boolean;
  /** O usuário pode iniciar e finalizar o contador (escrita em TAREFAS). */
  canControl: boolean;
  atual: SessaoTrabalho | null;
  resumo: ResumoDia | null;
  /** Momento (relógio local) em que o resumo chegou; base para o tempo correr na tela. */
  receivedAt: number;
  loading: boolean;
  busy: boolean;
  error: string | null;
  /** Entra na empresa: inicia o contador geral (avisa antes se houver outra empresa aberta). */
  entrar: (empresa: EmpresaAlvo) => Promise<EntradaResultado>;
  /** Finaliza a empresa aberta: para o contador geral. */
  finalizar: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const SessaoContext = createContext<SessaoContextValue | null>(null);

const REFRESH_INTERVAL_MS = 60_000;

interface PendingSwitch {
  from: string;
  to: EmpresaAlvo;
  resolve: (choice: "trocar" | "manter" | "cancelar") => void;
}

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const { me } = useAuth();
  const enabled = Boolean(me && me.perfil !== "CLIENTE" && canReadModule(me, "TAREFAS"));
  const canControl = Boolean(me && enabled && canWriteModule(me, "TAREFAS"));
  const [resumo, setResumo] = useState<ResumoDia | null>(null);
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSwitch | null>(null);
  const resumoRef = useRef<ResumoDia | null>(null);

  const applyResumo = useCallback((next: ResumoDia | null) => {
    resumoRef.current = next;
    setResumo(next);
    setReceivedAt(Date.now());
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      applyResumo(await api.get<ResumoDia>("/sessoes/resumo"));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o contador geral.");
    } finally {
      setLoading(false);
    }
  }, [applyResumo, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    function load() {
      api
        .get<ResumoDia>("/sessoes/resumo")
        .then((response) => {
          if (active) applyResumo(response);
        })
        .catch(() => {
          // falhas silenciosas no polling; a próxima tentativa corrige
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    load();
    const interval = window.setInterval(load, REFRESH_INTERVAL_MS);
    function onFocus() {
      load();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [applyResumo, enabled]);

  const askSwitch = useCallback(
    (from: string, to: EmpresaAlvo) =>
      new Promise<"trocar" | "manter" | "cancelar">((resolve) => {
        setPending({ from, to, resolve });
      }),
    [],
  );

  const entrar = useCallback(
    async (empresa: EmpresaAlvo): Promise<EntradaResultado> => {
      if (!canControl) return "erro";
      const atual = resumoRef.current?.atual ?? null;
      if (atual?.empresaId === empresa.id) return "ja-aberta";
      if (atual) {
        const choice = await askSwitch(atual.empresaNome ?? "Empresa atual", empresa);
        if (choice === "manter") return "mantida";
        if (choice === "cancelar") return "cancelada";
      }
      setBusy(true);
      setError(null);
      try {
        await api.post<SessaoTrabalho, { empresaId: string }>("/sessoes/iniciar", { empresaId: empresa.id });
        await refresh();
        return "aberta";
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Não foi possível iniciar o contador geral.");
        return "erro";
      } finally {
        setBusy(false);
      }
    },
    [askSwitch, canControl, refresh],
  );

  const finalizar = useCallback(async () => {
    if (!canControl) return;
    setBusy(true);
    setError(null);
    try {
      await api.post<SessaoTrabalho>("/sessoes/encerrar");
    } catch (cause) {
      // 409 = não havia sessão aberta (ex.: finalizada em outra aba); basta atualizar
      if (!(cause instanceof ApiError && cause.status === 409)) {
        setError(cause instanceof ApiError ? cause.message : "Não foi possível finalizar a empresa.");
      }
    } finally {
      await refresh();
      setBusy(false);
    }
  }, [canControl, refresh]);

  function resolvePending(choice: "trocar" | "manter" | "cancelar") {
    pending?.resolve(choice);
    setPending(null);
  }

  const value = useMemo<SessaoContextValue>(
    () => ({
      enabled,
      canControl,
      atual: resumo?.atual ?? null,
      resumo,
      receivedAt,
      loading,
      busy,
      error,
      entrar,
      finalizar,
      refresh,
      clearError: () => setError(null),
    }),
    [enabled, canControl, resumo, receivedAt, loading, busy, error, entrar, finalizar, refresh],
  );

  return (
    <SessaoContext.Provider value={value}>
      {children}
      {pending ? (
        <Dialog open onOpenChange={(open) => !open && resolvePending("cancelar")}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Atenção</DialogTitle>
              <DialogDescription>
                Percebemos que você já tem uma empresa aberta. O que deseja fazer?
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              <div className="rounded-lg border bg-muted/40 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Empresa atual</p>
                <p className="mt-2 flex items-center justify-center gap-2 font-semibold">
                  <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
                  {pending.from}
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => resolvePending("manter")}>
                  Continuar com a empresa atual
                </Button>
              </div>
              <ArrowRightLeft className="mx-auto hidden size-5 self-center text-muted-foreground sm:block" aria-hidden="true" />
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-primary">Abrir próxima empresa</p>
                <p className="mt-2 flex items-center justify-center gap-2 font-semibold text-primary">
                  <Building2 className="size-4" aria-hidden="true" />
                  {pending.to.nome}
                </p>
                <Button size="sm" className="mt-4" onClick={() => resolvePending("trocar")}>
                  Finalizar atual e abrir próxima
                </Button>
              </div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              O contador geral registra o tempo em que você está dentro de cada cliente. Ao trocar, o tempo da empresa
              atual é encerrado e o da próxima começa a contar. Os cronômetros das tarefas continuam independentes.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => resolvePending("cancelar")}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </SessaoContext.Provider>
  );
}

export function useSessao(): SessaoContextValue {
  const context = useContext(SessaoContext);
  if (!context) throw new Error("useSessao deve ser usado dentro de SessaoProvider");
  return context;
}

/** Relógio que atualiza o componente a cada intervalo (padrão: 1 s). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Tempos correndo em tempo real a partir do último resumo recebido. */
export function useTemposSessao() {
  const { resumo, receivedAt, atual } = useSessao();
  const now = useNow();
  const delta = atual ? Math.max(0, now - receivedAt) : 0;
  return {
    /** Tempo da empresa aberta agora (sessão atual). */
    atualMs: atual ? atual.duracaoMs + delta : 0,
    /** Total do dia dentro das empresas. */
    totalHojeMs: (resumo?.totalMs ?? 0) + delta,
    /** Total do dia em uma empresa específica. */
    hojeNaEmpresaMs(empresaId: string): number {
      const base = resumo?.empresas.find((item) => item.empresaId === empresaId)?.totalMs ?? 0;
      return base + (atual?.empresaId === empresaId ? delta : 0);
    },
  };
}
