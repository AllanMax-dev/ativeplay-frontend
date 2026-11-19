"use client";

import { ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, Clock3, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { InformarSaidaDialog } from "@/components/ponto/informar-saida-dialog";
import { useNow } from "@/components/sessao/sessao-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, withQuery } from "@/lib/api";
import {
  formatClock,
  formatDateInTimeZone,
  formatHoursMinutes,
  formatTimeInTimeZone,
  todayInTimeZone,
} from "@/lib/format";
import type { Perfil } from "@/types/api";
import type { CargaFuncionario, RegistroPonto } from "@/types/ponto";

const PERFIL_LABELS: Record<Perfil, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  OPERADOR: "Operador",
  CLIENTE: "Cliente",
};

/** "2026-11" deslocado em `delta` meses. */
function shiftMonth(mes: string, delta: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const date = new Date(Date.UTC(ano, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-11" → "Novembro de 2026". */
function formatMonth(mes: string): string {
  const texto = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(`${mes}-15T12:00:00Z`),
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2026-11-05" → "qua., 05/11", sem deslocar o dia pelo fuso. */
function formatDay(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" }).format(
    new Date(`${data}T12:00:00Z`),
  );
}

function StatusRegistro({ registro }: { registro: RegistroPonto }) {
  if (registro.pendente) return <Badge className="bg-amber-100 text-amber-900">Pendente</Badge>;
  if (!registro.fim) return <Badge>Em andamento</Badge>;
  return <Badge className="bg-muted text-muted-foreground">Encerrado</Badge>;
}

export function CargaHorariaScreen() {
  const { me } = useAuth();
  const timeZone = me?.escritorio.fusoHorario ?? "America/Sao_Paulo";
  const mesAtual = useMemo(() => todayInTimeZone(timeZone).slice(0, 7), [timeZone]);
  const [mes, setMes] = useState(mesAtual);
  const [revision, setRevision] = useState(0);
  const [equipe, setEquipe] = useState<CargaFuncionario[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registros, setRegistros] = useState<RegistroPonto[] | null>(null);
  const [registrosLoading, setRegistrosLoading] = useState(false);
  const [registrosError, setRegistrosError] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<RegistroPonto | null>(null);
  const now = useNow();

  useEffect(() => {
    let active = true;
    api
      .get<CargaFuncionario[]>(withQuery("/sessoes-acesso/equipe", { mes }))
      .then((response) => {
        if (active) setEquipe(response);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar a carga horária.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mes, revision]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    api
      .get<RegistroPonto[]>(withQuery(`/sessoes-acesso/usuarios/${selectedId}`, { mes }))
      .then((response) => {
        if (active) setRegistros(response);
      })
      .catch((cause: unknown) => {
        if (active) setRegistrosError(cause instanceof ApiError ? cause.message : "Não foi possível carregar os registros.");
      })
      .finally(() => {
        if (active) setRegistrosLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, mes, revision]);

  function reloadAll() {
    setLoading(true);
    setError(null);
    if (selectedId) {
      setRegistrosLoading(true);
      setRegistrosError(null);
    }
  }

  function changeMonth(next: string) {
    if (!next || next === mes || next > mesAtual) return;
    reloadAll();
    setRegistros(null);
    setMes(next);
  }

  function select(id: string | null) {
    if (id === selectedId) return;
    setRegistros(null);
    setRegistrosError(null);
    setRegistrosLoading(Boolean(id));
    setSelectedId(id);
  }

  const selecionado = equipe?.find((item) => item.usuarioId === selectedId) ?? null;
  const diasComHoras = selecionado?.dias.filter((dia) => dia.totalMs > 0) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Carga horária</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tempo de ponto da equipe, do login ao logout, no fuso do escritório. Registros pendentes ficaram sem
            sinal por 15 min e contam até o último sinal até alguém informar a saída.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeMonth(shiftMonth(mes, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <div className="space-y-1">
            <Label htmlFor="carga-mes" className="sr-only">
              Mês
            </Label>
            <Input
              id="carga-mes"
              type="month"
              value={mes}
              max={mesAtual}
              onChange={(event) => changeMonth(event.target.value)}
              className="w-48"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeMonth(shiftMonth(mes, 1))}
            disabled={mes >= mesAtual}
            aria-label="Próximo mês"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <section aria-label="Funcionários" className={selectedId ? "hidden lg:block" : ""}>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">{formatMonth(mes)}</h2>
          {loading && !equipe ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : equipe && equipe.length > 0 ? (
            <ul className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
              {equipe.map((item) => {
                const active = item.usuarioId === selectedId;
                return (
                  <li key={item.usuarioId}>
                    <button
                      type="button"
                      onClick={() => select(item.usuarioId)}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                        active ? "border-primary/40 bg-accent" : "bg-card hover:bg-accent/50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.usuarioNome}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{PERFIL_LABELS[item.perfil]}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold tabular-nums">{formatHoursMinutes(item.totalMesMs)}</span>
                        {item.pendentes > 0 ? (
                          <Badge className="bg-amber-100 text-amber-900">
                            {item.pendentes} {item.pendentes === 1 ? "pendente" : "pendentes"}
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : equipe ? (
            <div className="rounded-xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
              Nenhum funcionário encontrado.
            </div>
          ) : null}
        </section>

        <section aria-label="Detalhe do funcionário" className={selectedId ? "" : "hidden lg:block"}>
          {!selecionado ? (
            <div className="rounded-xl border bg-card px-6 py-14 text-center">
              <CalendarClock className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-4 font-semibold">Selecione um funcionário</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Veja os totais por dia e as entradas e saídas do mês.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <Button variant="ghost" size="sm" className="-ml-2 mb-2 lg:hidden" onClick={() => select(null)}>
                  <ArrowLeft aria-hidden="true" /> Funcionários
                </Button>
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4 sm:p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                      <UserRound className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold">{selecionado.usuarioNome}</h2>
                      <p className="text-xs text-muted-foreground">{PERFIL_LABELS[selecionado.perfil]}</p>
                    </div>
                  </div>
                  <dl className="flex gap-6 text-right">
                    <div>
                      <dt className="text-xs text-muted-foreground">Total do mês</dt>
                      <dd className="text-lg font-semibold tabular-nums">{formatHoursMinutes(selecionado.totalMesMs)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Pendentes</dt>
                      <dd className={`text-lg font-semibold tabular-nums ${selecionado.pendentes > 0 ? "text-amber-800" : ""}`}>
                        {selecionado.pendentes}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Por dia</h3>
                {diasComHoras.length > 0 ? (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {diasComHoras.map((dia) => (
                      <li
                        key={dia.data}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
                      >
                        <span className="capitalize text-muted-foreground">{formatDay(dia.data)}</span>
                        <span className="font-medium tabular-nums">{formatHoursMinutes(dia.totalMs)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Sem horas registradas neste mês.</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold">Registros</h3>
                {registrosError ? (
                  <div className="mt-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
                    {registrosError}
                  </div>
                ) : registrosLoading && !registros ? (
                  <div className="mt-3 space-y-2">
                    {Array.from({ length: 4 }, (_, index) => (
                      <Skeleton key={index} className="h-16 w-full" />
                    ))}
                  </div>
                ) : registros && registros.length > 0 ? (
                  <ul className={`mt-3 space-y-2 ${registrosLoading ? "opacity-60" : ""}`}>
                    {registros.map((registro) => {
                      const aberto = !registro.fim && !registro.pendente;
                      const duracaoMs = aberto
                        ? Math.max(0, now - new Date(registro.inicio).getTime())
                        : registro.duracaoMs;
                      return (
                        <li
                          key={registro.id}
                          className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{formatDateInTimeZone(registro.inicio, timeZone)}</p>
                              <StatusRegistro registro={registro} />
                            </div>
                            <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                              Entrada {formatTimeInTimeZone(registro.inicio, timeZone)}
                              <span aria-hidden="true"> · </span>
                              Saída{" "}
                              {registro.fim
                                ? `${formatTimeInTimeZone(registro.fim, timeZone)}${
                                    formatDateInTimeZone(registro.fim, timeZone) !==
                                    formatDateInTimeZone(registro.inicio, timeZone)
                                      ? ` (${formatDateInTimeZone(registro.fim, timeZone)})`
                                      : ""
                                  }`
                                : "—"}
                              {registro.pendente && registro.ultimoSinal
                                ? ` · último sinal ${formatTimeInTimeZone(registro.ultimoSinal, timeZone)}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                              <Clock3 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                              {formatClock(duracaoMs)}
                            </span>
                            {registro.pendente ? (
                              <Button size="sm" variant="outline" onClick={() => setAjuste(registro)}>
                                Informar saída
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : registros ? (
                  <p className="mt-2 text-sm text-muted-foreground">Nenhum registro neste mês.</p>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>

      {ajuste ? (
        <InformarSaidaDialog
          registro={ajuste}
          timeZone={timeZone}
          onClose={() => setAjuste(null)}
          onSaved={() => {
            setAjuste(null);
            reloadAll();
            setRevision((current) => current + 1);
          }}
        />
      ) : null}
    </div>
  );
}
