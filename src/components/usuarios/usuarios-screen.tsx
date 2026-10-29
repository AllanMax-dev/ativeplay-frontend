"use client";

import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { UsuarioFormDialog } from "@/components/usuarios/usuario-form-dialog";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canWriteModule } from "@/lib/access-control";
import { api, ApiError, withQuery } from "@/lib/api";
import type { Pagina, Perfil } from "@/types/api";
import type { EmpresaResumo } from "@/types/empresa";
import type {
  SenhaTemporariaResposta,
  Setor,
  UsuarioDetalhe,
  UsuarioEmpresa,
  UsuarioLista,
} from "@/types/admin";

const PAGE_SIZE = 10;

const PROFILE_LABELS: Record<Perfil, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  OPERADOR: "Operador",
  CLIENTE: "Cliente",
};

interface Filters {
  perfil: Perfil | "TODOS";
  ativo: "TODOS" | "ATIVOS" | "INATIVOS";
  setorId: string;
}

type Confirmation =
  | { kind: "ativo"; usuario: UsuarioLista }
  | { kind: "senha"; usuario: UsuarioLista };

export function UsuariosScreen() {
  const { me } = useAuth();
  const [result, setResult] = useState<Pagina<UsuarioLista> | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Filters>({ perfil: "TODOS", ativo: "TODOS", setorId: "TODOS" });
  const [filters, setFilters] = useState<Filters>(draft);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [empresas, setEmpresas] = useState<UsuarioEmpresa[]>([]);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UsuarioDetalhe | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [acting, setActing] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const canWrite = me ? canWriteModule(me, "USUARIOS") : false;

  useEffect(() => {
    let active = true;
    api.get<Setor[]>("/setores")
      .then((response) => {
        if (active) setSetores(response.filter((setor) => setor.ativo));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!canWrite) return;
    let active = true;
    api.get<Pagina<EmpresaResumo>>(withQuery("/empresas", { pagina: 1, porPagina: 100 }))
      .then((response) => {
        if (active) setEmpresas(response.dados.map(({ id, razaoSocial }) => ({ id, razaoSocial })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [canWrite]);

  useEffect(() => {
    let active = true;
    const path = withQuery("/usuarios", {
      busca: query,
      perfil: filters.perfil === "TODOS" ? undefined : filters.perfil,
      ativo: filters.ativo === "TODOS" ? undefined : filters.ativo === "ATIVOS",
      setorId: filters.setorId === "TODOS" ? undefined : filters.setorId,
      pagina: page,
      porPagina: PAGE_SIZE,
    });
    api.get<Pagina<UsuarioLista>>(path)
      .then((response) => { if (active) setResult(response); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar os usuários.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page, query, revision]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPage(1);
    setQuery(search.trim());
    setFilters({ ...draft });
  }

  async function openEdit(id: string) {
    setLoadingDetailId(id);
    setError(null);
    try {
      setEditing(await api.get<UsuarioDetalhe>(`/usuarios/${id}`));
      setFormOpen(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o usuário.");
    } finally {
      setLoadingDetailId(null);
    }
  }

  function handleSaved(senhaTemporaria?: string) {
    setFormOpen(false);
    setEditing(null);
    if (senhaTemporaria) setTemporaryPassword(senhaTemporaria);
    setLoading(true);
    setRevision((current) => current + 1);
  }

  async function confirmAction() {
    if (!confirmation) return;
    setActing(true);
    setError(null);
    try {
      if (confirmation.kind === "ativo") {
        await api.patch<UsuarioDetalhe, { ativo: boolean }>(`/usuarios/${confirmation.usuario.id}/ativo`, {
          ativo: !confirmation.usuario.ativo,
        });
        setLoading(true);
        setRevision((current) => current + 1);
      } else {
        const response = await api.post<SenhaTemporariaResposta>(
          `/usuarios/${confirmation.usuario.id}/redefinir-senha`,
        );
        setTemporaryPassword(response.senhaTemporaria);
      }
      setConfirmation(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível concluir a ação.");
    } finally {
      setActing(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.porPagina)) : 1;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Usuários</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Gerencie acessos, setores e carteiras da equipe e do portal do cliente.</p>
        </div>
        {canWrite ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus aria-hidden="true" /> Novo usuário</Button> : null}
      </div>

      <form onSubmit={applyFilters} className="mt-7 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 xl:grid-cols-[1fr_11rem_11rem_13rem_auto]" role="search">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuários" />
        <Select value={draft.perfil} onValueChange={(value) => setDraft((current) => ({ ...current, perfil: value as Filters["perfil"] }))}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os perfis</SelectItem>
            {Object.entries(PROFILE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={draft.ativo} onValueChange={(value) => setDraft((current) => ({ ...current, ativo: value as Filters["ativo"] }))}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="TODOS">Todos os status</SelectItem><SelectItem value="ATIVOS">Ativos</SelectItem><SelectItem value="INATIVOS">Inativos</SelectItem></SelectContent>
        </Select>
        <Select value={draft.setorId} onValueChange={(value) => setDraft((current) => ({ ...current, setorId: value ?? "TODOS" }))}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="TODOS">Todos os setores</SelectItem>{setores.map((setor) => <SelectItem key={setor.id} value={setor.id}>{setor.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="submit" variant="outline"><Search aria-hidden="true" /> Filtrar</Button>
      </form>

      {error ? <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div> : null}

      <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-label="Lista de usuários">
        {loading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>
        ) : result && result.dados.length > 0 ? (
          <Table className="min-w-[980px]">
            <TableHeader><TableRow><TableHead className="pl-5">Usuário</TableHead><TableHead>Perfil</TableHead><TableHead>Setores</TableHead><TableHead>Carteira</TableHead><TableHead>Último acesso</TableHead><TableHead>Status</TableHead>{canWrite ? <TableHead className="pr-5 text-right">Ações</TableHead> : null}</TableRow></TableHeader>
            <TableBody>
              {result.dados.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell className="pl-5"><p className="font-medium">{usuario.nome}</p><p className="mt-1 text-xs text-muted-foreground">{usuario.email}</p></TableCell>
                  <TableCell>{PROFILE_LABELS[usuario.perfil]}</TableCell>
                  <TableCell><span className="line-clamp-2 max-w-52 text-sm">{usuario.setores.length ? usuario.setores.join(", ") : "—"}</span></TableCell>
                  <TableCell className="tabular-nums">{usuario.perfil === "OPERADOR" ? `${usuario.empresasNaCarteira} empresa(s)` : "—"}</TableCell>
                  <TableCell className="tabular-nums">{usuario.ultimoAcesso ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(usuario.ultimoAcesso)) : "Nunca"}</TableCell>
                  <TableCell><Badge variant={usuario.ativo ? "secondary" : "outline"}>{usuario.ativo ? "Ativo" : "Inativo"}</Badge></TableCell>
                  {canWrite ? (
                    <TableCell className="pr-5"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${usuario.nome}`} onClick={() => openEdit(usuario.id)} disabled={loadingDetailId === usuario.id}><Pencil aria-hidden="true" /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Redefinir senha de ${usuario.nome}`} onClick={() => setConfirmation({ kind: "senha", usuario })}><KeyRound aria-hidden="true" /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`${usuario.ativo ? "Desativar" : "Ativar"} ${usuario.nome}`} onClick={() => setConfirmation({ kind: "ativo", usuario })} disabled={usuario.id === me?.id}>{usuario.ativo ? <UserRoundX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}</Button>
                    </div></TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="px-6 py-14 text-center"><Users className="mx-auto size-10 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 font-semibold">Nenhum usuário encontrado</h2><p className="mt-2 text-sm text-muted-foreground">Ajuste os filtros para consultar outros acessos.</p></div>
        )}
      </section>

      {result && result.total > 0 ? <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>{result.total} {result.total === 1 ? "usuário" : "usuários"}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => { setLoading(true); setPage(page - 1); }} disabled={page <= 1 || loading}><ChevronLeft aria-hidden="true" /> Anterior</Button><span className="px-2 tabular-nums">Página {page} de {totalPages}</span><Button variant="outline" size="sm" onClick={() => { setLoading(true); setPage(page + 1); }} disabled={page >= totalPages || loading}>Próxima <ChevronRight aria-hidden="true" /></Button></div></div> : null}

      {formOpen && me ? <UsuarioFormDialog key={editing?.id ?? "novo"} usuario={editing} setores={setores} empresas={empresas} perfilAtual={me.perfil} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={handleSaved} /> : null}

      {confirmation ? <Dialog open onOpenChange={(open) => !open && setConfirmation(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{confirmation.kind === "senha" ? "Redefinir senha" : confirmation.usuario.ativo ? "Desativar usuário" : "Ativar usuário"}</DialogTitle><DialogDescription>{confirmation.kind === "senha" ? `Uma nova senha temporária será gerada para ${confirmation.usuario.nome} e todas as sessões atuais serão encerradas.` : `${confirmation.usuario.nome} será ${confirmation.usuario.ativo ? "desativado e terá as sessões encerradas" : "reativado"}.`}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmation(null)} disabled={acting}>Cancelar</Button><Button onClick={confirmAction} disabled={acting}>{acting ? "Aguarde..." : "Confirmar"}</Button></DialogFooter></DialogContent></Dialog> : null}

      {temporaryPassword ? <Dialog open onOpenChange={(open) => !open && setTemporaryPassword(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Senha temporária gerada</DialogTitle><DialogDescription>Esta senha é exibida uma única vez. Entregue-a ao usuário por um canal seguro.</DialogDescription></DialogHeader><div className="rounded-lg bg-muted px-4 py-3 text-center text-lg font-semibold" aria-label="Senha temporária">{temporaryPassword}</div><DialogFooter><Button onClick={() => setTemporaryPassword(null)}>Entendi</Button></DialogFooter></DialogContent></Dialog> : null}
    </div>
  );
}
