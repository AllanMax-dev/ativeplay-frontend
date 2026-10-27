"use client";

import { FormEvent, useState } from "react";
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
import { api, ApiError } from "@/lib/api";
import type { Perfil } from "@/types/api";
import type {
  AtualizarUsuarioRequest,
  CriarUsuarioRequest,
  Setor,
  UsuarioCriadoResposta,
  UsuarioDetalhe,
  UsuarioEmpresa,
} from "@/types/admin";

interface UsuarioFormDialogProps {
  usuario: UsuarioDetalhe | null;
  setores: Setor[];
  empresas: UsuarioEmpresa[];
  perfilAtual: Perfil;
  onClose: () => void;
  onSaved: (senhaTemporaria?: string) => void;
}

interface FormState {
  nome: string;
  email: string;
  perfil: Perfil;
  cargo: string;
  telefone: string;
  senha: string;
  empresaId: string;
  setorIds: string[];
  empresaIds: string[];
}

const PROFILE_LABELS: Record<Perfil, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  OPERADOR: "Operador",
  CLIENTE: "Cliente",
};

function initialState(usuario: UsuarioDetalhe | null): FormState {
  return {
    nome: usuario?.nome ?? "",
    email: usuario?.email ?? "",
    perfil: usuario?.perfil ?? "OPERADOR",
    cargo: usuario?.cargo ?? "",
    telefone: usuario?.telefone ?? "",
    senha: "",
    empresaId: usuario?.empresaId ?? "",
    setorIds: usuario?.setores.map((setor) => setor.id) ?? [],
    empresaIds: usuario?.carteira.map((empresa) => empresa.id) ?? [],
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

export function UsuarioFormDialog({
  usuario,
  setores,
  empresas,
  perfilAtual,
  onClose,
  onSaved,
}: UsuarioFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialState(usuario));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const perfis: Perfil[] = perfilAtual === "ADMIN"
    ? ["ADMIN", "GESTOR", "OPERADOR", "CLIENTE"]
    : ["GESTOR", "OPERADOR", "CLIENTE"];

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleId(field: "setorIds" | "empresaIds", id: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      [field]: checked
        ? [...current[field], id]
        : current[field].filter((value) => value !== id),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const base: AtualizarUsuarioRequest = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      perfil: form.perfil,
      cargo: form.cargo.trim() || null,
      telefone: form.telefone.trim() || null,
      empresaId: form.perfil === "CLIENTE" ? form.empresaId || null : null,
    };

    try {
      if (usuario) {
        await api.put<UsuarioDetalhe, AtualizarUsuarioRequest>(`/usuarios/${usuario.id}`, base);
        if (form.perfil !== "CLIENTE") {
          await api.put<UsuarioDetalhe, { setorIds: string[] }>(
            `/usuarios/${usuario.id}/setores`,
            { setorIds: form.setorIds },
          );
          await api.put<UsuarioDetalhe, { empresaIds: string[] }>(
            `/usuarios/${usuario.id}/carteira`,
            { empresaIds: form.perfil === "OPERADOR" ? form.empresaIds : [] },
          );
        }
        onSaved();
      } else {
        const payload: CriarUsuarioRequest = {
          ...base,
          senha: form.senha || null,
          setorIds: form.perfil === "CLIENTE" ? [] : form.setorIds,
          empresaIds: form.perfil === "OPERADOR" ? form.empresaIds : [],
        };
        const response = await api.post<UsuarioCriadoResposta, CriarUsuarioRequest>("/usuarios", payload);
        onSaved(response.senhaTemporaria);
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError({ status: 0, detail: "Não foi possível salvar o usuário." }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{usuario ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>
            {usuario
              ? "Atualize o cadastro, os setores e os vínculos operacionais."
              : "Cadastre o acesso e defina onde a pessoa irá atuar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {error ? (
            <div role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error.message}
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="usuario-nome">Nome</Label>
              <Input id="usuario-nome" value={form.nome} onChange={(event) => update("nome", event.target.value)} aria-invalid={Boolean(error?.campos?.nome)} required />
              <FieldError message={error?.campos?.nome} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usuario-email">E-mail</Label>
              <Input id="usuario-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(error?.campos?.email)} required />
              <FieldError message={error?.campos?.email} />
            </div>

            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={form.perfil} onValueChange={(value) => update("perfil", value as Perfil)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {perfis.map((perfil) => <SelectItem key={perfil} value={perfil}>{PROFILE_LABELS[perfil]}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={error?.campos?.perfil} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usuario-cargo">Cargo</Label>
              <Input id="usuario-cargo" value={form.cargo} onChange={(event) => update("cargo", event.target.value)} aria-invalid={Boolean(error?.campos?.cargo)} />
              <FieldError message={error?.campos?.cargo} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usuario-telefone">Telefone</Label>
              <Input id="usuario-telefone" value={form.telefone} onChange={(event) => update("telefone", event.target.value)} aria-invalid={Boolean(error?.campos?.telefone)} />
              <FieldError message={error?.campos?.telefone} />
            </div>

            {!usuario ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="usuario-senha">Senha inicial (opcional)</Label>
                <Input id="usuario-senha" type="password" value={form.senha} onChange={(event) => update("senha", event.target.value)} aria-invalid={Boolean(error?.campos?.senha)} placeholder="Em branco para gerar uma senha temporária" />
                <FieldError message={error?.campos?.senha} />
              </div>
            ) : null}

            {form.perfil === "CLIENTE" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Empresa do cliente</Label>
                <Select value={form.empresaId || "SEM_EMPRESA"} onValueChange={(value) => update("empresaId", !value || value === "SEM_EMPRESA" ? "" : value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEM_EMPRESA">Selecione uma empresa</SelectItem>
                    {empresas.map((empresa) => <SelectItem key={empresa.id} value={empresa.id}>{empresa.razaoSocial}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError message={error?.campos?.empresaId} />
              </div>
            ) : (
              <fieldset className="space-y-3 sm:col-span-2">
                <legend className="text-sm font-medium">Setores</legend>
                <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                  {setores.length > 0 ? setores.map((setor) => (
                    <label key={setor.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={form.setorIds.includes(setor.id)} onCheckedChange={(checked) => toggleId("setorIds", setor.id, checked)} />
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: setor.cor ?? "#94A3B8" }} />
                      {setor.nome}
                    </label>
                  )) : <p className="text-sm text-muted-foreground">Nenhum setor ativo.</p>}
                </div>
              </fieldset>
            )}

            {form.perfil === "OPERADOR" ? (
              <fieldset className="space-y-3 sm:col-span-2">
                <legend className="text-sm font-medium">Carteira de empresas</legend>
                <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                  {empresas.length > 0 ? empresas.map((empresa) => (
                    <label key={empresa.id} className="flex cursor-pointer items-start gap-2 text-sm">
                      <Checkbox className="mt-0.5" checked={form.empresaIds.includes(empresa.id)} onCheckedChange={(checked) => toggleId("empresaIds", empresa.id, checked)} />
                      {empresa.razaoSocial}
                    </label>
                  )) : <p className="text-sm text-muted-foreground">Nenhuma empresa disponível.</p>}
                </div>
              </fieldset>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : usuario ? "Salvar alterações" : "Criar usuário"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
