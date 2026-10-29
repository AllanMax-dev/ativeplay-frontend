"use client";

import { ListPlus, Trash2 } from "lucide-react";
import { FormEvent, KeyboardEvent, useState } from "react";
import { PRIORITY_LABELS } from "@/components/tarefas/task-rule-fields";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { ChecklistModeloItem, ChecklistModeloRequest } from "@/types/checklist-modelo";
import type { Prioridade } from "@/types/tarefa";

interface DraftSubitem {
  key: string;
  id?: string;
  texto: string;
}

let draftCounter = 0;
function nextKey(): string {
  draftCounter += 1;
  return `novo-${draftCounter}`;
}

export function ChecklistModeloFormDialog({
  item,
  onClose,
  onSaved,
}: {
  item: ChecklistModeloItem | null;
  onClose: () => void;
  onSaved: (saved: ChecklistModeloItem) => void;
}) {
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [observacoes, setObservacoes] = useState(item?.observacoes ?? "");
  const [prioridade, setPrioridade] = useState<Prioridade>(item?.prioridade ?? "MEDIA");
  const [semPrazo, setSemPrazo] = useState(item?.prazoDias == null);
  const [prazoDias, setPrazoDias] = useState(item?.prazoDias?.toString() ?? "");
  const [subitens, setSubitens] = useState<DraftSubitem[]>(
    () => item?.subitens.map((subitem) => ({ key: subitem.id, id: subitem.id, texto: subitem.texto })) ?? [],
  );
  const [novoSubitem, setNovoSubitem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  function addSubitem() {
    const texto = novoSubitem.trim();
    if (!texto || subitens.length >= 50) return;
    setSubitens((current) => [...current, { key: nextKey(), texto }]);
    setNovoSubitem("");
  }

  function handleSubitemKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addSubitem();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!titulo.trim()) errors.titulo = "Informe o título do item.";
    const parsedPrazo = Number(prazoDias);
    if (!semPrazo && (!Number.isInteger(parsedPrazo) || parsedPrazo < 0 || parsedPrazo > 365)) {
      errors.prazoDias = "Informe um prazo entre 0 e 365 dias.";
    }
    if (subitens.some((subitem) => !subitem.texto.trim())) {
      errors.subitens = "Preencha ou remova os sub-itens vazios.";
    }
    if (subitens.length >= 50 && novoSubitem.trim()) {
      errors.subitens = "O modelo aceita no máximo 50 sub-itens.";
    }
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const pendingSubitem = novoSubitem.trim();
    const payload: ChecklistModeloRequest = {
      titulo: titulo.trim(),
      observacoes: observacoes.trim() || null,
      prioridade,
      prazoDias: semPrazo ? null : parsedPrazo,
      subitens: [
        ...subitens.map((subitem) => ({ id: subitem.id, texto: subitem.texto.trim() })),
        ...(pendingSubitem ? [{ texto: pendingSubitem }] : []),
      ],
    };

    setSubmitting(true);
    setError(null);
    try {
      const saved = item
        ? await api.put<ChecklistModeloItem, ChecklistModeloRequest>(`/checklist-modelo/${item.id}`, payload)
        : await api.post<ChecklistModeloItem, ChecklistModeloRequest>("/checklist-modelo", payload);
      onSaved(saved);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError({ status: 0, detail: "Não foi possível salvar o item do modelo." }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item do modelo" : "Novo item do modelo"}</DialogTitle>
          <DialogDescription>
            Defina o item que será copiado para o checklist de cada cliente novo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate>
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground" role="alert">
              {error.message}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="checklist-modelo-titulo">Título *</Label>
            <Input
              id="checklist-modelo-titulo"
              value={titulo}
              maxLength={200}
              autoFocus
              placeholder="Ex.: Solicitar documentos de admissão"
              aria-invalid={Boolean(clientErrors.titulo || error?.campos?.titulo)}
              aria-describedby={clientErrors.titulo || error?.campos?.titulo ? "checklist-modelo-titulo-erro" : undefined}
              onChange={(event) => {
                setTitulo(event.target.value);
                setClientErrors((current) => ({ ...current, titulo: "" }));
              }}
            />
            {clientErrors.titulo || error?.campos?.titulo ? (
              <p id="checklist-modelo-titulo-erro" className="text-sm text-destructive">{clientErrors.titulo || error?.campos?.titulo}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="checklist-modelo-prioridade">Prioridade</Label>
              <Select value={prioridade} onValueChange={(value) => value && setPrioridade(value as Prioridade)}>
                <SelectTrigger id="checklist-modelo-prioridade" className="w-full">
                  <SelectValue>{PRIORITY_LABELS[prioridade]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checklist-modelo-prazo">Prazo após o cadastro (dias)</Label>
              <Input
                id="checklist-modelo-prazo"
                type="number"
                min={0}
                max={365}
                value={prazoDias}
                disabled={semPrazo}
                placeholder="0"
                aria-invalid={Boolean(clientErrors.prazoDias || error?.campos?.prazoDias)}
                aria-describedby={clientErrors.prazoDias || error?.campos?.prazoDias ? "checklist-modelo-prazo-erro" : undefined}
                onChange={(event) => {
                  setPrazoDias(event.target.value);
                  setClientErrors((current) => ({ ...current, prazoDias: "" }));
                }}
              />
              {clientErrors.prazoDias || error?.campos?.prazoDias ? (
                <p id="checklist-modelo-prazo-erro" className="text-sm text-destructive">{clientErrors.prazoDias || error?.campos?.prazoDias}</p>
              ) : null}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={semPrazo}
                  onCheckedChange={(checked) => {
                    setSemPrazo(checked);
                    if (!checked && !prazoDias) setPrazoDias("0");
                  }}
                />
                Sem prazo
              </label>
            </div>
          </div>

          <fieldset
            className="space-y-3 rounded-lg border p-4"
            aria-describedby={clientErrors.subitens || error?.campos?.subitens ? "checklist-modelo-subitens-erro" : undefined}
          >
            <legend className="px-1 text-sm font-medium">Sub-itens</legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={novoSubitem}
                maxLength={200}
                onChange={(event) => setNovoSubitem(event.target.value)}
                onKeyDown={handleSubitemKeyDown}
                placeholder="Ex.: Conferir contrato social"
                aria-label="Novo sub-item do modelo"
              />
              <Button type="button" variant="outline" onClick={addSubitem} disabled={!novoSubitem.trim() || subitens.length >= 50}>
                <ListPlus aria-hidden="true" /> Adicionar
              </Button>
            </div>
            {subitens.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {subitens.map((subitem) => (
                  <li key={subitem.key} className="flex items-center gap-2 px-3 py-2">
                    <Input
                      value={subitem.texto}
                      maxLength={200}
                      aria-label="Texto do sub-item"
                      onChange={(event) => {
                        setSubitens((current) =>
                          current.map((candidate) =>
                            candidate.key === subitem.key ? { ...candidate, texto: event.target.value } : candidate,
                          ),
                        );
                        setClientErrors((current) => ({ ...current, subitens: "" }));
                      }}
                      className="h-8 border-transparent px-1 shadow-none focus-visible:border-ring"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover ${subitem.texto}`}
                      onClick={() => setSubitens((current) => current.filter((candidate) => candidate.key !== subitem.key))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-sm text-muted-foreground">Nenhum sub-item adicionado.</p>
            )}
            {subitens.length >= 50 ? (
              <p className="text-sm text-muted-foreground">Limite de 50 sub-itens atingido.</p>
            ) : null}
            {clientErrors.subitens || error?.campos?.subitens ? (
              <p id="checklist-modelo-subitens-erro" className="text-sm text-destructive">{clientErrors.subitens || error?.campos?.subitens}</p>
            ) : null}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="checklist-modelo-observacoes">Observações</Label>
            <Textarea
              id="checklist-modelo-observacoes"
              value={observacoes}
              maxLength={10000}
              rows={4}
              placeholder="Orientações que acompanham o item."
              onChange={(event) => setObservacoes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : item ? "Salvar alterações" : "Criar item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
