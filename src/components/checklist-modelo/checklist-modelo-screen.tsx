"use client";

import { ArrowDown, ArrowUp, ClipboardCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ChecklistModeloFormDialog } from "@/components/checklist-modelo/checklist-modelo-form-dialog";
import { PRIORITY_LABELS } from "@/components/tarefas/task-rule-fields";
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
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { ChecklistModeloItem } from "@/types/checklist-modelo";

function deadlineLabel(days?: number | null): string {
  if (days == null) return "Sem prazo";
  if (days === 0) return "No dia do cadastro";
  return `${days} ${days === 1 ? "dia" : "dias"} após o cadastro`;
}

export function ChecklistModeloScreen() {
  const [items, setItems] = useState<ChecklistModeloItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistModeloItem | null>(null);
  const [deleting, setDeleting] = useState<ChecklistModeloItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<ChecklistModeloItem[]>("/checklist-modelo")
      .then((response) => {
        if (active) setItems(response);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o checklist modelo.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function handleSaved(saved: ChecklistModeloItem) {
    setItems((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved];
    });
    setFormOpen(false);
    setEditing(null);
  }

  async function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setBusyId(items[index].id);
    setError(null);
    try {
      const saved = await api.patch<ChecklistModeloItem[], { ids: string[] }>("/checklist-modelo/ordem", {
        ids: reordered.map((item) => item.id),
      });
      setItems(saved);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível alterar a ordem do modelo.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setBusyId(target.id);
    setDeleteError(null);
    try {
      await api.delete(`/checklist-modelo/${target.id}`);
      setItems((current) => current.filter((item) => item.id !== target.id));
      setDeleting(null);
    } catch (cause) {
      setDeleteError(cause instanceof ApiError ? cause.message : "Não foi possível excluir o item do modelo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Checklist modelo</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Organize as etapas padrão do início do atendimento de cada cliente.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus aria-hidden="true" /> Novo item
        </Button>
      </div>

      <div className="mt-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Todo cliente novo recebe uma cópia deste modelo. Alterar o modelo não muda os clientes já cadastrados.
      </div>

      {error ? (
        <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground" role="alert">
          {error}
        </div>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-label="Itens do checklist modelo">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 w-full" />)}
          </div>
        ) : items.length > 0 ? (
          <ol className="divide-y">
            {items.map((item, index) => (
              <li key={item.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:px-6">
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0 || busyId !== null}
                    onClick={() => void move(index, -1)}
                    aria-label={`Subir ${item.titulo}`}
                    title="Subir item"
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === items.length - 1 || busyId !== null}
                    onClick={() => void move(index, 1)}
                    aria-label={`Descer ${item.titulo}`}
                    title="Descer item"
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Item {index + 1}</Badge>
                    <Badge variant={item.prioridade === "URGENTE" ? "destructive" : "secondary"}>
                      {PRIORITY_LABELS[item.prioridade]}
                    </Badge>
                    <Badge variant="outline">{deadlineLabel(item.prazoDias)}</Badge>
                  </div>
                  <h2 className="mt-3 font-semibold">{item.titulo}</h2>
                  {item.observacoes ? (
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{item.observacoes}</p>
                  ) : null}
                  {item.subitens.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                      {item.subitens.map((subitem) => (
                        <li key={subitem.id} className="flex gap-2">
                          <span aria-hidden="true">•</span>
                          <span>{subitem.texto}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Sem sub-itens.</p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => { setEditing(item); setFormOpen(true); }}
                    disabled={busyId !== null}
                    aria-label={`Editar ${item.titulo}`}
                    title="Editar"
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => { setDeleting(item); setDeleteError(null); }}
                    disabled={busyId !== null}
                    aria-label={`Excluir ${item.titulo}`}
                    title="Excluir"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-6 py-14 text-center">
            <ClipboardCheck className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 font-semibold">Nenhum item no modelo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Adicione o primeiro item que todo cliente novo deve receber.
            </p>
          </div>
        )}
      </section>

      {formOpen ? (
        <ChecklistModeloFormDialog
          key={editing?.id ?? "novo"}
          item={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={handleSaved}
        />
      ) : null}

      {deleting ? (
        <Dialog open onOpenChange={(open) => { if (!open) { setDeleting(null); setDeleteError(null); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir item do modelo</DialogTitle>
              <DialogDescription>
                O item {deleting.titulo} e seus sub-itens serão removidos do modelo. Os clientes já cadastrados não serão alterados.
              </DialogDescription>
            </DialogHeader>
            {deleteError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground" role="alert">
                {deleteError}
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleting(null); setDeleteError(null); }} disabled={busyId === deleting.id}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={busyId === deleting.id}>
                {busyId === deleting.id ? "Excluindo..." : "Excluir item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
