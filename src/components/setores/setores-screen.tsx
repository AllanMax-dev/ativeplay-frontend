"use client";

import { ArrowDown, ArrowUp, Layers3, Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { canWriteModule } from "@/lib/access-control";
import { api, ApiError } from "@/lib/api";
import type { Setor, SetorRequest } from "@/types/admin";

function SetorForm({ setor, onClose, onSaved }: { setor: Setor | null; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(setor?.nome ?? "");
  const [cor, setCor] = useState(setor?.cor ?? "#0F766E");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload: SetorRequest = { nome: nome.trim(), cor };
    try {
      if (setor) await api.put<Setor, SetorRequest>(`/setores/${setor.id}`, payload);
      else await api.post<Setor, SetorRequest>("/setores", payload);
      onSaved();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError({ status: 0, detail: "Não foi possível salvar o setor." }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{setor ? "Editar setor" : "Novo setor"}</DialogTitle><DialogDescription>Defina um nome e uma cor para identificar o setor nas telas operacionais.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {error ? <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error.message}</div> : null}
          <div className="space-y-2"><Label htmlFor="setor-nome">Nome</Label><Input id="setor-nome" value={nome} onChange={(event) => setNome(event.target.value)} aria-invalid={Boolean(error?.campos?.nome)} required />{error?.campos?.nome ? <p className="text-sm text-destructive">{error.campos.nome}</p> : null}</div>
          <div className="space-y-2"><Label htmlFor="setor-cor">Cor</Label><div className="flex items-center gap-3"><Input id="setor-cor" type="color" value={cor} onChange={(event) => setCor(event.target.value)} className="h-10 w-16 p-1" /><Input value={cor.toUpperCase()} onChange={(event) => setCor(event.target.value)} aria-invalid={Boolean(error?.campos?.cor)} maxLength={7} /></div>{error?.campos?.cor ? <p className="text-sm text-destructive">{error.campos.cor}</p> : null}</div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : setor ? "Salvar alterações" : "Criar setor"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SetoresScreen() {
  const { me } = useAuth();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<Setor | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Setor | null>(null);
  const [busy, setBusy] = useState(false);
  const canWrite = me ? canWriteModule(me, "CONFIGURACOES") : false;

  useEffect(() => {
    let active = true;
    api.get<Setor[]>("/setores")
      .then((response) => { if (active) setSetores(response.filter((setor) => setor.ativo)); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar os setores."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  function refresh() {
    setFormOpen(false);
    setEditing(null);
    setLoading(true);
    setRevision((current) => current + 1);
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...setores];
    const destination = index + direction;
    [next[index], next[destination]] = [next[destination], next[index]];
    setBusy(true);
    setError(null);
    try {
      const response = await api.patch<Setor[], { ids: string[] }>("/setores/ordem", { ids: next.map((setor) => setor.id) });
      setSetores(response.filter((setor) => setor.ativo));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível alterar a ordem.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/setores/${deleting.id}`);
      setDeleting(null);
      refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível excluir o setor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Setores</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Organize a equipe por área e ajuste a ordem usada nas seleções do sistema.</p></div>{canWrite ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus aria-hidden="true" /> Novo setor</Button> : null}</div>
      {!canWrite ? <div className="mt-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Você pode consultar os setores, mas não alterá-los.</div> : null}
      {error ? <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div> : null}

      <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-label="Lista de setores">
        {loading ? <div className="space-y-3 p-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : setores.length > 0 ? (
          <div className="divide-y">{setores.map((setor, index) => (
            <article key={setor.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: setor.cor ?? "#94A3B8" }} aria-hidden="true" />
              <div className="min-w-0 flex-1"><h2 className="font-medium">{setor.nome}</h2><p className="mt-1 text-sm text-muted-foreground">{setor.membros} {setor.membros === 1 ? "membro" : "membros"}</p></div>
              {canWrite ? <div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Mover ${setor.nome} para cima`} onClick={() => move(index, -1)} disabled={busy || index === 0}><ArrowUp aria-hidden="true" /></Button><Button variant="ghost" size="icon-sm" aria-label={`Mover ${setor.nome} para baixo`} onClick={() => move(index, 1)} disabled={busy || index === setores.length - 1}><ArrowDown aria-hidden="true" /></Button><Button variant="ghost" size="icon-sm" aria-label={`Editar ${setor.nome}`} onClick={() => { setEditing(setor); setFormOpen(true); }}><Pencil aria-hidden="true" /></Button><Button variant="ghost" size="icon-sm" aria-label={`Excluir ${setor.nome}`} onClick={() => setDeleting(setor)}><Trash2 aria-hidden="true" /></Button></div> : null}
            </article>
          ))}</div>
        ) : <div className="px-6 py-14 text-center"><Layers3 className="mx-auto size-10 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 font-semibold">Nenhum setor cadastrado</h2><p className="mt-2 text-sm text-muted-foreground">Crie setores para distribuir usuários e responsabilidades.</p></div>}
      </section>

      {formOpen ? <SetorForm key={editing?.id ?? "novo"} setor={editing} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={refresh} /> : null}
      {deleting ? <Dialog open onOpenChange={(open) => !open && setDeleting(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Excluir setor</DialogTitle><DialogDescription>O setor {deleting.nome} deixará de aparecer nas seleções. O histórico já registrado será preservado.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>Cancelar</Button><Button variant="destructive" onClick={remove} disabled={busy}>{busy ? "Excluindo..." : "Excluir setor"}</Button></DialogFooter></DialogContent></Dialog> : null}
    </div>
  );
}
