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
import { api, ApiError } from "@/lib/api";
import {
  formatDateInTimeZone,
  formatTimeInTimeZone,
  instantToZonedParts,
  zonedPartsToInstant,
} from "@/lib/format";
import type { RegistroPonto } from "@/types/ponto";

/** Ajuste de um registro pendente: o gestor informa o horário real da saída (auditado pela API). */
export function InformarSaidaDialog({
  registro,
  timeZone,
  onClose,
  onSaved,
}: {
  registro: RegistroPonto;
  timeZone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const sugestao = instantToZonedParts(registro.ultimoSinal ?? registro.inicio, timeZone);
  const [data, setData] = useState(sugestao.data);
  const [hora, setHora] = useState(sugestao.hora);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    if (!data || !hora) {
      setFieldError("Informe a data e a hora da saída.");
      return;
    }
    const fim = zonedPartsToInstant(data, hora, timeZone);
    const fimMs = new Date(fim).getTime();
    // A entrada tem segundos; a saída é por minuto: compara no minuto da entrada.
    if (fimMs < Math.floor(new Date(registro.inicio).getTime() / 60_000) * 60_000) {
      setFieldError("A saída não pode ser antes da entrada.");
      return;
    }
    if (fimMs > Date.now()) {
      setFieldError("A saída não pode ser no futuro.");
      return;
    }
    setSaving(true);
    try {
      await api.patch<RegistroPonto, { fim: string }>(`/sessoes-acesso/${registro.id}/saida`, { fim });
      onSaved();
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.campos?.fim) setFieldError(cause.campos.fim);
        else setError(cause.message);
      } else {
        setError("Não foi possível informar a saída.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Informar saída</DialogTitle>
            <DialogDescription>
              {registro.usuarioNome}: entrada em {formatDateInTimeZone(registro.inicio, timeZone)} às{" "}
              {formatTimeInTimeZone(registro.inicio, timeZone)}
              {registro.ultimoSinal
                ? `; último sinal às ${formatTimeInTimeZone(registro.ultimoSinal, timeZone)}`
                : ""}
              . O ajuste fica registrado na auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="saida-data">Data</Label>
              <Input
                id="saida-data"
                type="date"
                value={data}
                onChange={(event) => setData(event.target.value)}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? "saida-erro" : undefined}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saida-hora">Hora</Label>
              <Input
                id="saida-hora"
                type="time"
                value={hora}
                onChange={(event) => setHora(event.target.value)}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? "saida-erro" : undefined}
                required
              />
            </div>
          </div>
          {fieldError ? (
            <p id="saida-erro" className="-mt-1 text-sm text-destructive">
              {fieldError}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Informar saída"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
