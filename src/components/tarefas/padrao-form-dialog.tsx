"use client";

import { FormEvent, useState } from "react";
import {
  RuleFields,
  type RuleFormState,
} from "@/components/tarefas/task-rule-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import type { Setor } from "@/types/admin";
import type { PadraoTarefa, PadraoTarefaRequest } from "@/types/tarefa";

function initialState(padrao: PadraoTarefa | null): RuleFormState {
  return {
    setorId: padrao?.setorId ?? "",
    nome: padrao?.nome ?? "",
    descricao: padrao?.descricao ?? "",
    recorrencia: padrao?.recorrencia ?? "MENSAL",
    diasSemana: padrao?.diasSemana ?? [],
    diaMes: padrao?.diaMes?.toString() ?? "",
    dataUnica: "",
    apenasDiasUteis: padrao?.apenasDiasUteis ?? true,
    horarioLimite: padrao?.horarioLimite ?? "18:00",
    prioridade: padrao?.prioridade ?? "MEDIA",
    tempoEstimadoMin: padrao?.tempoEstimadoMin?.toString() ?? "",
  };
}

function validate(form: RuleFormState): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!form.nome.trim()) fields.nome = "Informe o nome do padrão.";
  if (form.recorrencia === "SEMANAL" && form.diasSemana.length === 0) {
    fields.diasSemana = "Selecione ao menos um dia da semana.";
  }
  if (form.recorrencia === "MENSAL") {
    const day = Number(form.diaMes);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      fields.diaMes = "Informe um dia entre 1 e 31.";
    }
  }
  return fields;
}

export function PadraoFormDialog({
  padrao,
  setores,
  onClose,
  onSaved,
}: {
  padrao: PadraoTarefa | null;
  setores: Setor[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => initialState(padrao));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validate(form);
    setClientErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const payload: PadraoTarefaRequest = {
      setorId: form.setorId || null,
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      recorrencia: form.recorrencia,
      diasSemana: form.recorrencia === "SEMANAL" ? form.diasSemana : [],
      diaMes: form.recorrencia === "MENSAL" ? Number(form.diaMes) : null,
      apenasDiasUteis: form.apenasDiasUteis,
      horarioLimite: form.horarioLimite,
      prioridade: form.prioridade,
      tempoEstimadoMin: form.tempoEstimadoMin ? Number(form.tempoEstimadoMin) : null,
    };

    setSubmitting(true);
    setError(null);
    try {
      if (padrao) {
        await api.put<PadraoTarefa, PadraoTarefaRequest>(`/tarefas/padroes/${padrao.id}`, payload);
      } else {
        await api.post<PadraoTarefa, PadraoTarefaRequest>("/tarefas/padroes", payload);
      }
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError({ status: 0, detail: "Não foi possível salvar o padrão." }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{padrao ? "Editar padrão" : "Novo padrão"}</DialogTitle>
          <DialogDescription>
            Configure a recorrência, o SLA e os valores que poderão ser reutilizados nas empresas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate>
          {error ? (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error.message}
            </div>
          ) : null}

          <RuleFields
            value={form}
            setores={setores}
            errors={{ ...error?.campos, ...clientErrors }}
            allowUnique
            showUniqueDate={false}
            onChange={(changes) => {
              setForm((current) => ({ ...current, ...changes }));
              setClientErrors({});
            }}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : padrao ? "Salvar alterações" : "Criar padrão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
