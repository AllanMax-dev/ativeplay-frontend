import type { Prioridade } from "@/types/tarefa";

export interface ChecklistModeloSubitem {
  id: string;
  texto: string;
}

export interface ChecklistModeloItem {
  id: string;
  titulo: string;
  observacoes?: string;
  prioridade: Prioridade;
  prazoDias?: number | null;
  ordem: number;
  subitens: ChecklistModeloSubitem[];
}

export interface ChecklistModeloRequest {
  titulo: string;
  observacoes: string | null;
  prioridade: Prioridade;
  prazoDias: number | null;
  subitens: Array<{ id?: string; texto: string }>;
}
