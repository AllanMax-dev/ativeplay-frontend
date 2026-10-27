"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  Clock3,
  ListChecks,
  Play,
  RefreshCw,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { canWriteModule } from "@/lib/access-control";
import { api, ApiError, withQuery } from "@/lib/api";
import type { Pagina } from "@/types/api";
import type {
  OcorrenciaTarefa,
  Prioridade,
  StatusOcorrencia,
} from "@/types/tarefa";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<StatusOcorrencia, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  PAUSADA: "Pausada",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const PRIORITY_LABELS: Record<Prioridade, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

type TaskAction = "iniciar" | "pausar" | "concluir";

interface Filters {
  data: string;
  status: StatusOcorrencia | "TODAS";
  minhas: boolean;
  atrasadas: boolean;
}

function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

function elapsedTime(task: OcorrenciaTarefa, now: number, receivedAt: number): number {
  if (!task.cronometroInicio) return task.tempoGastoAtualMs;
  return task.tempoGastoAtualMs + Math.max(0, now - receivedAt);
}

function ActionButton({
  task,
  action,
  busy,
  onAction,
}: {
  task: OcorrenciaTarefa;
  action: TaskAction;
  busy: boolean;
  onAction: (task: OcorrenciaTarefa, action: TaskAction) => void;
}) {
  const config = {
    iniciar: { label: "Iniciar", icon: Play },
    pausar: { label: "Pausar", icon: CirclePause },
    concluir: { label: "Concluir", icon: CheckCircle2 },
  }[action];
  const Icon = config.icon;

  return (
    <Button
      size="sm"
      variant={action === "concluir" ? "default" : "outline"}
      disabled={busy}
      onClick={() => onAction(task, action)}
    >
      <Icon aria-hidden="true" /> {busy ? "Aguarde..." : config.label}
    </Button>
  );
}

export function TarefasScreen() {
  const { me } = useAuth();
  const timeZone = me?.escritorio.fusoHorario ?? "America/Sao_Paulo";
  const initialDate = useMemo(() => todayInTimeZone(timeZone), [timeZone]);
  const [draft, setDraft] = useState<Filters>({
    data: initialDate,
    status: "TODAS",
    minhas: false,
    atrasadas: false,
  });
  const [filters, setFilters] = useState<Filters>(draft);
  const [result, setResult] = useState<Pagina<OcorrenciaTarefa> | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ id: string; action: TaskAction } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const canWrite = me ? canWriteModule(me, "TAREFAS") : false;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const path = withQuery("/tarefas/ocorrencias", {
      data: filters.data,
      status: filters.status === "TODAS" ? undefined : [filters.status],
      minhas: filters.minhas,
      atrasadas: filters.atrasadas,
      pagina: page,
      porPagina: PAGE_SIZE,
    });

    api
      .get<Pagina<OcorrenciaTarefa>>(path)
      .then((response) => {
        if (active) {
          setResult(response);
          setReceivedAt(Date.now());
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Não foi possível carregar as tarefas.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, page, revision]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setRevision((current) => current + 1);
  }, []);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPage(1);
    setFilters({ ...draft });
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  async function handleAction(task: OcorrenciaTarefa, action: TaskAction) {
    setActionState({ id: task.id, action });
    setError(null);
    try {
      const updated = await api.post<OcorrenciaTarefa>(
        `/tarefas/ocorrencias/${task.id}/${action}`,
      );
      setReceivedAt(Date.now());
      setResult((current) =>
        current
          ? {
              ...current,
              dados: current.dados.map((item) => (item.id === updated.id ? updated : item)),
            }
          : current,
      );
      setRevision((current) => current + 1);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setError(
          "Não foi possível alterar o cronômetro porque o estado da tarefa mudou ou a ação não é permitida. Atualize a lista e tente novamente.",
        );
      } else {
        setError(
          cause instanceof ApiError
            ? cause.message
            : "Não foi possível atualizar a tarefa.",
        );
      }
    } finally {
      setActionState(null);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.porPagina)) : 1;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Tarefas do dia</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Acompanhe prazos, SLA e o tempo trabalhado nas ocorrências da sua carteira.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" /> Atualizar
        </Button>
      </div>

      <form onSubmit={applyFilters} className="mt-7 grid gap-4 rounded-xl border bg-background p-4 sm:grid-cols-2 lg:grid-cols-[11rem_13rem_1fr_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="task-date">Data</Label>
          <Input
            id="task-date"
            type="date"
            value={draft.data}
            onChange={(event) => setDraft((current) => ({ ...current, data: event.target.value }))}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={draft.status}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                status: value as Filters["status"],
              }))
            }
          >
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={draft.minhas}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, minhas: checked }))
              }
            />
            Somente minhas
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={draft.atrasadas}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, atrasadas: checked }))
              }
            />
            Somente atrasadas
          </label>
        </div>
        <Button type="submit" className="h-10">Aplicar filtros</Button>
      </form>

      {error ? (
        <div className="mt-5 flex flex-col gap-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={refresh}>Atualizar lista</Button>
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-xl border bg-background" aria-label="Lista de tarefas">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : result && result.dados.length > 0 ? (
          <div className="divide-y">
            {result.dados.map((task) => {
              const open = !["CONCLUIDA", "CANCELADA"].includes(task.status);
              const busy = actionState?.id === task.id;
              const companyName = task.empresa.nomeFantasia || task.empresa.razaoSocial;

              return (
                <article key={task.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{STATUS_LABELS[task.status]}</Badge>
                        <Badge variant={task.prioridade === "URGENTE" ? "destructive" : "secondary"}>
                          {PRIORITY_LABELS[task.prioridade]}
                        </Badge>
                        {task.slaViolado ? <Badge variant="destructive">SLA violado</Badge> : null}
                        {task.atrasada && !task.slaViolado ? <Badge variant="destructive">Atrasada</Badge> : null}
                      </div>
                      <h2 className="mt-3 font-semibold">{task.titulo}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {companyName}
                        {task.responsavel ? ` · ${task.responsavel.nome}` : " · Sem responsável"}
                      </p>
                    </div>

                    <dl className="grid shrink-0 grid-cols-2 gap-x-7 gap-y-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-muted-foreground">Prazo</dt>
                        <dd className={`mt-1 text-sm font-medium tabular-nums ${task.atrasada ? "text-destructive" : ""}`}>
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone,
                          }).format(new Date(task.prazo))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Tempo</dt>
                        <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium tabular-nums">
                          <Clock3 className={`size-4 ${task.cronometroInicio ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                          {formatDuration(elapsedTime(task, now, receivedAt))}
                        </dd>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <dt className="text-xs text-muted-foreground">Setor</dt>
                        <dd className="mt-1 text-sm font-medium">{task.setor?.nome ?? "Não definido"}</dd>
                      </div>
                    </dl>

                    {canWrite && open ? (
                      <div className="flex flex-wrap gap-2 xl:w-52 xl:justify-end">
                        {task.status === "EM_ANDAMENTO" ? (
                          <ActionButton task={task} action="pausar" busy={busy} onAction={handleAction} />
                        ) : (
                          <ActionButton task={task} action="iniciar" busy={busy} onAction={handleAction} />
                        )}
                        <ActionButton task={task} action="concluir" busy={busy} onAction={handleAction} />
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <ListChecks className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">Nenhuma tarefa encontrada</h2>
            <p className="mt-2 text-sm text-muted-foreground">Ajuste os filtros ou escolha outra data.</p>
          </div>
        )}
      </section>

      {result && result.total > 0 ? (
        <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{result.total} {result.total === 1 ? "tarefa" : "tarefas"}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => changePage(page - 1)} disabled={page <= 1 || loading}>
              <ChevronLeft aria-hidden="true" /> Anterior
            </Button>
            <span className="px-2 tabular-nums">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => changePage(page + 1)} disabled={page >= totalPages || loading}>
              Próxima <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
