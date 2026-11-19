"use client";

import { useState } from "react";
import { Clock3 } from "lucide-react";
import { usePonto } from "@/components/sessao/ponto-provider";
import { useNow } from "@/components/sessao/sessao-provider";
import { formatClock } from "@/lib/format";
import { History } from "lucide-react";
import { HistoricoSessoes } from "@/components/sessao/historico-sessoes";

export function ContadorSessaoSidebar() {
  const { enabled, registro, carregado, erro } = usePonto();
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const agora = useNow();

  // Ponto só para funcionários: para CLIENTE o contador não existe.
  if (!enabled) return null;

  const inicioMs = registro ? new Date(registro.inicio).getTime() : null;

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

        {registro ? (
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
              : carregado
                ? "Sem registro ativo"
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
