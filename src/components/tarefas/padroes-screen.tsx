"use client";

import { ClipboardList, Pencil, Plus, PowerOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PadraoFormDialog } from "@/components/tarefas/padrao-form-dialog";
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
import { canWriteModule } from "@/lib/access-control";
import { api, ApiError, withQuery } from "@/lib/api";
import type { Setor } from "@/types/admin";
import type { PadraoTarefa } from "@/types/tarefa";

type ActiveFilter = "ATIVOS" | "INATIVOS" | "TODOS";

const FILTER_LABELS: Record<ActiveFilter, string> = {
  ATIVOS: "Ativos",
  INATIVOS: "Inativos",
  TODOS: "Todos",
};

const WEEK_DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function recurrenceSummary(padrao: PadraoTarefa): string {
  if (padrao.recorrencia === "SEMANAL") {
    return `${RECURRENCE_LABELS.SEMANAL}: ${padrao.diasSemana.map((day) => WEEK_DAY_LABELS[day]).join(", ")}`;
  }
  if (padrao.recorrencia === "MENSAL") {
    return `${RECURRENCE_LABELS.MENSAL}: dia ${padrao.diaMes}`;
  }
  return RECURRENCE_LABELS[padrao.recorrencia];
}

export function PadroesScreen() {
  const { me } = useAuth();
  const [padroes, setPadroes] = useState<PadraoTarefa[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [filter, setFilter] = useState<ActiveFilter>("ATIVOS");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PadraoTarefa | null>(null);
  const [deactivating, setDeactivating] = useState<PadraoTarefa | null>(null);
  const [busy, setBusy] = useState(false);
  const canWrite = me ? canWriteModule(me, "TAREFAS") : false;

  useEffect(() => {
    let active = true;
    const ativo = filter === "TODOS" ? undefined : filter === "ATIVOS";

    Promise.all([
      api.get<PadraoTarefa[]>(withQuery("/tarefas/padroes", { ativo })),
      api.get<Setor[]>("/setores"),
    ])
      .then(([patterns, sectors]) => {
        if (active) {
          setPadroes(patterns);
          setSetores(sectors);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar os padrões.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filter, revision]);

  const sectorsById = useMemo(
    () => new Map(setores.map((setor) => [setor.id, setor.nome])),
    [setores],
  );

  function refresh() {
    setFormOpen(false);
    setEditing(null);
    setLoading(true);
    setRevision((current) => current + 1);
  }

  async function deactivate() {
    if (!deactivating) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/tarefas/padroes/${deactivating.id}`);
      setDeactivating(null);
      refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível desativar o padrão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Padrões de tarefa</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Mantenha o catálogo reutilizável de recorrências, prioridades e prazos do escritório.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden="true" /> Novo padrão
          </Button>
        ) : null}
      </div>

      {!canWrite ? (
        <div className="mt-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Você pode consultar os padrões, mas não alterá-los.
        </div>
      ) : null}

      <div className="mt-7 max-w-xs space-y-2">
        <span className="text-sm font-medium">Situação</span>
        <Select value={filter} onValueChange={(value) => {
          if (!value) return;
          setLoading(true);
          setError(null);
          setFilter(value as ActiveFilter);
        }}>
          <SelectTrigger className="w-full"><SelectValue>{FILTER_LABELS[filter]}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="ATIVOS">Ativos</SelectItem>
            <SelectItem value="INATIVOS">Inativos</SelectItem>
            <SelectItem value="TODOS">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-label="Lista de padrões de tarefa">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}
          </div>
        ) : padroes.length > 0 ? (
          <div className="divide-y">
            {padroes.map((padrao) => (
              <article key={padrao.id} className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:px-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={padrao.ativo ? "secondary" : "outline"}>
                      {padrao.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    <Badge variant={padrao.prioridade === "URGENTE" ? "destructive" : "outline"}>
                      {PRIORITY_LABELS[padrao.prioridade]}
                    </Badge>
                  </div>
                  <h2 className="mt-3 font-semibold">{padrao.nome}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {recurrenceSummary(padrao)} · SLA {padrao.horarioLimite}
                    {padrao.setorId ? ` · ${sectorsById.get(padrao.setorId) ?? "Setor não encontrado"}` : " · Sem setor"}
                  </p>
                  {padrao.descricao ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{padrao.descricao}</p> : null}
                </div>

                {canWrite ? (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditing(padrao); setFormOpen(true); }}>
                      <Pencil aria-hidden="true" /> Editar
                    </Button>
                    {padrao.ativo ? (
                      <Button variant="outline" size="sm" onClick={() => setDeactivating(padrao)}>
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
            <ClipboardList className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">Nenhum padrão encontrado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "ATIVOS" ? "Crie um padrão para reutilizar nas rotinas das empresas." : "Não há padrões nessa situação."}
            </p>
          </div>
        )}
      </section>

      {formOpen ? (
        <PadraoFormDialog
          key={editing?.id ?? "novo"}
          padrao={editing}
          setores={setores}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={refresh}
        />
      ) : null}

      {deactivating ? (
        <Dialog open onOpenChange={(open) => !open && setDeactivating(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Desativar padrão</DialogTitle>
              <DialogDescription>
                O padrão {deactivating.nome} deixará de ser oferecido para novas rotinas. As definições já criadas serão preservadas.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeactivating(null)} disabled={busy}>Cancelar</Button>
              <Button variant="destructive" onClick={deactivate} disabled={busy}>
                {busy ? "Desativando..." : "Desativar padrão"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
