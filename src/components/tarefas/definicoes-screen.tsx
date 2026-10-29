"use client";

import { Pencil, Plus, PowerOff, Repeat2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { DefinicaoFormDialog } from "@/components/tarefas/definicao-form-dialog";
import {
  PRIORITY_LABELS,
  RECURRENCE_LABELS,
} from "@/components/tarefas/task-rule-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { canReadModule, canWriteModule } from "@/lib/access-control";
import { api, ApiError, withQuery } from "@/lib/api";
import type { Setor, UsuarioLista } from "@/types/admin";
import type { Pagina } from "@/types/api";
import type { EmpresaResumo, UsuarioRef } from "@/types/empresa";
import type { DefinicaoTarefa, PadraoTarefa } from "@/types/tarefa";

type ActiveFilter = "ATIVAS" | "INATIVAS" | "TODAS";

const FILTER_LABELS: Record<ActiveFilter, string> = {
  ATIVAS: "Ativas",
  INATIVAS: "Inativas",
  TODAS: "Todas",
};

const WEEK_DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function recurrenceSummary(definition: DefinicaoTarefa): string {
  if (definition.recorrencia === "SEMANAL") {
    return `${RECURRENCE_LABELS.SEMANAL}: ${definition.diasSemana.map((day) => WEEK_DAY_LABELS[day]).join(", ")}`;
  }
  if (definition.recorrencia === "MENSAL") {
    return `${RECURRENCE_LABELS.MENSAL}: dia ${definition.diaMes}`;
  }
  if (definition.recorrencia === "UNICA") {
    return `${RECURRENCE_LABELS.UNICA}: ${definition.dataUnica
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${definition.dataUnica}T00:00:00Z`))
      : "sem data"}`;
  }
  return RECURRENCE_LABELS.DIARIA;
}

export function DefinicoesScreen() {
  const { me } = useAuth();
  const [companies, setCompanies] = useState<EmpresaResumo[]>([]);
  const [patterns, setPatterns] = useState<PadraoTarefa[]>([]);
  const [sectors, setSectors] = useState<Setor[]>([]);
  const [team, setTeam] = useState<UsuarioRef[]>([]);
  const [definitions, setDefinitions] = useState<DefinicaoTarefa[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [filter, setFilter] = useState<ActiveFilter>("ATIVAS");
  const [revision, setRevision] = useState(0);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingDefinitions, setLoadingDefinitions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DefinicaoTarefa | null>(null);
  const [deactivating, setDeactivating] = useState<DefinicaoTarefa | null>(null);
  const [busy, setBusy] = useState(false);
  const canWrite = me ? canWriteModule(me, "TAREFAS") : false;
  const canListUsers = me ? canReadModule(me, "USUARIOS") : false;

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get<Pagina<EmpresaResumo>>(withQuery("/empresas", { pagina: 1, porPagina: 100 })),
      api.get<PadraoTarefa[]>(withQuery("/tarefas/padroes", { ativo: true })),
      api.get<Setor[]>("/setores"),
    ])
      .then(([companyPage, taskPatterns, taskSectors]) => {
        if (active) {
          setCompanies(companyPage.dados);
          setPatterns(taskPatterns);
          setSectors(taskSectors);
          const firstCompanyId = companyPage.dados[0]?.id ?? "";
          if (firstCompanyId) setLoadingDefinitions(true);
          setCompanyId(firstCompanyId);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar os dados das rotinas.");
        }
      })
      .finally(() => {
        if (active) setLoadingResources(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!companyId) return;

    let active = true;
    const ativa = filter === "TODAS" ? undefined : filter === "ATIVAS";
    const usersRequest = canListUsers
      ? api
          .get<Pagina<UsuarioLista>>(withQuery("/usuarios", { ativo: true, pagina: 1, porPagina: 100 }))
          .then((response) => response.dados
            .filter((user) => user.perfil !== "CLIENTE")
            .map((user) => ({ id: user.id, nome: user.nome })))
      : api.get<UsuarioRef[]>(`/empresas/${companyId}/equipe`);

    Promise.all([
      api.get<DefinicaoTarefa[]>(withQuery("/tarefas/definicoes", { empresaId: companyId, ativa })),
      usersRequest,
    ])
      .then(([taskDefinitions, companyTeam]) => {
        if (active) {
          setDefinitions(taskDefinitions);
          setTeam(companyTeam);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar as rotinas da empresa.");
        }
      })
      .finally(() => {
        if (active) setLoadingDefinitions(false);
      });

    return () => {
      active = false;
    };
  }, [canListUsers, companyId, filter, revision]);

  const company = companies.find((item) => item.id === companyId) ?? null;
  const sectorsById = useMemo(
    () => new Map(sectors.map((sector) => [sector.id, sector.nome])),
    [sectors],
  );
  const usersById = useMemo(
    () => new Map(team.map((user) => [user.id, user.nome])),
    [team],
  );

  function refresh() {
    setFormOpen(false);
    setEditing(null);
    setLoadingDefinitions(true);
    setRevision((current) => current + 1);
  }

  async function deactivate() {
    if (!deactivating) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/tarefas/definicoes/${deactivating.id}`);
      setDeactivating(null);
      refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível desativar a rotina.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Rotinas por empresa</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Configure as definições que geram ocorrências nas datas e horários programados.
          </p>
        </div>
        {canWrite && company ? (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden="true" /> Nova rotina
          </Button>
        ) : null}
      </div>

      {!canWrite ? (
        <div className="mt-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Você pode consultar as rotinas, mas não alterá-las.
        </div>
      ) : null}

      <div className="mt-7 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="text-sm font-medium">Empresa</span>
          <Select
            value={companyId}
            onValueChange={(value) => {
              if (!value) return;
              setLoadingDefinitions(true);
              setError(null);
              setCompanyId(value);
            }}
            disabled={loadingResources || companies.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {loadingResources ? "Carregando..." : company?.nomeFantasia || company?.razaoSocial || "Selecione uma empresa"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {companies.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.nomeFantasia || item.razaoSocial}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium">Situação</span>
          <Select value={filter} onValueChange={(value) => {
            if (!value) return;
            setLoadingDefinitions(true);
            setError(null);
            setFilter(value as ActiveFilter);
          }}>
            <SelectTrigger className="w-full"><SelectValue>{FILTER_LABELS[filter]}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVAS">Ativas</SelectItem>
              <SelectItem value="INATIVAS">Inativas</SelectItem>
              <SelectItem value="TODAS">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-label="Lista de rotinas da empresa">
        {loadingResources || loadingDefinitions ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}
          </div>
        ) : definitions.length > 0 ? (
          <div className="divide-y">
            {definitions.map((definition) => (
              <article key={definition.id} className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={definition.ativa ? "secondary" : "outline"}>
                      {definition.ativa ? "Ativa" : "Inativa"}
                    </Badge>
                    <Badge variant={definition.prioridade === "URGENTE" ? "destructive" : "outline"}>
                      {PRIORITY_LABELS[definition.prioridade]}
                    </Badge>
                    {definition.visivelCliente ? <Badge variant="outline">Visível ao cliente</Badge> : null}
                  </div>
                  <h2 className="mt-3 font-semibold">{definition.nome}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {recurrenceSummary(definition)} · SLA {definition.horarioLimite}
                    {definition.setorId ? ` · ${sectorsById.get(definition.setorId) ?? "Setor não encontrado"}` : " · Sem setor"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {definition.responsavelId
                      ? usersById.get(definition.responsavelId) ?? "Responsável definido"
                      : "Sem responsável"}
                    {definition.tempoEstimadoMin ? ` · ${definition.tempoEstimadoMin} min estimados` : ""}
                  </p>
                </div>

                {canWrite ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(definition); setFormOpen(true); }}>
                      <Pencil aria-hidden="true" /> Editar
                    </Button>
                    {definition.ativa ? (
                      <Button variant="outline" size="sm" onClick={() => setDeactivating(definition)}>
                        <PowerOff aria-hidden="true" /> Desativar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <Repeat2 className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">
              {companies.length === 0 ? "Nenhuma empresa disponível" : "Nenhuma rotina encontrada"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {companies.length === 0
                ? "As definições recorrentes são configuradas dentro de uma empresa acessível ao seu perfil."
                : filter === "ATIVAS"
                  ? "Crie uma rotina do zero ou use um padrão do catálogo."
                  : "Não há rotinas nessa situação."}
            </p>
          </div>
        )}
      </section>

      {formOpen && company ? (
        <DefinicaoFormDialog
          key={editing?.id ?? `nova-${company.id}`}
          definicao={editing}
          empresa={company}
          padroes={patterns}
          setores={sectors}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={refresh}
        />
      ) : null}

      {deactivating ? (
        <Dialog open onOpenChange={(open) => !open && setDeactivating(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Desativar rotina</DialogTitle>
              <DialogDescription>
                A rotina {deactivating.nome} deixará de gerar novas ocorrências. As ocorrências já criadas serão preservadas.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeactivating(null)} disabled={busy}>Cancelar</Button>
              <Button variant="destructive" onClick={deactivate} disabled={busy}>
                {busy ? "Desativando..." : "Desativar rotina"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
