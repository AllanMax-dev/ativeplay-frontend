"use client";

import { AlertTriangle, Clock3, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RentabilidadeSection } from "@/components/painel/rentabilidade-section";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { PainelResumo } from "@/types/painel";

const STATUS_LABELS: Record<string, string> = {
  PENDENTE: "Pendentes",
  EM_ANDAMENTO: "Em andamento",
  PAUSADA: "Pausadas",
  CONCLUIDA: "Concluídas",
  CANCELADA: "Canceladas",
  ONBOARDING: "Em implantação",
  ATIVA: "Ativas",
  SUSPENSA: "Suspensas",
  ENCERRADA: "Encerradas",
};

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function SummarySkeleton() {
  return (
    <div className="space-y-6" aria-label="Carregando painel">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export function PainelDashboard() {
  const [summary, setSummary] = useState<PainelResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.get<PainelResumo>("/painel/resumo"));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível carregar o painel.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    api
      .get<PainelResumo>("/painel/resumo")
      .then((response) => {
        if (active) setSummary(response);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Não foi possível carregar o painel.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <SummarySkeleton />;

  if (!summary) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <AlertTriangle className="mx-auto size-10 text-destructive" aria-hidden="true" />
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">Painel indisponível</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{error}</p>
        <Button className="mt-6" onClick={loadSummary}>Tentar novamente</Button>
      </div>
    );
  }

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${summary.data}T12:00:00Z`));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Painel</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Resumo operacional de {formattedDate}.
          </p>
        </div>
        <Button variant="outline" onClick={loadSummary}>
          <RefreshCw aria-hidden="true" /> Atualizar
        </Button>
      </div>

      <section className="mt-8 overflow-hidden rounded-xl border bg-card" aria-label="Indicadores principais">
        <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
          <div className="border-b px-5 py-5 sm:border-r xl:border-b-0">
            <dt className="text-sm text-muted-foreground">Tarefas do dia</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">{summary.totalDia}</dd>
          </div>
          <div className="border-b px-5 py-5 xl:border-b-0 xl:border-r">
            <dt className="text-sm text-muted-foreground">Atrasadas</dt>
            <dd className="mt-2 flex items-center gap-2 text-2xl font-semibold tabular-nums">
              {summary.atrasadas}
              {summary.atrasadas > 0 ? <AlertTriangle className="size-5 text-destructive" aria-hidden="true" /> : null}
            </dd>
          </div>
          <div className="border-b px-5 py-5 sm:border-b-0 sm:border-r">
            <dt className="text-sm text-muted-foreground">No prazo em 30 dias</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">
              {summary.percentualNoPrazo30d === null ? "Sem dados" : `${summary.percentualNoPrazo30d.toFixed(1)}%`}
            </dd>
          </div>
          <div className="px-5 py-5">
            <dt className="text-sm text-muted-foreground">Tempo trabalhado em 30 dias</dt>
            <dd className="mt-2 flex items-center gap-2 text-2xl font-semibold tabular-nums">
              <Clock3 className="size-5 text-primary" aria-hidden="true" />
              {formatDuration(summary.tempoTrabalhado30dMs)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="today-status-title">
          <h2 id="today-status-title" className="text-base font-semibold">Tarefas por status</h2>
          <div className="mt-5 divide-y">
            {Object.entries(summary.ocorrenciasDiaPorStatus).map(([status, total]) => (
              <div key={status} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-muted-foreground">{STATUS_LABELS[status] ?? status}</span>
                <span className="font-semibold tabular-nums">{total}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="company-status-title">
          <h2 id="company-status-title" className="text-base font-semibold">Empresas por status</h2>
          <div className="mt-5 divide-y">
            {Object.entries(summary.empresasPorStatus).map(([status, total]) => (
              <div key={status} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-muted-foreground">{STATUS_LABELS[status] ?? status}</span>
                <span className="font-semibold tabular-nums">{total}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="time-title">
        <h2 id="time-title" className="text-base font-semibold">Tempo por responsável em 30 dias</h2>
        {summary.tempoPorResponsavel30d.length > 0 ? (
          <div className="mt-5 divide-y">
            {summary.tempoPorResponsavel30d.map((item) => (
              <div key={item.usuarioId} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-muted-foreground">{item.nome}</span>
                <span className="font-medium tabular-nums">{formatDuration(item.tempoMs)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Ainda não há tempo registrado no período.</p>
        )}
      </section>

      {summary.mrr !== undefined || summary.pipelineCrm !== undefined ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          {summary.mrr !== undefined ? (
            <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="mrr-title">
              <h2 id="mrr-title" className="text-base font-semibold">Receita mensal recorrente</h2>
              <p className="mt-4 text-2xl font-semibold tabular-nums">{formatCurrency(summary.mrr)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Honorários das empresas ativas.</p>
            </section>
          ) : null}

          {summary.pipelineCrm !== undefined ? (
            <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="pipeline-title">
              <h2 id="pipeline-title" className="text-base font-semibold">Pipeline de CRM</h2>
              {summary.pipelineCrm.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {summary.pipelineCrm.map((etapa) => (
                    <div key={etapa.etapaId} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 px-4 py-3">
                      <span className="min-w-0 flex-1 text-sm font-medium">{etapa.nome}</span>
                      <Badge variant="secondary">{etapa.quantidade}</Badge>
                      <span className="text-sm tabular-nums text-muted-foreground">{formatCurrency(etapa.valorMensal)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">O pipeline não possui oportunidades.</p>
              )}
            </section>
          ) : null}
        </div>
      ) : null}

      <RentabilidadeSection />
    </div>
  );
}
