"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { formatCurrencyBRL, formatHoursMinutes, formatLocalDate } from "@/lib/format";
import type { Rentabilidade } from "@/types/cliente";

/**
 * Horas do contador geral por cliente × honorário (ADMIN e GESTOR): mostra quais clientes
 * demandam mais tempo do que pagam, para avaliar a margem de cada um na operação.
 */
export function RentabilidadeSection() {
  const { me } = useAuth();
  const allowed = me?.perfil === "ADMIN" || me?.perfil === "GESTOR";
  const [data, setData] = useState<Rentabilidade | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    api
      .get<Rentabilidade>("/sessoes/rentabilidade")
      .then((response) => {
        if (active) setData(response);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o comparativo.");
      });
    return () => {
      active = false;
    };
  }, [allowed]);

  if (!allowed) return null;

  const maxMs = Math.max(1, ...(data?.empresas.map((item) => item.totalMs) ?? [1]));
  const valoresHora = data?.empresas.map((item) => item.valorHora).filter((v): v is number => typeof v === "number") ?? [];
  const mediaHora = valoresHora.length ? valoresHora.reduce((a, b) => a + b, 0) / valoresHora.length : null;

  return (
    <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-labelledby="profit-title">
      <div className="flex flex-col gap-1 p-5 sm:p-6">
        <h2 id="profit-title" className="flex items-center gap-2 text-base font-semibold">
          <Timer className="size-4 text-primary" aria-hidden="true" /> Tempo por cliente × honorário
        </h2>
        <p className="text-sm text-muted-foreground">
          {data
            ? `Contador geral de ${formatLocalDate(data.de)} a ${formatLocalDate(data.ate)} · ${formatHoursMinutes(data.totalMs)} no total.`
            : "Horas registradas pelo contador geral nos últimos 30 dias."}{" "}
          O valor por hora é o honorário proporcional ao período dividido pelas horas trabalhadas.
        </p>
      </div>
      {error ? (
        <p className="px-5 pb-5 text-sm text-destructive sm:px-6">{error}</p>
      ) : !data ? (
        <div className="space-y-2 px-5 pb-5 sm:px-6">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-9 w-full" />)}
        </div>
      ) : data.empresas.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground sm:px-6">Ainda não há tempo registrado no período.</p>
      ) : (
        <>
        <div className="hidden md:block">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5 sm:pl-6">Empresa</TableHead>
              <TableHead>Horas</TableHead>
              <TableHead className="text-right">Pessoas</TableHead>
              <TableHead className="text-right">Honorário</TableHead>
              <TableHead className="pr-5 text-right sm:pr-6">Valor/hora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.empresas.map((item) => {
              const abaixo = mediaHora !== null && typeof item.valorHora === "number" && item.valorHora < mediaHora * 0.6;
              return (
                <TableRow key={item.empresaId}>
                  <TableCell className="pl-5 font-medium sm:pl-6">{item.empresaNome}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(item.totalMs / maxMs) * 100}%` }} />
                      </div>
                      <span className="text-sm tabular-nums">{formatHoursMinutes(item.totalMs)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.pessoas}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {typeof item.honorarioMensal === "number" ? formatCurrencyBRL(item.honorarioMensal) : "—"}
                  </TableCell>
                  <TableCell className={`pr-5 text-right font-medium tabular-nums sm:pr-6 ${abaixo ? "text-destructive" : ""}`}>
                    {typeof item.valorHora === "number" ? formatCurrencyBRL(item.valorHora) : "—"}
                    {abaixo ? <span className="sr-only"> (abaixo da média)</span> : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
        {/* No celular: empresa e valor/hora na linha 1; horas, pessoas e honorário na linha 2. */}
        <ul className="divide-y border-t md:hidden">
          {data.empresas.map((item) => {
            const abaixo = mediaHora !== null && typeof item.valorHora === "number" && item.valorHora < mediaHora * 0.6;
            return (
              <li key={item.empresaId} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">{item.empresaNome}</p>
                  <span className={`shrink-0 text-sm font-medium tabular-nums ${abaixo ? "text-destructive" : ""}`}>
                    {typeof item.valorHora === "number" ? formatCurrencyBRL(item.valorHora) : "—"}
                    {abaixo ? <span className="sr-only"> (abaixo da média)</span> : null}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[13px] tabular-nums text-muted-foreground">
                  {formatHoursMinutes(item.totalMs)} · {item.pessoas} {item.pessoas === 1 ? "pessoa" : "pessoas"} ·{" "}
                  {typeof item.honorarioMensal === "number" ? formatCurrencyBRL(item.honorarioMensal) : "—"}
                </p>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </section>
  );
}
