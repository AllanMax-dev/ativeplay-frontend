"use client";

import { useEffect, useState } from "react";
import { Clock3, History } from "lucide-react";
import { api } from "@/lib/api";
import { formatClock } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SessaoAcesso = {
  id: string;
  inicio: string;
  fim?: string | null;
  duracaoMs: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(data));
}

function formatarHora(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(data));
}

export function HistoricoSessoes({ open, onOpenChange }: Props) {
  const [sessoes, setSessoes] = useState<SessaoAcesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;

    let ativo = true;

    async function carregar() {
      setLoading(true);
      setErro(false);

      try {
        const dados = await api.get<SessaoAcesso[]>("/sessoes-acesso");

        if (ativo) setSessoes(dados);
      } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        if (ativo) setErro(true);
      } finally {
        if (ativo) setLoading(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const intervalo = window.setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            Histórico de sessões
          </DialogTitle>
          <DialogDescription>
            Consulte seus últimos 100 acessos à plataforma.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Carregando histórico...
          </p>
        ) : erro ? (
          <p className="py-8 text-center text-sm text-destructive">
            Não foi possível carregar o histórico.
          </p>
        ) : sessoes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma sessão encontrada.
          </p>
        ) : (
          <div className="space-y-3">
            {sessoes.map((sessao) => {
              const emAndamento = !sessao.fim;

              const inicioMs = new Date(sessao.inicio).getTime();

              const duracaoMs = emAndamento
                ? Math.max(0, agora - inicioMs)
                : sessao.duracaoMs;

              return (
                <div key={sessao.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {formatarData(sessao.inicio)}
                      </p>

                      <p className="mt-2 text-xs text-muted-foreground">
                        Entrada: {formatarHora(sessao.inicio)}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Saída: {sessao.fim ? formatarHora(sessao.fim) : "—"}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={
                          emAndamento
                            ? "rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                            : "rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {emAndamento ? "Em andamento" : "Encerrada"}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Clock3
                          className="size-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />

                        <span className="text-sm font-semibold tabular-nums">
                          {formatClock(duracaoMs)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
