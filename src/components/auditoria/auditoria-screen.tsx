"use client";

import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, withQuery } from "@/lib/api";
import type { Pagina } from "@/types/api";
import type { AuditoriaItem } from "@/types/admin";

const PAGE_SIZE = 20;

interface Filters {
  empresaId: string;
  usuarioId: string;
  entidade: string;
  entidadeId: string;
  acao: string;
  de: string;
  ate: string;
}

const EMPTY_FILTERS: Filters = {
  empresaId: "",
  usuarioId: "",
  entidade: "",
  entidadeId: "",
  acao: "",
  de: "",
  ate: "",
};

function toInstant(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function AuditoriaScreen() {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [result, setResult] = useState<Pagina<AuditoriaItem> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const path = withQuery("/auditoria", {
      empresaId: filters.empresaId,
      usuarioId: filters.usuarioId,
      entidade: filters.entidade,
      entidadeId: filters.entidadeId,
      acao: filters.acao,
      de: toInstant(filters.de),
      ate: toInstant(filters.ate),
      pagina: page,
      porPagina: PAGE_SIZE,
    });
    api.get<Pagina<AuditoriaItem>>(path)
      .then((response) => { if (active) setResult(response); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar a auditoria."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page]);

  function update(field: keyof Filters, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPage(1);
    setFilters({ ...draft });
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setLoading(true);
    setError(null);
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.porPagina)) : 1;

  return (
    <div className="mx-auto max-w-6xl">
      <div><h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Auditoria</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Consulte, em ordem cronológica, as ações registradas no escritório.</p></div>

      <form onSubmit={applyFilters} className="mt-7 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2"><Label htmlFor="audit-action">Ação (prefixo)</Label><Input id="audit-action" value={draft.acao} onChange={(event) => update("acao", event.target.value)} placeholder="Ex.: usuario." /></div>
        <div className="space-y-2"><Label htmlFor="audit-entity">Entidade</Label><Input id="audit-entity" value={draft.entidade} onChange={(event) => update("entidade", event.target.value)} placeholder="Ex.: usuario" /></div>
        <div className="space-y-2"><Label htmlFor="audit-entity-id">ID da entidade</Label><Input id="audit-entity-id" value={draft.entidadeId} onChange={(event) => update("entidadeId", event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="audit-user">ID do usuário</Label><Input id="audit-user" value={draft.usuarioId} onChange={(event) => update("usuarioId", event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="audit-company">ID da empresa</Label><Input id="audit-company" value={draft.empresaId} onChange={(event) => update("empresaId", event.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="audit-from">De</Label><Input id="audit-from" type="datetime-local" value={draft.de} onChange={(event) => update("de", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="audit-to">Até</Label><Input id="audit-to" type="datetime-local" value={draft.ate} onChange={(event) => update("ate", event.target.value)} /></div></div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><Button type="submit"><Search aria-hidden="true" /> Aplicar filtros</Button><Button type="button" variant="outline" onClick={clearFilters}>Limpar</Button></div>
      </form>

      {error ? <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div> : null}

      <section className="mt-7" aria-label="Linha do tempo da auditoria">
        {loading ? <div className="space-y-4">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-28 w-full" />)}</div> : result && result.dados.length > 0 ? (
          <ol className="relative ml-3 border-l">
            {result.dados.map((item) => (
              <li key={item.id} className="relative pb-7 pl-7 last:pb-0">
                <span className="absolute -left-1.5 top-2 size-3 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
                <article className="rounded-xl border bg-card p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{item.acao}</Badge><span className="text-sm text-muted-foreground">{item.entidade}{item.entidadeId ? ` · ${item.entidadeId}` : ""}</span></div><p className="mt-3 text-sm font-medium">{item.descricao ?? "Ação registrada sem descrição."}</p></div><time className="shrink-0 text-xs tabular-nums text-muted-foreground" dateTime={item.criadoEm}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(item.criadoEm))}</time></div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">{item.usuarioId ? <span>Usuário: {item.usuarioId}</span> : null}{item.empresaId ? <span>Empresa: {item.empresaId}</span> : null}{item.ip ? <span>IP: {item.ip}</span> : null}</div>
                  {item.dados && Object.keys(item.dados).length > 0 ? <details className="mt-3 text-xs"><summary className="cursor-pointer font-medium text-muted-foreground">Ver dados técnicos</summary><pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(item.dados, null, 2)}</pre></details> : null}
                </article>
              </li>
            ))}
          </ol>
        ) : <div className="rounded-xl border bg-card px-6 py-14 text-center"><History className="mx-auto size-10 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 font-semibold">Nenhum evento encontrado</h2><p className="mt-2 text-sm text-muted-foreground">Ajuste os filtros para ampliar a consulta.</p></div>}
      </section>

      {result && result.total > 0 ? <div className="mt-5 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>{result.total} {result.total === 1 ? "evento" : "eventos"}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => { setLoading(true); setPage(page - 1); }} disabled={page <= 1 || loading}><ChevronLeft aria-hidden="true" /> Anterior</Button><span className="px-2 tabular-nums">Página {page} de {totalPages}</span><Button variant="outline" size="sm" onClick={() => { setLoading(true); setPage(page + 1); }} disabled={page >= totalPages || loading}>Próxima <ChevronRight aria-hidden="true" /></Button></div></div> : null}
    </div>
  );
}
