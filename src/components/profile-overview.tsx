"use client";

import { Building2, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

const PROFILE_LABELS = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  OPERADOR: "Operador",
  CLIENTE: "Cliente",
} as const;

export function ProfileOverview({ portal = false }: { portal?: boolean }) {
  const { me, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await refreshProfile();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Não foi possível atualizar seus dados.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            {portal ? "Portal do cliente" : `Olá, ${me.nome.split(" ")[0]}`}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {portal
              ? "Consulte os dados da sua empresa e acompanhe o acesso ao portal."
              : "Esta é a base do seu ambiente Ative Play. Os módulos serão liberados nas próximas fases."}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
          {refreshing ? "Atualizando..." : "Atualizar dados"}
        </Button>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-xl border bg-card" aria-labelledby="session-title">
        <div className="border-b px-5 py-5 sm:px-7">
          <h2 id="session-title" className="text-lg font-semibold tracking-[-0.02em]">
            Dados da sessão
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Informações retornadas pela rota <code className="text-xs">/auth/me</code>.
          </p>
        </div>

        <dl className="divide-y">
          <div className="grid gap-3 px-5 py-5 sm:grid-cols-[12rem_1fr] sm:px-7">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <UserRound className="size-4" aria-hidden="true" /> Usuário
            </dt>
            <dd>
              <p className="font-medium">{me.nome}</p>
              <p className="mt-1 text-sm text-muted-foreground">{me.email}</p>
              {me.cargo ? <p className="mt-1 text-sm text-muted-foreground">{me.cargo}</p> : null}
            </dd>
          </div>

          <div className="grid gap-3 px-5 py-5 sm:grid-cols-[12rem_1fr] sm:px-7">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ShieldCheck className="size-4" aria-hidden="true" /> Perfil e acesso
            </dt>
            <dd>
              <p className="font-medium">{PROFILE_LABELS[me.perfil]}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {me.permissoes === "TODAS"
                  ? "Acesso total aos módulos do escritório."
                  : me.permissoes.length > 0
                    ? `${me.permissoes.length} permissões configuradas.`
                    : "Nenhuma permissão adicional configurada."}
              </p>
            </dd>
          </div>

          <div className="grid gap-3 px-5 py-5 sm:grid-cols-[12rem_1fr] sm:px-7">
            <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="size-4" aria-hidden="true" /> Organização
            </dt>
            <dd>
              <p className="font-medium">{me.empresa?.razaoSocial ?? me.escritorio.nome}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {me.empresa
                  ? `Vinculada ao escritório ${me.escritorio.nome}.`
                  : `Plano ${me.escritorio.plano} · ${me.escritorio.fusoHorario}`}
              </p>
              {me.setores.length > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Setores: {me.setores.map((setor) => setor.nome).join(", ")}
                </p>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
