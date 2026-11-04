"use client";

import { ArrowRightLeft, Building2, CirclePause, ListChecks } from "lucide-react";
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
import { api, ApiError, withQuery } from "@/lib/api";
import { companyDisplayName } from "@/lib/format";
import type { Pagina } from "@/types/api";
import type { ResumoDia, SessaoTrabalho } from "@/types/cliente";
import type { OcorrenciaTarefa } from "@/types/tarefa";

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
  /** Tarefas do usuário com o cronômetro rodando (o backend garante no máximo uma). */
  tarefasRodando: OcorrenciaTarefa[];
  /**
   * Pede para sair do sistema. Sem contador rodando, chama `sair` na hora; com contador rodando,
   * abre o aviso para finalizar tudo antes e só depois libera a saída.
   */
  pedirSaida: (sair: () => void) => void;
}

const SessaoContext = createContext<SessaoContextValue | null>(null);

const REFRESH_INTERVAL_MS = 60_000;

const TAREFAS_RODANDO_PATH = withQuery("/tarefas/ocorrencias", {
  status: "EM_ANDAMENTO",
  minhas: true,
  porPagina: 20,
});

/** Aviso de saída: `sair` presente quando veio do botão Sair; ausente quando veio do fechamento da aba. */
interface AvisoSaida {
  sair?: () => void;
}

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
  const [tarefasRodando, setTarefasRodando] = useState<OcorrenciaTarefa[]>([]);
  const [avisoSaida, setAvisoSaida] = useState<AvisoSaida | null>(null);
  const [pausando, setPausando] = useState<string | null>(null);
  const bloqueiaSaida = Boolean(resumo?.atual) || tarefasRodando.length > 0;

  const applyResumo = useCallback((next: ResumoDia | null) => {
    resumoRef.current = next;
    setResumo(next);
    setReceivedAt(Date.now());
  }, []);

  const loadTarefasRodando = useCallback(async () => {
    try {
      const pagina = await api.get<Pagina<OcorrenciaTarefa>>(TAREFAS_RODANDO_PATH);
      setTarefasRodando(pagina.dados);
    } catch {
      // falha silenciosa; a próxima atualização corrige
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    void loadTarefasRodando();
    try {
      applyResumo(await api.get<ResumoDia>("/sessoes/resumo"));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o contador geral.");
    } finally {
      setLoading(false);
    }
  }, [applyResumo, enabled, loadTarefasRodando]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    function load() {
      void loadTarefasRodando();
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
  }, [applyResumo, enabled, loadTarefasRodando]);

  // Fechar ou recarregar a aba com contador rodando: aviso nativo do navegador. Se a pessoa
  // cancelar e continuar na página, o aviso da própria página já estará aberto com as ações.
  useEffect(() => {
    if (!enabled || !bloqueiaSaida) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
      setAvisoSaida((current) => current ?? {});
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [bloqueiaSaida, enabled]);

  const pedirSaida = useCallback(
    (sair: () => void) => {
      if (enabled && bloqueiaSaida) setAvisoSaida({ sair });
      else sair();
    },
    [bloqueiaSaida, enabled],
  );

  const pausarTarefa = useCallback(
    async (id: string) => {
      setPausando(id);
      setError(null);
      try {
        await api.post<OcorrenciaTarefa>(`/tarefas/ocorrencias/${id}/pausar`);
      } catch (cause) {
        // 409 = já não estava rodando (ex.: pausada em outra aba); basta atualizar
        if (!(cause instanceof ApiError && cause.status === 409)) {
          setError(cause instanceof ApiError ? cause.message : "Não foi possível pausar a tarefa.");
        }
      } finally {
        await loadTarefasRodando();
        setPausando(null);
      }
    },
    [loadTarefasRodando],
  );

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
      tarefasRodando,
      pedirSaida,
    }),
    [enabled, canControl, resumo, receivedAt, loading, busy, error, entrar, finalizar, refresh, tarefasRodando, pedirSaida],
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
                <p className="text-xs font-medium text-muted-foreground">Empresa atual</p>
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
                <p className="text-xs font-medium text-primary">Abrir próxima empresa</p>
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
      {avisoSaida ? (
        <Dialog open onOpenChange={(open) => !open && setAvisoSaida(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{bloqueiaSaida ? "Encerre os cronômetros antes de sair" : "Tudo finalizado"}</DialogTitle>
              <DialogDescription>
                {bloqueiaSaida
                  ? "Encerre o cronômetro da atividade e da empresa antes de sair do sistema."
                  : avisoSaida.sair
                    ? "Nenhum cronômetro está rodando. Você já pode sair."
                    : "Nenhum cronômetro está rodando. Você já pode fechar a aba."}
              </DialogDescription>
            </DialogHeader>
            {bloqueiaSaida ? (
              <ul className="grid gap-3">
                {tarefasRodando.map((tarefa) => (
                  <li key={tarefa.id} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ListChecks className="size-3.5" aria-hidden="true" /> Atividade rodando
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold">{tarefa.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">{companyDisplayName(tarefa.empresa)}</p>
                    </div>
                    {canControl ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => void pausarTarefa(tarefa.id)}
                        disabled={pausando !== null}
                      >
                        <CirclePause aria-hidden="true" /> {pausando === tarefa.id ? "Pausando..." : "Pausar tarefa"}
                      </Button>
                    ) : null}
                  </li>
                ))}
                {resumo?.atual ? (
                  <li className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Building2 className="size-3.5" aria-hidden="true" /> Empresa aberta (contador geral)
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold">{resumo.atual.empresaNome ?? "Empresa"}</p>
                    </div>
                    {canControl ? (
                      <Button size="sm" variant="destructive" className="shrink-0" onClick={() => void finalizar()} disabled={busy}>
                        <CirclePause aria-hidden="true" /> {busy ? "Finalizando..." : "Finalizar empresa"}
                      </Button>
                    ) : null}
                  </li>
                ) : null}
              </ul>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAvisoSaida(null)}>Continuar no sistema</Button>
              {avisoSaida.sair ? (
                <Button
                  onClick={() => {
                    const sair = avisoSaida.sair;
                    setAvisoSaida(null);
                    sair?.();
                  }}
                  disabled={bloqueiaSaida}
                >
                  Sair
                </Button>
              ) : null}
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
