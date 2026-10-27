"use client";

import { FormEvent, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type {
  EmpresaDetalhe,
  EmpresaRequest,
  RegimeTributario,
} from "@/types/empresa";

interface EmpresaFormDialogProps {
  empresa: EmpresaDetalhe | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  regimeTributario: RegimeTributario | "";
  email: string;
  telefone: string;
  responsavelId: string | null;
  honorarioMensal: string;
  dataInicio: string;
  observacoes: string;
}

const REGIMES: Array<{ value: RegimeTributario; label: string }> = [
  { value: "SIMPLES_NACIONAL", label: "Simples Nacional" },
  { value: "LUCRO_PRESUMIDO", label: "Lucro Presumido" },
  { value: "LUCRO_REAL", label: "Lucro Real" },
  { value: "MEI", label: "MEI" },
  { value: "OUTRO", label: "Outro" },
];

function initialState(empresa: EmpresaDetalhe | null): FormState {
  return {
    razaoSocial: empresa?.razaoSocial ?? "",
    nomeFantasia: empresa?.nomeFantasia ?? "",
    cnpj: empresa?.cnpj ?? "",
    regimeTributario: empresa?.regimeTributario ?? "",
    email: empresa?.email ?? "",
    telefone: empresa?.telefone ?? "",
    responsavelId: empresa?.responsavel?.id ?? null,
    honorarioMensal: empresa?.honorarioMensal?.toString() ?? "",
    dataInicio: empresa?.dataInicio ?? "",
    observacoes: empresa?.observacoes ?? "",
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

export function EmpresaFormDialog({
  empresa,
  onClose,
  onSaved,
}: EmpresaFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialState(empresa));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: EmpresaRequest = {
      razaoSocial: form.razaoSocial.trim(),
      nomeFantasia: form.nomeFantasia.trim() || null,
      cnpj: form.cnpj.trim(),
      regimeTributario: form.regimeTributario || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      responsavelId: form.responsavelId,
      honorarioMensal: form.honorarioMensal ? Number(form.honorarioMensal) : null,
      dataInicio: form.dataInicio || null,
      observacoes: form.observacoes.trim() || null,
    };

    try {
      if (empresa) {
        await api.put<EmpresaDetalhe, EmpresaRequest>(`/empresas/${empresa.id}`, payload);
      } else {
        await api.post<EmpresaDetalhe, EmpresaRequest>("/empresas", payload);
      }
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError({ status: 0, detail: "Não foi possível salvar a empresa." }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{empresa ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          <DialogDescription>
            {empresa
              ? "Atualize os dados cadastrais e financeiros da empresa."
              : "Cadastre uma empresa para iniciar o acompanhamento operacional."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {error ? (
            <div role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error.message}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="razaoSocial">Razão social</Label>
              <Input
                id="razaoSocial"
                value={form.razaoSocial}
                onChange={(event) => update("razaoSocial", event.target.value)}
                aria-invalid={Boolean(error?.campos?.razaoSocial)}
                className="h-10"
                required
              />
              <FieldError message={error?.campos?.razaoSocial} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nomeFantasia">Nome fantasia</Label>
              <Input
                id="nomeFantasia"
                value={form.nomeFantasia}
                onChange={(event) => update("nomeFantasia", event.target.value)}
                aria-invalid={Boolean(error?.campos?.nomeFantasia)}
                className="h-10"
              />
              <FieldError message={error?.campos?.nomeFantasia} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={form.cnpj}
                onChange={(event) => update("cnpj", event.target.value)}
                aria-invalid={Boolean(error?.campos?.cnpj)}
                placeholder="00.000.000/0000-00"
                className="h-10"
                required
              />
              <FieldError message={error?.campos?.cnpj} />
            </div>

            <div className="space-y-2">
              <Label>Regime tributário</Label>
              <Select
                value={form.regimeTributario || "NAO_INFORMADO"}
                onValueChange={(value) =>
                  update(
                    "regimeTributario",
                    value === "NAO_INFORMADO" ? "" : (value as RegimeTributario),
                  )
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_INFORMADO">Não informado</SelectItem>
                  {REGIMES.map((regime) => (
                    <SelectItem key={regime.value} value={regime.value}>{regime.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={error?.campos?.regimeTributario} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataInicio">Data de início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={form.dataInicio}
                onChange={(event) => update("dataInicio", event.target.value)}
                aria-invalid={Boolean(error?.campos?.dataInicio)}
                className="h-10"
              />
              <FieldError message={error?.campos?.dataInicio} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                aria-invalid={Boolean(error?.campos?.email)}
                className="h-10"
              />
              <FieldError message={error?.campos?.email} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(event) => update("telefone", event.target.value)}
                aria-invalid={Boolean(error?.campos?.telefone)}
                className="h-10"
              />
              <FieldError message={error?.campos?.telefone} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="honorarioMensal">Honorário mensal</Label>
              <Input
                id="honorarioMensal"
                type="number"
                min="0"
                step="0.01"
                value={form.honorarioMensal}
                onChange={(event) => update("honorarioMensal", event.target.value)}
                aria-invalid={Boolean(error?.campos?.honorarioMensal)}
                className="h-10"
              />
              <FieldError message={error?.campos?.honorarioMensal} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={(event) => update("observacoes", event.target.value)}
                aria-invalid={Boolean(error?.campos?.observacoes)}
                className="min-h-24"
              />
              <FieldError message={error?.campos?.observacoes} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : empresa ? "Salvar alterações" : "Criar empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
