export type StatusOcorrencia =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "PAUSADA"
  | "CONCLUIDA"
  | "CANCELADA";

export type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export type Recorrencia = "DIARIA" | "SEMANAL" | "MENSAL" | "UNICA";

export interface RegraTarefaRequest {
  setorId: string | null;
  nome: string;
  descricao: string | null;
  recorrencia: Recorrencia;
  diasSemana: number[];
  diaMes: number | null;
  apenasDiasUteis: boolean;
  horarioLimite: string;
  prioridade: Prioridade;
  tempoEstimadoMin: number | null;
}

export interface PadraoTarefa extends RegraTarefaRequest {
  id: string;
  ordem: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export type PadraoTarefaRequest = RegraTarefaRequest;

export interface DefinicaoTarefa extends RegraTarefaRequest {
  id: string;
  empresaId: string;
  padraoId: string | null;
  responsavelId: string | null;
  dataUnica: string | null;
  visivelCliente: boolean;
  ordem: number;
  ativa: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DefinicaoTarefaRequest extends RegraTarefaRequest {
  empresaId: string;
  padraoId: string | null;
  responsavelId: string | null;
  dataUnica: string | null;
  visivelCliente: boolean;
}

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
