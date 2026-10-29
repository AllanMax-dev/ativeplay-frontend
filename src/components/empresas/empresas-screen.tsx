"use client";

import { Building2, ChevronLeft, ChevronRight, LogIn, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { EmpresaFormDialog } from "@/components/empresas/empresa-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canReadModule, canWriteModule } from "@/lib/access-control";
import { api, ApiError, withQuery } from "@/lib/api";
import type { Pagina } from "@/types/api";
import type { EmpresaDetalhe, EmpresaResumo, StatusEmpresa } from "@/types/empresa";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<StatusEmpresa, string> = {
  ONBOARDING: "Em implantação",
  ATIVA: "Ativa",
  SUSPENSA: "Suspensa",
  ENCERRADA: "Encerrada",
};

function formatCurrency(value?: number): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function EmpresasScreen() {
  const { me } = useAuth();
  const [result, setResult] = useState<Pagina<EmpresaResumo> | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmpresaDetalhe | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const canWrite = me ? canWriteModule(me, "EMPRESAS") : false;
  const canOpenTasks = me ? canReadModule(me, "TAREFAS") : false;
  const showActions = canWrite || canOpenTasks;

  useEffect(() => {
    let active = true;
    const path = withQuery("/empresas", {
      busca: query,
      pagina: page,
      porPagina: PAGE_SIZE,
    });

    api
      .get<Pagina<EmpresaResumo>>(path)
      .then((response) => {
        if (active) setResult(response);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause.message
              : "Não foi possível carregar as empresas.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, query, revision]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPage(1);
    setQuery(search.trim());
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  async function openEdit(id: string) {
    setLoadingDetailId(id);
    setError(null);
    try {
      setEditing(await api.get<EmpresaDetalhe>(`/empresas/${id}`));
      setFormOpen(true);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível carregar os dados da empresa.",
      );
    } finally {
      setLoadingDetailId(null);
    }
  }

  function handleSaved() {
    setFormOpen(false);
    setEditing(null);
    setLoading(true);
    setRevision((current) => current + 1);
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.porPagina)) : 1;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Empresas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Consulte a carteira visível para seu perfil e acompanhe tarefas abertas e atrasadas.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={openCreate}><Plus aria-hidden="true" /> Nova empresa</Button>
        ) : null}
      </div>

      <form onSubmit={handleSearch} className="mt-7 flex max-w-xl gap-2" role="search">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por razão social, nome ou CNPJ"
          aria-label="Buscar empresas"
          className="h-10"
        />
        <Button type="submit" variant="outline" className="h-10">
          <Search aria-hidden="true" /> Buscar
        </Button>
      </form>

      {error ? (
        <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-label="Lista de empresas">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : result && result.dados.length > 0 ? (
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Honorário</TableHead>
                <TableHead className="text-right">Hoje</TableHead>
                <TableHead className="text-right">Atrasadas</TableHead>
                {showActions ? <TableHead className="pr-5 text-right">Ações</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.dados.map((empresa) => (
                <TableRow key={empresa.id}>
                  <TableCell className="pl-5">
                    <p className="font-medium">{empresa.nomeFantasia || empresa.razaoSocial}</p>
                    {empresa.nomeFantasia ? (
                      <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">{empresa.razaoSocial}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums">{empresa.cnpjFormatado}</TableCell>
                  <TableCell>
                    <Badge variant={empresa.status === "ATIVA" ? "secondary" : "outline"}>
                      {STATUS_LABELS[empresa.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{empresa.responsavel?.nome ?? "Não definido"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(empresa.honorarioMensal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{empresa.tarefasAbertasHoje}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={empresa.tarefasAtrasadas > 0 ? "font-medium text-destructive" : ""}>
                      {empresa.tarefasAtrasadas}
                    </span>
                  </TableCell>
                  {showActions ? (
                    <TableCell className="pr-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canOpenTasks ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            render={<Link href={`/tarefas?empresa=${empresa.id}`} />}
                            nativeButton={false}
                            title="Entrar no cliente: tarefas do dia, checklist e senhas salvas"
                          >
                            <LogIn aria-hidden="true" /> Abrir
                          </Button>
                        ) : null}
                        {canWrite ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(empresa.id)}
                            disabled={loadingDetailId === empresa.id}
                          >
                            <Pencil aria-hidden="true" />
                            {loadingDetailId === empresa.id ? "Abrindo..." : "Editar"}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-6 py-14 text-center">
            <Building2 className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">Nenhuma empresa encontrada</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {query ? "Tente buscar por outro nome ou CNPJ." : "Sua carteira ainda não possui empresas."}
            </p>
          </div>
        )}
      </section>

      {result && result.total > 0 ? (
        <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{result.total} {result.total === 1 ? "empresa" : "empresas"}</p>
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

      {formOpen ? (
        <EmpresaFormDialog
          key={editing?.id ?? "nova"}
          empresa={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
