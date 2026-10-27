export interface TempoResponsavel {
  usuarioId: string;
  nome: string;
  tempoMs: number;
}

export interface EtapaPipeline {
  etapaId: string;
  nome: string;
  tipo: string;
  quantidade: number;
  valorMensal: number;
}

export interface PainelResumo {
  data: string;
  totalDia: number;
  ocorrenciasDiaPorStatus: Record<string, number>;
  atrasadas: number;
  percentualNoPrazo30d: number | null;
  tempoTrabalhado30dMs: number;
  tempoPorResponsavel30d: TempoResponsavel[];
  empresasPorStatus: Record<string, number>;
  mrr?: number;
  pipelineCrm?: EtapaPipeline[];
}
