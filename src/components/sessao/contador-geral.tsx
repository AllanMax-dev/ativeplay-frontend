"use client";

import { Building2, CirclePause, Play, Timer, TimerOff } from "lucide-react";
import Link from "next/link";
import { useSessao, useTemposSessao } from "@/components/sessao/sessao-provider";
import { Button } from "@/components/ui/button";
import { formatClock, formatHoursMinutes } from "@/lib/format";

/**
 * Indicador compacto no topo da aplicação: a empresa aberta, o contador geral correndo e
 * o botão para finalizar. Fica visível em qualquer tela, como na plataforma de referência.
 */
export function ContadorGeralHeader() {
  const { enabled, canControl, atual, busy, finalizar, loading } = useSessao();
  const { atualMs, totalHojeMs } = useTemposSessao();
  if (!enabled || loading) return null;

  if (!atual) {
    return (
      <div className="motion-fade-in flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs text-accent-foreground">
        <TimerOff className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Nenhuma empresa aberta</span>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <span className="tabular-nums">Hoje {formatHoursMinutes(totalHojeMs)}</span>
      </div>
    );
  }

  return (
    <div
      key={atual.empresaId}
      className="motion-fade-in flex min-w-0 items-center gap-2 rounded-full bg-accent py-1 pr-1 pl-3 text-accent-foreground"
      role="timer"
      aria-label={`Contador geral em ${atual.empresaNome ?? "empresa"}: ${formatClock(atualMs)}`}
    >
      <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <Link
        href={`/tarefas?empresa=${atual.empresaId}`}
        className="hidden max-w-40 truncate text-xs font-medium hover:underline sm:inline"
        title="Abrir a empresa em Tarefas do dia"
      >
        {atual.empresaNome}
      </Link>
      <span className="text-sm font-semibold tabular-nums">{formatClock(atualMs)}</span>
      {canControl ? (
        <Button
          size="xs"
          variant="ghost"
          className="text-accent-foreground hover:bg-primary/10 hover:text-accent-foreground"
          onClick={() => void finalizar()}
          disabled={busy}
          title="Finalizar empresa (para o contador geral)"
        >
          <CirclePause aria-hidden="true" />
          <span className="hidden lg:inline">Finalizar</span>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Versão do contador geral para a barra lateral (telas grandes): sempre visível, com o relógio
 * em destaque. Mesmos dados e ações do indicador do topo.
 */
export function ContadorGeralSidebar() {
  const { enabled, canControl, atual, busy, finalizar, loading } = useSessao();
  const { atualMs, totalHojeMs } = useTemposSessao();
  if (!enabled || loading) return null;

  return (
    <section
      className={`rounded-xl border px-3 py-3 transition-[background-color,border-color] duration-200 ease-(--ease-out) ${atual ? "border-transparent bg-sidebar-accent text-sidebar-accent-foreground" : "border-sidebar-border"}`}
      role={atual ? "timer" : undefined}
      aria-label={
        atual
          ? `Contador geral em ${atual.empresaNome ?? "empresa"}: ${formatClock(atualMs)}`
          : "Contador geral"
      }
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          {atual ? (
            <span className="size-2 rounded-full bg-sidebar-primary" aria-hidden="true" />
          ) : (
            <TimerOff className="size-3.5 text-muted-foreground" aria-hidden="true" />
          )}
          Contador geral
        </span>
        <span className="tabular-nums text-muted-foreground">Hoje {formatHoursMinutes(totalHojeMs)}</span>
      </div>
      {atual ? (
        <div key={atual.empresaId} className="motion-fade-in">
          <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] tabular-nums">{formatClock(atualMs)}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <Link
              href={`/tarefas?empresa=${atual.empresaId}`}
              className="min-w-0 truncate text-sm hover:underline"
              title="Abrir a empresa em Tarefas do dia"
            >
              {atual.empresaNome}
            </Link>
            {canControl ? (
              <Button
                size="xs"
                variant="ghost"
                className="shrink-0 text-sidebar-accent-foreground hover:bg-primary/10 hover:text-sidebar-accent-foreground"
                onClick={() => void finalizar()}
                disabled={busy}
                title="Finalizar empresa (para o contador geral)"
              >
                <CirclePause aria-hidden="true" />
                Finalizar
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="motion-fade-in mt-2 text-sm text-muted-foreground">Nenhuma empresa aberta</p>
      )}
    </section>
  );
}

/**
 * Cartão do contador geral em "Tarefas do dia". Com uma empresa selecionada, mostra o tempo
 * dentro dela e permite entrar/finalizar; sem empresa, mostra o total do dia por empresa.
 * Os cronômetros individuais das tarefas continuam funcionando normalmente.
 */
export function ContadorGeralCard({
  empresa,
  tempoTarefasMs,
}: {
  empresa: { id: string; nome: string } | null;
  /** Soma dos cronômetros das tarefas listadas, para comparar com o contador geral. */
  tempoTarefasMs: number;
}) {
  const { enabled, canControl, atual, resumo, busy, error, entrar, finalizar, clearError } = useSessao();
  const { atualMs, totalHojeMs, hojeNaEmpresaMs } = useTemposSessao();
  if (!enabled) return null;

  const nestaEmpresa = Boolean(empresa && atual?.empresaId === empresa.id);
  const emOutra = Boolean(empresa && atual && atual.empresaId !== empresa.id);

  return (
    <section
      className="mt-6 overflow-hidden rounded-xl border bg-card"
      aria-labelledby="general-timer-title"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <Timer
              className={`mt-0.5 size-5 shrink-0 ${nestaEmpresa || (!empresa && atual) ? "text-primary" : "text-muted-foreground"}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 id="general-timer-title" className="text-sm font-semibold">Contador geral</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {empresa
                  ? nestaEmpresa
                    ? `Você está dentro de ${empresa.nome}. O tempo conta até você finalizar ou trocar de empresa.`
                    : emOutra
                      ? `O contador está correndo em ${atual?.empresaNome}. Entre em ${empresa.nome} para contar o tempo aqui.`
                      : `Entre em ${empresa.nome} para começar a contar o tempo dedicado a este cliente.`
                  : atual
                    ? `Empresa aberta: ${atual.empresaNome}. Selecione uma empresa no filtro para entrar nela.`
                    : "Selecione uma empresa no filtro para entrar nela e iniciar o contador."}
              </p>
            </div>
          </div>

          {canControl ? (
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              {empresa && !nestaEmpresa ? (
                <Button onClick={() => void entrar(empresa)} disabled={busy}>
                  <Play aria-hidden="true" /> {emOutra ? "Trocar para esta empresa" : "Entrar na empresa"}
                </Button>
              ) : null}
              {atual && (nestaEmpresa || !empresa) ? (
                <Button variant="destructive" onClick={() => void finalizar()} disabled={busy}>
                  <CirclePause aria-hidden="true" /> Finalizar empresa
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{empresa ? "Agora nesta empresa" : "Empresa aberta"}</dt>
            <dd className={`mt-1 text-xl font-semibold tabular-nums ${nestaEmpresa || (!empresa && atual) ? "text-primary" : ""}`}>
              {formatClock(empresa ? (nestaEmpresa ? atualMs : 0) : atualMs)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{empresa ? "Hoje nesta empresa" : "Total do dia"}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {formatHoursMinutes(empresa ? hojeNaEmpresaMs(empresa.id) : totalHojeMs)}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs text-muted-foreground" title="Soma dos cronômetros das tarefas listadas">
              Cronômetros das tarefas (lista)
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-muted-foreground">{formatHoursMinutes(tempoTarefasMs)}</dd>
          </div>
        </dl>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 border-t bg-destructive/10 px-5 py-2.5 text-sm text-destructive" role="alert">
          <span>{error}</span>
          <Button variant="ghost" size="xs" onClick={clearError}>Fechar</Button>
        </div>
      ) : null}

      {!empresa && resumo && resumo.empresas.length > 0 ? (
        <div className="border-t bg-muted/30 px-5 py-3 sm:px-6">
          <p className="text-xs font-medium text-muted-foreground">Tempo por empresa hoje</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {resumo.empresas.map((item) => (
              <li key={item.empresaId}>
                <Link
                  href={`/tarefas?empresa=${item.empresaId}`}
                  className={`inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs hover:bg-muted ${
                    atual?.empresaId === item.empresaId ? "border-primary/40 text-primary" : ""
                  }`}
                >
                  <Building2 className="size-3" aria-hidden="true" />
                  {item.empresaNome ?? "Empresa"}
                  <span className="tabular-nums text-muted-foreground">{formatHoursMinutes(hojeNaEmpresaMs(item.empresaId))}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
