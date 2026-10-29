"use client";

import { Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import type { Modulo, Perfil } from "@/types/api";
import type { NivelPermissao, PermissaoItem } from "@/types/admin";

const PROFILES: Perfil[] = ["GESTOR", "OPERADOR", "CLIENTE"];

const PROFILE_LABELS: Record<string, string> = {
  GESTOR: "Gestor",
  OPERADOR: "Operador",
  CLIENTE: "Cliente",
};

const MODULE_LABELS: Record<Modulo, string> = {
  PAINEL: "Painel",
  EMPRESAS: "Empresas",
  TAREFAS: "Tarefas",
  CRM: "CRM",
  DOCUMENTOS: "Documentos",
  RELATORIOS: "Relatórios",
  INTEGRACOES: "Integrações",
  USUARIOS: "Usuários",
  CONFIGURACOES: "Configurações",
  AUDITORIA: "Auditoria",
  SENHAS: "Senhas salvas",
};

const LEVEL_LABELS: Record<NivelPermissao, string> = {
  NENHUM: "Sem acesso",
  LEITURA: "Leitura",
  ESCRITA: "Leitura e escrita",
};

function itemKey(perfil: Perfil, modulo: Modulo): string {
  return `${perfil}:${modulo}`;
}

export function PermissoesScreen() {
  const { me } = useAuth();
  const [items, setItems] = useState<PermissaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const canEdit = me?.perfil === "ADMIN";

  useEffect(() => {
    let active = true;
    api.get<PermissaoItem[]>("/escritorio/permissoes")
      .then((response) => { if (active) setItems(response); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar as permissões.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function update(perfil: Perfil, modulo: Modulo, nivel: NivelPermissao) {
    setSuccess(false);
    setItems((current) => current.map((item) =>
      item.perfil === perfil && item.modulo === modulo ? { ...item, nivel } : item,
    ));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const existingLines = items.filter((item) => item.nivel !== "NENHUM");
      setItems(await api.put<PermissaoItem[], PermissaoItem[]>(
        "/escritorio/permissoes",
        existingLines,
      ));
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível salvar as permissões.");
    } finally {
      setSaving(false);
    }
  }

  const modules = Array.from(new Set(items.map((item) => item.modulo)));
  const byKey = new Map(items.map((item) => [itemKey(item.perfil, item.modulo), item]));

  /** Nível de um perfil num módulo: seletor para o ADMIN, selo para os demais. */
  function renderNivel(perfil: Perfil, modulo: Modulo, fullWidth = false) {
    const nivel = byKey.get(itemKey(perfil, modulo))?.nivel ?? "NENHUM";
    return canEdit ? (
      <Select value={nivel} onValueChange={(value) => update(perfil, modulo, value as NivelPermissao)}>
        <SelectTrigger className={fullWidth ? "w-full" : "w-44"}><SelectValue>{LEVEL_LABELS[nivel]}</SelectValue></SelectTrigger>
        <SelectContent>{Object.entries(LEVEL_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
      </Select>
    ) : (
      <Badge variant={nivel === "ESCRITA" ? "secondary" : "outline"}>{LEVEL_LABELS[nivel]}</Badge>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Permissões</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Defina o nível de acesso de cada perfil. Administradores sempre têm acesso total.
          </p>
        </div>
        {canEdit ? <Button onClick={save} disabled={loading || saving}><Save aria-hidden="true" /> {saving ? "Salvando..." : "Salvar matriz"}</Button> : null}
      </div>

      {!canEdit ? <div className="mt-6 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">A matriz está disponível somente para consulta. Apenas administradores podem alterá-la.</div> : null}
      {error ? <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{error}</div> : null}
      {success ? <div className="mt-5 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary" role="status">Matriz de permissões atualizada.</div> : null}

      <section className="mt-6 overflow-hidden rounded-xl border bg-card" aria-label="Matriz de permissões">
        {loading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
        ) : modules.length > 0 ? (
          <>
          <div className="hidden md:block">
          <Table className="min-w-[720px]">
            <TableHeader><TableRow><TableHead className="pl-5">Módulo</TableHead>{PROFILES.map((perfil) => <TableHead key={perfil}>{PROFILE_LABELS[perfil]}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {modules.map((modulo) => (
                <TableRow key={modulo}>
                  <TableCell className="pl-5 font-medium">{MODULE_LABELS[modulo]}</TableCell>
                  {PROFILES.map((perfil) => <TableCell key={perfil}>{renderNivel(perfil, modulo)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          {/* No celular cada módulo vira um item com os perfis um abaixo do outro. */}
          <ul className="divide-y md:hidden">
            {modules.map((modulo) => (
              <li key={modulo} className="px-4 py-3">
                <p className="font-medium">{MODULE_LABELS[modulo]}</p>
                <dl className="mt-2 grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-2">
                  {PROFILES.map((perfil) => (
                    <div key={perfil} className="contents">
                      <dt className="text-[13px] text-muted-foreground">{PROFILE_LABELS[perfil]}</dt>
                      <dd>{renderNivel(perfil, modulo, true)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          </>
        ) : (
          <div className="px-6 py-14 text-center"><ShieldCheck className="mx-auto size-10 text-muted-foreground" aria-hidden="true" /><h2 className="mt-4 font-semibold">Matriz indisponível</h2><p className="mt-2 text-sm text-muted-foreground">Nenhuma permissão foi retornada pela API.</p></div>
        )}
      </section>
    </div>
  );
}
