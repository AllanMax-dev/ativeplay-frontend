export type StatusOcorrencia =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "PAUSADA"
  | "CONCLUIDA"
  | "CANCELADA";

export type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export interface OcorrenciaRef {
  id: string;
  nome: string;
}

export interface OcorrenciaEmpresaRef {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
}

export interface OcorrenciaSetorRef {
  id: string;
  nome: string;
  cor: string;
}

export interface OcorrenciaTarefa {
  id: string;
  definicaoId?: string;
  titulo: string;
  descricao?: string;
  data: string;
  prazo: string;
  prioridade: Prioridade;
  status: StatusOcorrencia;
  slaViolado: boolean;
  atrasada: boolean;
  visivelCliente: boolean;
  tempoEstimadoMin?: number;
  tempoGastoAtualMs: number;
  cronometroInicio?: string;
  iniciadaEm?: string;
  concluidaEm?: string;
  concluidaPorId?: string;
  empresa: OcorrenciaEmpresaRef;
  responsavel?: OcorrenciaRef;
  setor?: OcorrenciaSetorRef;
  comentarios: number;
  anexos: number;
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
}
