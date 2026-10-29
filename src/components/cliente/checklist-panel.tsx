"use client";

import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CHECKLIST_PRIORITY_LABELS,
  ChecklistFormDialog,
} from "@/components/cliente/checklist-form-dialog";
import { useEquipeEmpresa } from "@/components/cliente/use-equipe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatLocalDate } from "@/lib/format";
import type { ChecklistItem } from "@/types/cliente";

type Aba = "PENDENTES" | "CONCLUIDOS";

/**
 * Checklist dentro do cliente: observações pontuais (ex.: "Cliente pendente de envio do
 * acesso bancário") com prazo, responsável e sub-itens. Abas "Pendentes" e "Concluídos".
 */
export function ChecklistPanel({
  empresaId,
  empresaNome,
  canWrite,
  onCountChange,
}: {
  empresaId: string;
  empresaNome: string;
  canWrite: boolean;
  /** Avisa a tela-mãe quantos itens pendentes existem (para o contador da aba). */
  onCountChange?: (pendentes: number) => void;
}) {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [aba, setAba] = useState<Aba>("PENDENTES");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  const [deleting, setDeleting] = useState<ChecklistItem | null>(null);
  const { team, loading: loadingTeam } = useEquipeEmpresa(empresaId);

  useEffect(() => {
    let active = true;
    api
      .get<ChecklistItem[]>(`/empresas/${empresaId}/checklist`)
      .then((response) => {
        if (active) setItems(response);
      })
      .catch((cause: unknown) => {
        if (active) {
          setItems([]);
          setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o checklist.");
        }
      });
    return () => {
      active = false;
    };
  }, [empresaId, revision]);

  const pendentes = useMemo(() => items?.filter((item) => !item.concluido) ?? [], [items]);
  const concluidos = useMemo(
    () =>
      (items?.filter((item) => item.concluido) ?? []).sort((a, b) =>
        (b.concluidoEm ?? "").localeCompare(a.concluidoEm ?? ""),
      ),
    [items],
  );

  useEffect(() => {
    if (items) onCountChange?.(pendentes.length);
  }, [items, onCountChange, pendentes.length]);

  const replace = useCallback((updated: ChecklistItem) => {
    setItems((current) => {
      if (!current) return [updated];
      const exists = current.some((item) => item.id === updated.id);
      return exists ? current.map((item) => (item.id === updated.id ? updated : item)) : [...current, updated];
    });
  }, []);

  async function run(item: ChecklistItem, action: () => Promise<ChecklistItem | void>) {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await action();
      if (updated) replace(updated);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível atualizar o item.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleItem(item: ChecklistItem) {
    void run(item, () =>
      api.post<ChecklistItem>(`/empresas/${empresaId}/checklist/${item.id}/${item.concluido ? "reabrir" : "concluir"}`),
    );
  }

  function toggleSubitem(item: ChecklistItem, subitemId: string, concluido: boolean) {
    // otimista: marca na hora e confirma com o servidor
    replace({
      ...item,
      subitens: item.subitens.map((sub) => (sub.id === subitemId ? { ...sub, concluido } : sub)),
      subitensConcluidos: item.subitensConcluidos + (concluido ? 1 : -1),
    });
    void run(item, () =>
      api.patch<ChecklistItem, { concluido: boolean }>(
        `/empresas/${empresaId}/checklist/${item.id}/subitens/${subitemId}`,
        { concluido },
      ),
    );
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setBusyId(target.id);
    setError(null);
    try {
      await api.delete(`/empresas/${empresaId}/checklist/${target.id}`);
      setItems((current) => current?.filter((item) => item.id !== target.id) ?? null);
      setDeleting(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível excluir o item.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = aba === "PENDENTES" ? pendentes : concluidos;

  return (
    <section className="overflow-hidden rounded-xl border bg-background" aria-labelledby="checklist-title">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 id="checklist-title" className="font-semibold">Checklist do cliente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Observações pontuais de {empresaNome}: informações ausentes, pendências do cliente e lembretes com prazo.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden="true" /> Adicionar item
          </Button>
        ) : null}
      </div>

      <div className="flex gap-1 border-b px-3 pt-2 sm:px-4" role="tablist" aria-label="Situação dos itens">
        {([
          ["PENDENTES", "Pendentes", pendentes.length],
          ["CONCLUIDOS", "Concluídos", concluidos.length],
        ] as const).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={aba === value}
            onClick={() => setAba(value)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              aba === value
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            <span
              className={`min-w-5 rounded-full px-1.5 text-xs tabular-nums ${
                aba === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <div className="mx-5 mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-6" role="alert">
          {error}
        </div>
      ) : null}

      {items === null ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}
        </div>
      ) : visible.length > 0 ? (
        <ul className="divide-y" role="tabpanel">
          {visible.map((item) => {
            const busy = busyId === item.id;
            return (
              <li key={item.id} className="flex gap-4 p-5 sm:px-6">
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => toggleItem(item)}
                    disabled={busy}
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-50 ${
                      item.concluido
                        ? "border-primary bg-primary text-primary-foreground hover:bg-primary/80"
                        : "border-primary/40 text-primary/50 hover:border-primary hover:text-primary"
                    }`}
                    aria-label={item.concluido ? `Reabrir ${item.titulo}` : `Concluir ${item.titulo}`}
                    title={item.concluido ? "Reabrir" : "Concluir"}
                  >
                    {item.concluido ? <RotateCcw className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
                  </button>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.atrasado ? "destructive" : "outline"}>
                      <CalendarClock aria-hidden="true" />
                      {item.prazo ? formatLocalDate(item.prazo) : "Sem prazo"}
                    </Badge>
                    {item.atrasado ? <Badge variant="destructive">Atrasado</Badge> : null}
                    {item.prioridade !== "MEDIA" ? (
                      <Badge variant={item.prioridade === "URGENTE" ? "destructive" : "secondary"}>
                        {CHECKLIST_PRIORITY_LABELS[item.prioridade]}
                      </Badge>
                    ) : null}
                    {item.subitens.length > 0 ? (
                      <Badge variant="secondary">
                        {item.subitensConcluidos}/{item.subitens.length}
                      </Badge>
                    ) : null}
                  </div>
                  <h3 className={`mt-2 font-semibold ${item.concluido ? "text-muted-foreground line-through" : ""}`}>
                    {item.titulo}
                  </h3>
                  {item.observacoes ? (
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{item.observacoes}</p>
                  ) : null}

                  {item.subitens.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {item.subitens.map((sub) => (
                        <li key={sub.id}>
                          <label className={`flex items-center gap-2 text-sm ${canWrite ? "cursor-pointer" : ""}`}>
                            <Checkbox
                              checked={sub.concluido}
                              disabled={!canWrite || busy}
                              onCheckedChange={(checked) => toggleSubitem(item, sub.id, checked)}
                            />
                            <span className={sub.concluido ? "text-muted-foreground line-through" : ""}>{sub.texto}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3" aria-hidden="true" />
                      {item.responsavel?.nome ?? "Sem responsável"}
                    </span>
                    {item.criadoPor?.nome ? <span>Criado por {item.criadoPor.nome}</span> : null}
                    {item.concluido && item.concluidoEm ? (
                      <span>
                        Concluído{item.concluidoPor?.nome ? ` por ${item.concluidoPor.nome}` : ""} em{" "}
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.concluidoEm))}
                      </span>
                    ) : null}
                  </p>
                </div>

                {canWrite ? (
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { setEditing(item); setFormOpen(true); }}
                      aria-label={`Editar ${item.titulo}`}
                      title="Editar"
                    >
                      <Pencil aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(item)}
                      aria-label={`Excluir ${item.titulo}`}
                      title="Excluir"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-6 py-14 text-center" role="tabpanel">
          <ClipboardCheck className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">
            {aba === "PENDENTES" ? "Nenhuma pendência neste cliente" : "Nenhum item concluído"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {aba === "PENDENTES"
              ? "Use o checklist para registrar o que falta receber do cliente ou observações pontuais."
              : "Os itens concluídos aparecem aqui, com quem concluiu e quando."}
          </p>
        </div>
      )}

      {formOpen ? (
        <ChecklistFormDialog
          key={editing?.id ?? "novo"}
          empresaId={empresaId}
          empresaNome={empresaNome}
          item={editing}
          team={team}
          loadingTeam={loadingTeam}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={(saved) => {
            replace(saved);
            setFormOpen(false);
            setEditing(null);
            if (!editing) setAba("PENDENTES");
            setRevision((current) => current + 1);
          }}
        />
      ) : null}

      {deleting ? (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir item do checklist</DialogTitle>
              <DialogDescription>
                O item {deleting.titulo} e seus sub-itens serão removidos. Para manter o histórico, prefira concluí-lo.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)} disabled={busyId === deleting.id}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={busyId === deleting.id}>
                {busyId === deleting.id ? "Excluindo..." : "Excluir item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
