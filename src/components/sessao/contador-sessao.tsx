"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { api } from "@/lib/api";
import { formatClock } from "@/lib/format";
import { History } from "lucide-react";
import { HistoricoSessoes } from "@/components/sessao/historico-sessoes";

type SessaoAcesso = {
  id: string;
  inicio: string;
  fim: string | null;
  duracaoMs: number;
};

export function ContadorSessaoSidebar() {
  const { status, me } = useAuth();
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const [sessao, setSessao] = useState<SessaoAcesso | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;

    if (status !== "authenticated" || !me) {
      return;
    }

    async function carregarSessao() {
      try {
        const dados = await api.get<SessaoAcesso | undefined>(
          "/sessoes-acesso/atual",
        );

        if (!ativo) return;

        setSessao(dados ?? null);
        setAgora(Date.now());
        setErro(false);
      } catch (error) {
        if (!ativo) return;

        console.error("Erro ao carregar sessão:", error);
        setErro(true);
      }
    }

    void carregarSessao();

    return () => {
      ativo = false;
    };
  }, [status, me?.id]);

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, []);

  if (status !== "authenticated") return null;

  const inicioMs = sessao ? new Date(sessao.inicio).getTime() : null;

  const duracaoMs =
    inicioMs !== null && Number.isFinite(inicioMs)
      ? Math.max(0, agora - inicioMs)
      : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setHistoricoAberto(true)}
        className="w-full rounded-xl border border-transparent bg-sidebar-accent px-3 py-3 text-left text-sidebar-accent-foreground transition-colors hover:border-sidebar-primary/30 hover:bg-sidebar-accent/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Abrir histórico de sessões"
        title="Clique para consultar o histórico de sessões"
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <Clock3
              className="size-3.5 text-sidebar-primary"
              aria-hidden="true"
            />
            Tempo de sessão
          </span>

          <History
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        {sessao ? (
          <>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
              {formatClock(duracaoMs)}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Clique para ver o histórico
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {erro
              ? "Não foi possível carregar a sessão"
              : "Carregando sessão..."}
          </p>
        )}
      </button>

      <HistoricoSessoes
        open={historicoAberto}
        onOpenChange={setHistoricoAberto}
      />
    </>
  );
}
