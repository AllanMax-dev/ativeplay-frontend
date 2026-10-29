import type { Prioridade } from "@/types/tarefa";

/** Referência resumida a um usuário (responsável, autor). */
export interface UsuarioRefNullable {
  id: string;
  nome: string | null;
}

// ------------------------------------------------------------------ filtro por empresa

/** GET /tarefas/ocorrencias/empresas — empresas do filtro de "Tarefas do dia". */
export interface EmpresaDoDia {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  status: string;
  naCarteira: boolean;
  total: number;
  abertas: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
  checklistPendentes: number;
}

// ------------------------------------------------------------------ contador geral

/** Sessão de trabalho: tempo em que o usuário esteve "dentro" de uma empresa. */
export interface SessaoTrabalho {
  id: string;
  usuarioId: string;
  usuarioNome?: string;
  empresaId: string;
  empresaNome?: string;
  inicio: string;
  fim?: string;
  duracaoMs: number;
}

export interface TempoEmpresa {
  empresaId: string;
  empresaNome?: string;
  totalMs: number;
  sessoes: number;
}

/** GET /sessoes/resumo */
export interface ResumoDia {
  data: string;
  usuarioId: string;
  totalMs: number;
  atual?: SessaoTrabalho | null;
  empresas: TempoEmpresa[];
  geradoEm: string;
}

export interface RentabilidadeEmpresa {
  empresaId: string;
  empresaNome: string;
  totalMs: number;
  pessoas: number;
  honorarioMensal?: number | null;
  valorHora?: number | null;
}

/** GET /sessoes/rentabilidade */
export interface Rentabilidade {
  de: string;
  ate: string;
  totalMs: number;
  empresas: RentabilidadeEmpresa[];
}

// ------------------------------------------------------------------ checklist

export interface ChecklistSubitem {
  id: string;
  texto: string;
  concluido: boolean;
}

export interface ChecklistItem {
  id: string;
  empresaId: string;
  titulo: string;
  observacoes?: string;
  prazo?: string;
  prioridade: Prioridade;
  atrasado: boolean;
  responsavel?: UsuarioRefNullable;
  criadoPor?: UsuarioRefNullable;
  concluido: boolean;
  concluidoEm?: string;
  concluidoPor?: UsuarioRefNullable;
  subitens: ChecklistSubitem[];
  subitensConcluidos: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ChecklistItemRequest {
  titulo: string;
  observacoes: string | null;
  prazo: string | null;
  prioridade: Prioridade;
  responsavelId: string | null;
  subitens: Array<{ id?: string; texto: string; concluido: boolean }>;
}

// ------------------------------------------------------------------ senhas salvas

export type CategoriaSenha =
  | "BANCO"
  | "CERTIFICADO"
  | "PORTAL"
  | "ERP"
  | "EMAIL"
  | "GOVERNO"
  | "OUTRO";

export interface SenhaSalva {
  id: string;
  empresaId: string;
  acesso: string;
  categoria: CategoriaSenha;
  usuario?: string;
  possuiSenha: boolean;
  url?: string;
  observacoes?: string;
  criadoPor?: UsuarioRefNullable;
  atualizadoPor?: UsuarioRefNullable;
  criadoEm: string;
  atualizadoEm: string;
}

export interface SenhaRequest {
  acesso: string;
  categoria: CategoriaSenha;
  usuario: string | null;
  senha: string | null;
  url: string | null;
  observacoes: string | null;
  removerSenha?: boolean;
}

export interface SenhaRevelada {
  id: string;
  senha: string;
}
