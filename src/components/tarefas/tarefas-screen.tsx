"use client";

import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  ClipboardCheck,
  Clock3,
  KeyRound,
  ListChecks,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ChecklistPanel } from "@/components/cliente/checklist-panel";
import { SenhasPanel } from "@/components/cliente/senhas-panel";
import { ContadorGeralCard } from "@/components/sessao/contador-geral";
import { useSessao } from "@/components/sessao/sessao-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { canReadModule, canWriteModule } from "@/lib/access-control";
import { api, ApiError, withQuery } from "@/lib/api";
import { companyDisplayName, formatClock, todayInTimeZone } from "@/lib/format";
import type { Pagina } from "@/types/api";
import type { EmpresaDoDia } from "@/types/cliente";
import type {
  OcorrenciaTarefa,
  Prioridade,
  StatusOcorrencia,
} from "@/types/tarefa";

const PAGE_SIZE = 20;
const ALL_COMPANIES = "TODAS";
const AUTO_ENTER_KEY = "ativeplay:auto-entrar-empresa";
const CARTEIRA_KEY = "ativeplay:filtro-carteira";

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
type Aba = "tarefas" | "checklist" | "senhas";

interface Filters {
  data: string;
  status: StatusOcorrencia | "TODAS";
  minhas: boolean;
  atrasadas: boolean;
}

function readPreference(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // preferência apenas de conveniência
  }
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
  const sessao = useSessao();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [companies, setCompanies] = useState<EmpresaDoDia[] | null>(null);
  const [onlyPortfolio, setOnlyPortfolio] = useState(() =>
    typeof window === "undefined" ? false : readPreference(CARTEIRA_KEY, false),
  );
  const [autoEnter, setAutoEnter] = useState(() =>
    typeof window === "undefined" ? true : readPreference(AUTO_ENTER_KEY, true),
  );
  const [checklistCount, setChecklistCount] = useState<number | null>(null);
  const autoEnteredRef = useRef<string | null>(null);

  const canWrite = me ? canWriteModule(me, "TAREFAS") : false;
  const canReadPasswords = me ? canReadModule(me, "SENHAS") : false;
  const canWritePasswords = me ? canWriteModule(me, "SENHAS") : false;
  const seesAllCompanies = me?.perfil === "ADMIN" || me?.perfil === "GESTOR";

  // empresa e aba vêm da URL (?empresa=<id>&aba=checklist), para links e notificações
  const companyId = searchParams.get("empresa") ?? "";
  const abaParam = searchParams.get("aba");
  const aba: Aba =
    companyId && (abaParam === "checklist" || (abaParam === "senhas" && canReadPasswords)) ? abaParam : "tarefas";
  const company = companies?.find((item) => item.id === companyId) ?? null;
  const companyName = company ? companyDisplayName(company) : "";

  const updateUrl = useCallback(
    (changes: { empresa?: string | null; aba?: Aba | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (changes.empresa !== undefined) {
        if (changes.empresa) params.set("empresa", changes.empresa);
        else params.delete("empresa");
        params.delete("aba");
      }
      if (changes.aba !== undefined) {
        if (changes.aba && changes.aba !== "tarefas") params.set("aba", changes.aba);
        else params.delete("aba");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // empresas do filtro (com as contagens da data escolhida)
  useEffect(() => {
    let active = true;
    api
      .get<EmpresaDoDia[]>(
        withQuery("/tarefas/ocorrencias/empresas", {
          data: filters.data,
          carteira: seesAllCompanies && onlyPortfolio ? true : undefined,
        }),
      )
      .then((response) => {
        if (active) setCompanies(response);
      })
      .catch(() => {
        if (active) setCompanies([]);
      });
    return () => {
      active = false;
    };
  }, [filters.data, onlyPortfolio, revision, seesAllCompanies]);

  // tarefas
  useEffect(() => {
    let active = true;
    const path = withQuery("/tarefas/ocorrencias", {
      data: filters.data,
      empresaId: companyId || undefined,
      carteira: !companyId && seesAllCompanies && onlyPortfolio ? true : undefined,
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
  }, [companyId, filters, onlyPortfolio, page, revision, seesAllCompanies]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setRevision((current) => current + 1);
    void sessao.refresh();
  }, [sessao]);

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

  function selectCompany(value: string) {
    const nextId = value === ALL_COMPANIES ? "" : value;
    if (nextId === companyId) return;
    setLoading(true);
    setError(null);
    setPage(1);
    setChecklistCount(null);
    updateUrl({ empresa: nextId || null });
  }

  // Entrar no cliente (pelo filtro, por "Abrir" em Empresas ou por um link) inicia o
  // contador geral nele, como na plataforma de referência. Uma vez por empresa escolhida.
  const { canControl: canControlSession, loading: sessionLoading, entrar } = sessao;
  useEffect(() => {
    if (!company || !autoEnter || !canControlSession || sessionLoading) return;
    if (autoEnteredRef.current === company.id) return;
    autoEnteredRef.current = company.id;
    void entrar({ id: company.id, nome: companyDisplayName(company) });
  }, [autoEnter, canControlSession, company, entrar, sessionLoading]);

  useEffect(() => {
    if (!companyId) autoEnteredRef.current = null;
  }, [companyId]);

  function togglePortfolio(checked: boolean) {
    setOnlyPortfolio(checked);
    writePreference(CARTEIRA_KEY, checked);
    setLoading(true);
    setPage(1);
  }

  function toggleAutoEnter(checked: boolean) {
    setAutoEnter(checked);
    writePreference(AUTO_ENTER_KEY, checked);
  }

  async function handleAction(task: OcorrenciaTarefa, action: TaskAction) {
    // Iniciar uma tarefa de outro cliente também move o contador geral para ele.
    if (action === "iniciar" && sessao.canControl && sessao.atual?.empresaId !== task.empresa.id) {
      const entrada = await sessao.entrar({ id: task.empresa.id, nome: companyDisplayName(task.empresa) });
      if (entrada === "cancelada") return;
    }

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
  const tasksTimeMs = useMemo(
    () => (result?.dados ?? []).reduce((sum, task) => sum + elapsedTime(task, now, receivedAt), 0),
    [now, receivedAt, result],
  );
  const portfolioCompanies = companies?.filter((item) => item.naCarteira) ?? [];
  const otherCompanies = companies?.filter((item) => !item.naCarteira) ?? [];
  const pendingChecklist = checklistCount ?? company?.checklistPendentes ?? 0;

  function companyOption(item: EmpresaDoDia) {
    return (
      <SelectItem key={item.id} value={item.id}>
        <span className="min-w-0 flex-1 truncate">{companyDisplayName(item)}</span>
        <span className="ml-3 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          {item.atrasadas > 0 ? <span className="text-destructive">{item.atrasadas} atras.</span> : null}
          <span title={`${item.abertas} abertas de ${item.total} tarefas no dia`}>{item.abertas}/{item.total} abertas</span>
          {item.checklistPendentes > 0 ? <span className="text-amber-700">· {item.checklistPendentes} checklist</span> : null}
        </span>
      </SelectItem>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Tarefas do dia</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Selecione um cliente da sua carteira para ver as tarefas dele, o checklist e as senhas salvas. Ao entrar
            em um cliente, o contador geral começa a contar.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" /> Atualizar
        </Button>
      </div>

      {/* ---------- filtro por empresa ---------- */}
      <section className="mt-7 rounded-xl border bg-card p-4" aria-label="Filtro por empresa">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select
              value={companyId || ALL_COMPANIES}
              onValueChange={(value) => value && selectCompany(value)}
              disabled={companies === null}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue>
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">
                      {companies === null
                        ? "Carregando empresas..."
                        : companyId
                          ? companyName || "Empresa selecionada"
                          : seesAllCompanies && !onlyPortfolio
                            ? `Todas as empresas (${companies.length})`
                            : `Todas da minha carteira (${companies.length})`}
                    </span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-96">
                <SelectItem value={ALL_COMPANIES}>
                  {seesAllCompanies && !onlyPortfolio ? "Todas as empresas" : "Todas da minha carteira"}
                </SelectItem>
                {portfolioCompanies.length > 0 ? (
                  <>
                    <SelectSeparator />
                    <p className="px-2 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">Minha carteira</p>
                    {portfolioCompanies.map(companyOption)}
                  </>
                ) : null}
                {otherCompanies.length > 0 ? (
                  <>
                    <SelectSeparator />
                    {portfolioCompanies.length > 0 ? (
                      <p className="px-2 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">Demais empresas</p>
                    ) : null}
                    {otherCompanies.map(companyOption)}
                  </>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 pb-2.5">
            {seesAllCompanies ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={onlyPortfolio} onCheckedChange={togglePortfolio} />
                Somente minha carteira
              </label>
            ) : null}
            {sessao.canControl ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm" title="Ao selecionar uma empresa, o contador geral começa nela">
                <Checkbox checked={autoEnter} onCheckedChange={toggleAutoEnter} />
                Iniciar contador ao entrar
              </label>
            ) : null}
          </div>
        </div>
        {companies !== null && companies.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {onlyPortfolio
              ? "Sua carteira está vazia. Peça a um administrador para incluir empresas em Usuários → Carteira de empresas."
              : "Nenhuma empresa disponível para o seu perfil."}
          </p>
        ) : null}
      </section>

      {/* ---------- contador geral ---------- */}
      <ContadorGeralCard
        empresa={company ? { id: company.id, nome: companyName } : null}
        tempoTarefasMs={tasksTimeMs}
      />

      {/* ---------- cabeçalho do cliente e abas ---------- */}
      {company ? (
        <div className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold">{companyName}</h2>
              {company.nomeFantasia ? (
                <p className="truncate text-sm text-muted-foreground">{company.razaoSocial}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{company.abertas} abertas</Badge>
              <Badge variant="outline">{company.concluidas} concluídas</Badge>
              {company.atrasadas > 0 ? <Badge variant="destructive">{company.atrasadas} atrasadas</Badge> : null}
              <Button variant="ghost" size="sm" onClick={() => selectCompany(ALL_COMPANIES)}>
                <X aria-hidden="true" /> Limpar filtro
              </Button>
            </div>
          </div>
          <div className="mt-4 flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Áreas do cliente">
            {([
              ["tarefas", "Tarefas do dia", ListChecks, result?.total ?? null],
              ["checklist", "Checklist", ClipboardCheck, pendingChecklist],
              ...(canReadPasswords ? [["senhas", "Senhas salvas", KeyRound, null] as const] : []),
            ] as const).map(([value, label, Icon, count]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={aba === value}
                onClick={() => updateUrl({ aba: value })}
                className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  aba === value
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                {count !== null && count > 0 ? (
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-xs tabular-nums ${
                      value === "checklist" ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {company && aba === "checklist" ? (
        <div className="motion-fade-in mt-6">
          <ChecklistPanel
            key={company.id}
            empresaId={company.id}
            empresaNome={companyName}
            canWrite={canWrite}
            onCountChange={setChecklistCount}
          />
        </div>
      ) : null}

      {company && aba === "senhas" && canReadPasswords ? (
        <div className="motion-fade-in mt-6">
          <SenhasPanel key={company.id} empresaId={company.id} empresaNome={companyName} canWrite={canWritePasswords} />
        </div>
      ) : null}

      {aba === "tarefas" ? (
        <div className="motion-fade-in">
          <form onSubmit={applyFilters} className="mt-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[11rem_13rem_1fr_auto] lg:items-end">
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
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>{draft.status === "TODAS" ? "Todos os status" : STATUS_LABELS[draft.status]}</SelectValue>
                </SelectTrigger>
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

          <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-label="Lista de tarefas">
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
                  const taskCompany = companyDisplayName(task.empresa);

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
                            {companyId ? null : (
                              <button
                                type="button"
                                className="font-medium text-foreground/80 hover:underline"
                                onClick={() => selectCompany(task.empresa.id)}
                                title="Entrar neste cliente"
                              >
                                {taskCompany}
                              </button>
                            )}
                            {companyId ? "" : " · "}
                            {task.responsavel ? task.responsavel.nome : "Sem responsável"}
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
                              {formatClock(elapsedTime(task, now, receivedAt))}
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
                <p className="mt-2 text-sm text-muted-foreground">
                  {companyId
                    ? "Este cliente não tem tarefas nesta data com os filtros escolhidos."
                    : "Ajuste os filtros ou escolha outra data."}
                </p>
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
      ) : null}
    </div>
  );
}
