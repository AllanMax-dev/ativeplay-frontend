"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  RuleFields,
  type RuleFormState,
} from "@/components/tarefas/task-rule-fields";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canReadModule } from "@/lib/access-control";
import { api, ApiError, withQuery } from "@/lib/api";
import type { Setor, UsuarioLista } from "@/types/admin";
import type { Pagina } from "@/types/api";
import type { EmpresaResumo, UsuarioRef } from "@/types/empresa";
import type {
  DefinicaoTarefa,
  DefinicaoTarefaRequest,
  PadraoTarefa,
} from "@/types/tarefa";

interface DefinitionFormState extends RuleFormState {
  padraoId: string;
  responsavelId: string;
  visivelCliente: boolean;
}

function initialState(definicao: DefinicaoTarefa | null): DefinitionFormState {
  return {
    padraoId: definicao?.padraoId ?? "",
    setorId: definicao?.setorId ?? "",
    responsavelId: definicao?.responsavelId ?? "",
    nome: definicao?.nome ?? "",
    descricao: definicao?.descricao ?? "",
    recorrencia: definicao?.recorrencia ?? "MENSAL",
    diasSemana: definicao?.diasSemana ?? [],
    diaMes: definicao?.diaMes?.toString() ?? "",
    dataUnica: definicao?.dataUnica ?? "",
    apenasDiasUteis: definicao?.apenasDiasUteis ?? true,
    horarioLimite: definicao?.horarioLimite ?? "18:00",
    prioridade: definicao?.prioridade ?? "MEDIA",
    tempoEstimadoMin: definicao?.tempoEstimadoMin?.toString() ?? "",
    visivelCliente: definicao?.visivelCliente ?? false,
  };
}

function validate(form: DefinitionFormState, definicao: DefinicaoTarefa | null): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!form.nome.trim()) fields.nome = "Informe o nome da rotina.";
  if (form.recorrencia === "SEMANAL" && form.diasSemana.length === 0) {
    fields.diasSemana = "Selecione ao menos um dia da semana.";
  }
  if (form.recorrencia === "MENSAL") {
    const day = Number(form.diaMes);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      fields.diaMes = "Informe um dia entre 1 e 31.";
    }
  }
  if (form.recorrencia === "UNICA" && !form.dataUnica) {
    fields.dataUnica = "Informe a data da tarefa única.";
  }
  if (definicao?.tempoEstimadoMin && !form.tempoEstimadoMin) {
    fields.tempoEstimadoMin = "Substitua o tempo atual por outro valor positivo.";
  }
  return fields;
}

export function DefinicaoFormDialog({
  definicao,
  empresa,
  padroes,
  setores,
  onClose,
  onSaved,
}: {
  definicao: DefinicaoTarefa | null;
  empresa: EmpresaResumo;
  padroes: PadraoTarefa[];
  setores: Setor[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { me } = useAuth();
  const [form, setForm] = useState(() => initialState(definicao));
  const [responsaveis, setResponsaveis] = useState<UsuarioRef[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const canListUsers = me ? canReadModule(me, "USUARIOS") : false;

  useEffect(() => {
    let active = true;
    const request = canListUsers
      ? api
          .get<Pagina<UsuarioLista>>(withQuery("/usuarios", { ativo: true, pagina: 1, porPagina: 100 }))
          .then((response) => response.dados
            .filter((user) => user.perfil !== "CLIENTE")
            .map((user) => ({ id: user.id, nome: user.nome })))
      : api.get<UsuarioRef[]>(`/empresas/${empresa.id}/equipe`);

    request
      .then((users) => {
        if (active) setResponsaveis(users);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof ApiError
              ? cause
              : new ApiError({ status: 0, detail: "Não foi possível carregar os responsáveis." }),
          );
        }
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });

    return () => {
      active = false;
    };
  }, [canListUsers, empresa.id]);

  const currentResponsibleId = definicao?.responsavelId ?? "";
  const currentResponsibleMissing = Boolean(
    currentResponsibleId && !responsaveis.some((user) => user.id === currentResponsibleId),
  );
  const selectedPattern = padroes.find((pattern) => pattern.id === form.padraoId);
  const selectedResponsible = responsaveis.find((user) => user.id === form.responsavelId);

  function selectPattern(patternId: string) {
    const pattern = padroes.find((item) => item.id === patternId);
    if (!pattern) {
      setForm((current) => ({ ...current, padraoId: "" }));
      return;
    }
    setForm((current) => ({
      ...current,
      padraoId: pattern.id,
      setorId: pattern.setorId ?? "",
      nome: pattern.nome,
      descricao: pattern.descricao ?? "",
      recorrencia: pattern.recorrencia,
      diasSemana: pattern.diasSemana,
      diaMes: pattern.diaMes?.toString() ?? "",
      dataUnica: "",
      apenasDiasUteis: pattern.apenasDiasUteis,
      horarioLimite: pattern.horarioLimite,
      prioridade: pattern.prioridade,
      tempoEstimadoMin: pattern.tempoEstimadoMin?.toString() ?? "",
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validate(form, definicao);
    setClientErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const payload: DefinicaoTarefaRequest = {
      empresaId: empresa.id,
      padraoId: form.padraoId || null,
      setorId: form.setorId || null,
      responsavelId: form.responsavelId || null,
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      recorrencia: form.recorrencia,
      diasSemana: form.recorrencia === "SEMANAL" ? form.diasSemana : [],
      diaMes: form.recorrencia === "MENSAL" ? Number(form.diaMes) : null,
      dataUnica: form.recorrencia === "UNICA" ? form.dataUnica : null,
      apenasDiasUteis: form.apenasDiasUteis,
      horarioLimite: form.horarioLimite,
      prioridade: form.prioridade,
      tempoEstimadoMin: form.tempoEstimadoMin ? Number(form.tempoEstimadoMin) : null,
      visivelCliente: form.visivelCliente,
    };

    setSubmitting(true);
    setError(null);
    try {
      if (definicao) {
        await api.put<DefinicaoTarefa, DefinicaoTarefaRequest>(`/tarefas/definicoes/${definicao.id}`, payload);
      } else {
        await api.post<DefinicaoTarefa, DefinicaoTarefaRequest>("/tarefas/definicoes", payload);
      }
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError({ status: 0, detail: "Não foi possível salvar a rotina." }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{definicao ? "Editar rotina" : "Nova rotina"}</DialogTitle>
          <DialogDescription>
            {empresa.razaoSocial}. A rotina ativa gera ocorrências nas datas em que sua regra se aplica.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate>
          {error ? (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error.message}
            </div>
          ) : null}

          {!definicao ? (
            <div className="space-y-2">
              <Label>Padrão do catálogo (opcional)</Label>
              <Select value={form.padraoId || "SEM_PADRAO"} onValueChange={(value) => selectPattern(!value || value === "SEM_PADRAO" ? "" : value)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{selectedPattern?.nome ?? "Configurar do zero"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEM_PADRAO">Configurar do zero</SelectItem>
                  {padroes.filter((pattern) => pattern.ativo).map((pattern) => (
                    <SelectItem key={pattern.id} value={pattern.id}>{pattern.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={form.responsavelId || "SEM_RESPONSAVEL"}
              onValueChange={(value) => setForm((current) => ({
                ...current,
                responsavelId: !value || value === "SEM_RESPONSAVEL" ? "" : value,
              }))}
              disabled={loadingUsers}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {loadingUsers
                    ? "Carregando..."
                    : selectedResponsible?.nome ?? (form.responsavelId ? "Responsável atual" : "Sem responsável")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {!definicao?.responsavelId ? <SelectItem value="SEM_RESPONSAVEL">Sem responsável</SelectItem> : null}
                {currentResponsibleMissing ? (
                  <SelectItem value={currentResponsibleId}>Responsável atual</SelectItem>
                ) : null}
                {responsaveis.map((user) => <SelectItem key={user.id} value={user.id}>{user.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {error?.campos?.responsavelId ? <p className="text-sm text-destructive">{error.campos.responsavelId}</p> : null}
          </div>

          <RuleFields
            value={form}
            setores={setores}
            errors={{ ...error?.campos, ...clientErrors }}
            allowUnique
            allowEmptySector={!definicao?.setorId}
            onChange={(changes) => {
              setForm((current) => ({ ...current, ...changes }));
              setClientErrors({});
            }}
          />

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={form.visivelCliente}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, visivelCliente: checked }))}
            />
            Exibir as ocorrências desta rotina no portal do cliente
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting || loadingUsers}>
              {submitting ? "Salvando..." : definicao ? "Salvar alterações" : "Criar rotina"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
