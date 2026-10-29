"use client";

import { ListPlus, Trash2 } from "lucide-react";
import { FormEvent, KeyboardEvent, useState } from "react";
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
import type { ChecklistItem, ChecklistItemRequest } from "@/types/cliente";
import type { UsuarioRef } from "@/types/empresa";
import type { Prioridade } from "@/types/tarefa";

const NONE = "SEM_RESPONSAVEL";

export const CHECKLIST_PRIORITY_LABELS: Record<Prioridade, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

interface DraftSubitem {
  key: string;
  id?: string;
  texto: string;
  concluido: boolean;
}

let draftCounter = 0;
function nextKey(): string {
  draftCounter += 1;
  return `novo-${draftCounter}`;
}

export function ChecklistFormDialog({
  empresaId,
  empresaNome,
  item,
  team,
  loadingTeam,
  onClose,
  onSaved,
}: {
  empresaId: string;
  empresaNome: string;
  item: ChecklistItem | null;
  team: UsuarioRef[];
  loadingTeam: boolean;
  onClose: () => void;
  onSaved: (saved: ChecklistItem) => void;
}) {
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [prazo, setPrazo] = useState(item?.prazo ?? "");
  const [prioridade, setPrioridade] = useState<Prioridade>(item?.prioridade ?? "MEDIA");
  const [responsavelId, setResponsavelId] = useState(item?.responsavel?.id ?? "");
  const [observacoes, setObservacoes] = useState(item?.observacoes ?? "");
  const [subitens, setSubitens] = useState<DraftSubitem[]>(
    () => item?.subitens.map((sub) => ({ key: sub.id, id: sub.id, texto: sub.texto, concluido: sub.concluido })) ?? [],
  );
  const [novoSubitem, setNovoSubitem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [tituloErro, setTituloErro] = useState<string | null>(null);

  const responsavel = team.find((user) => user.id === responsavelId);
  const responsavelForaDaLista = Boolean(responsavelId && !responsavel);

  function adicionarSubitem() {
    const texto = novoSubitem.trim();
    if (!texto) return;
    setSubitens((current) => [...current, { key: nextKey(), texto, concluido: false }]);
    setNovoSubitem("");
  }

  function onSubitemKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      adicionarSubitem();
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!titulo.trim()) {
      setTituloErro("Informe o nome do item.");
      return;
    }
    const pendente = novoSubitem.trim();
    const payload: ChecklistItemRequest = {
      titulo: titulo.trim(),
      observacoes: observacoes.trim() || null,
      prazo: prazo || null,
      prioridade,
      responsavelId: responsavelId || null,
      subitens: [
        ...subitens.map((sub) => ({ id: sub.id, texto: sub.texto, concluido: sub.concluido })),
        ...(pendente ? [{ texto: pendente, concluido: false }] : []),
      ],
    };

    setSubmitting(true);
    setError(null);
    try {
      const saved = item
        ? await api.put<ChecklistItem, ChecklistItemRequest>(`/empresas/${empresaId}/checklist/${item.id}`, payload)
        : await api.post<ChecklistItem, ChecklistItemRequest>(`/empresas/${empresaId}/checklist`, payload);
      onSaved(saved);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError({ status: 0, detail: "Não foi possível salvar o item do checklist." }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item do checklist" : "Adicionar novo item ao checklist"}</DialogTitle>
          <DialogDescription>
            Registre uma observação pontual de {empresaNome}, como a ausência de alguma informação ou um
            documento pendente do cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate>
          {error ? (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error.message}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="checklist-titulo">Nome *</Label>
            <Input
              id="checklist-titulo"
              value={titulo}
              maxLength={200}
              autoFocus
              placeholder="Ex.: Pendente de envio do acesso bancário"
              aria-invalid={Boolean(tituloErro || error?.campos?.titulo)}
              onChange={(event) => {
                setTitulo(event.target.value);
                setTituloErro(null);
              }}
              className="h-10"
            />
            {tituloErro || error?.campos?.titulo ? (
              <p className="text-sm text-destructive">{tituloErro ?? error?.campos?.titulo}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="checklist-prazo">Prazo de execução</Label>
              <Input
                id="checklist-prazo"
                type="date"
                value={prazo}
                onChange={(event) => setPrazo(event.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select
                value={responsavelId || NONE}
                onValueChange={(value) => setResponsavelId(!value || value === NONE ? "" : value)}
                disabled={loadingTeam}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>
                    {loadingTeam
                      ? "Carregando..."
                      : responsavel?.nome ?? (responsavelForaDaLista ? item?.responsavel?.nome ?? "Responsável atual" : "Sem responsável")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem responsável</SelectItem>
                  {responsavelForaDaLista ? (
                    <SelectItem value={responsavelId}>{item?.responsavel?.nome ?? "Responsável atual"}</SelectItem>
                  ) : null}
                  {team.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(value) => value && setPrioridade(value as Prioridade)}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>{CHECKLIST_PRIORITY_LABELS[prioridade]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHECKLIST_PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Checklist</legend>
            <div className="flex gap-2">
              <Input
                value={novoSubitem}
                maxLength={200}
                onChange={(event) => setNovoSubitem(event.target.value)}
                onKeyDown={onSubitemKeyDown}
                placeholder="Novo item. Ex.: Verificar documentação"
                aria-label="Novo sub-item do checklist"
                className="h-10"
              />
              <Button type="button" variant="outline" className="h-10" onClick={adicionarSubitem} disabled={!novoSubitem.trim()}>
                <ListPlus aria-hidden="true" /> Adicionar
              </Button>
            </div>
            {subitens.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {subitens.map((sub) => (
                  <li key={sub.key} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      checked={sub.concluido}
                      aria-label={`Marcar ${sub.texto} como feito`}
                      onCheckedChange={(checked) =>
                        setSubitens((current) =>
                          current.map((candidate) => (candidate.key === sub.key ? { ...candidate, concluido: checked } : candidate)),
                        )
                      }
                    />
                    <Input
                      value={sub.texto}
                      maxLength={200}
                      aria-label="Texto do sub-item"
                      onChange={(event) =>
                        setSubitens((current) =>
                          current.map((candidate) =>
                            candidate.key === sub.key ? { ...candidate, texto: event.target.value } : candidate,
                          ),
                        )
                      }
                      className={`h-8 border-transparent px-1 shadow-none focus-visible:border-ring ${sub.concluido ? "text-muted-foreground line-through" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover ${sub.texto}`}
                      onClick={() => setSubitens((current) => current.filter((candidate) => candidate.key !== sub.key))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-sm text-muted-foreground">Nenhum item na lista.</p>
            )}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="checklist-observacoes">Observações</Label>
            <Textarea
              id="checklist-observacoes"
              value={observacoes}
              maxLength={10000}
              rows={4}
              placeholder="Detalhes, contatos ou o que falta receber do cliente."
              onChange={(event) => setObservacoes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Fechar</Button>
            <Button
              type="submit"
              disabled={submitting || subitens.some((sub) => !sub.texto.trim())}
            >
              {submitting ? "Salvando..." : item ? "Salvar alterações" : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
