"use client";

import { Checkbox } from "@/components/ui/checkbox";
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
import type { Setor } from "@/types/admin";
import type { Prioridade, Recorrencia } from "@/types/tarefa";

export interface RuleFormState {
  setorId: string;
  nome: string;
  descricao: string;
  recorrencia: Recorrencia;
  diasSemana: number[];
  diaMes: string;
  dataUnica: string;
  apenasDiasUteis: boolean;
  horarioLimite: string;
  prioridade: Prioridade;
  tempoEstimadoMin: string;
}

export const RECURRENCE_LABELS: Record<Recorrencia, string> = {
  DIARIA: "Diária",
  SEMANAL: "Semanal",
  MENSAL: "Mensal",
  UNICA: "Única",
};

export const PRIORITY_LABELS: Record<Prioridade, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const WEEK_DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

export function RuleFields({
  value,
  setores,
  errors,
  allowUnique,
  showUniqueDate = allowUnique,
  allowEmptySector = true,
  onChange,
}: {
  value: RuleFormState;
  setores: Setor[];
  errors?: Record<string, string>;
  allowUnique: boolean;
  showUniqueDate?: boolean;
  allowEmptySector?: boolean;
  onChange: (changes: Partial<RuleFormState>) => void;
}) {
  const selectedSector = setores.find((setor) => setor.id === value.setorId);

  function toggleWeekDay(day: number, checked: boolean) {
    onChange({
      diasSemana: checked
        ? [...value.diasSemana, day].sort((a, b) => a - b)
        : value.diasSemana.filter((item) => item !== day),
    });
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="task-rule-name">Nome</Label>
        <Input
          id="task-rule-name"
          value={value.nome}
          onChange={(event) => onChange({ nome: event.target.value })}
          aria-invalid={Boolean(errors?.nome)}
          maxLength={160}
          required
        />
        <FieldError message={errors?.nome} />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="task-rule-description">Descrição</Label>
        <Textarea
          id="task-rule-description"
          value={value.descricao}
          onChange={(event) => onChange({ descricao: event.target.value })}
          aria-invalid={Boolean(errors?.descricao)}
          rows={3}
        />
        <FieldError message={errors?.descricao} />
      </div>

      <div className="space-y-2">
        <Label>Setor</Label>
        <Select
          value={value.setorId || "SEM_SETOR"}
          onValueChange={(next) => onChange({ setorId: !next || next === "SEM_SETOR" ? "" : next })}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{selectedSector?.nome ?? "Sem setor"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allowEmptySector ? <SelectItem value="SEM_SETOR">Sem setor</SelectItem> : null}
            {setores.filter((setor) => setor.ativo).map((setor) => (
              <SelectItem key={setor.id} value={setor.id}>{setor.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors?.setorId} />
      </div>

      <div className="space-y-2">
        <Label>Recorrência</Label>
        <Select
          value={value.recorrencia}
          onValueChange={(next) => next && onChange({ recorrencia: next as Recorrencia })}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{RECURRENCE_LABELS[value.recorrencia]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RECURRENCE_LABELS)
              .filter(([recurrence]) => allowUnique || recurrence !== "UNICA")
              .map(([recurrence, label]) => (
                <SelectItem key={recurrence} value={recurrence}>{label}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <FieldError message={errors?.recorrencia} />
      </div>

      {value.recorrencia === "SEMANAL" ? (
        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="text-sm font-medium">Dias da semana</legend>
          <div className="flex flex-wrap gap-3 rounded-lg border p-3">
            {WEEK_DAYS.map((day) => (
              <label key={day.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={value.diasSemana.includes(day.value)}
                  onCheckedChange={(checked) => toggleWeekDay(day.value, checked)}
                />
                {day.label}
              </label>
            ))}
          </div>
          <FieldError message={errors?.diasSemana} />
        </fieldset>
      ) : null}

      {value.recorrencia === "MENSAL" ? (
        <div className="space-y-2">
          <Label htmlFor="task-rule-month-day">Dia do mês</Label>
          <Input
            id="task-rule-month-day"
            type="number"
            min={1}
            max={31}
            value={value.diaMes}
            onChange={(event) => onChange({ diaMes: event.target.value })}
            aria-invalid={Boolean(errors?.diaMes)}
            required
          />
          <FieldError message={errors?.diaMes} />
        </div>
      ) : null}

      {showUniqueDate && value.recorrencia === "UNICA" ? (
        <div className="space-y-2">
          <Label htmlFor="task-rule-date">Data da tarefa</Label>
          <Input
            id="task-rule-date"
            type="date"
            value={value.dataUnica}
            onChange={(event) => onChange({ dataUnica: event.target.value })}
            aria-invalid={Boolean(errors?.dataUnica)}
            required
          />
          <FieldError message={errors?.dataUnica} />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="task-rule-deadline">Horário limite (SLA)</Label>
        <Input
          id="task-rule-deadline"
          type="time"
          value={value.horarioLimite}
          onChange={(event) => onChange({ horarioLimite: event.target.value })}
          aria-invalid={Boolean(errors?.horarioLimite)}
          required
        />
        <FieldError message={errors?.horarioLimite} />
      </div>

      <div className="space-y-2">
        <Label>Prioridade</Label>
        <Select
          value={value.prioridade}
          onValueChange={(next) => next && onChange({ prioridade: next as Prioridade })}
        >
          <SelectTrigger className="w-full">
            <SelectValue>{PRIORITY_LABELS[value.prioridade]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_LABELS).map(([priority, label]) => (
              <SelectItem key={priority} value={priority}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors?.prioridade} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-rule-estimate">Tempo estimado (minutos)</Label>
        <Input
          id="task-rule-estimate"
          type="number"
          min={1}
          value={value.tempoEstimadoMin}
          onChange={(event) => onChange({ tempoEstimadoMin: event.target.value })}
          aria-invalid={Boolean(errors?.tempoEstimadoMin)}
          placeholder="Opcional"
        />
        <FieldError message={errors?.tempoEstimadoMin} />
      </div>

      {value.recorrencia === "DIARIA" || value.recorrencia === "MENSAL" ? (
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
          <Checkbox
            checked={value.apenasDiasUteis}
            onCheckedChange={(checked) => onChange({ apenasDiasUteis: checked })}
          />
          Considerar apenas dias úteis
        </label>
      ) : null}
    </div>
  );
}
