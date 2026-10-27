export type RegimeTributario =
  | "SIMPLES_NACIONAL"
  | "LUCRO_PRESUMIDO"
  | "LUCRO_REAL"
  | "MEI"
  | "OUTRO";

export type StatusEmpresa = "ONBOARDING" | "ATIVA" | "SUSPENSA" | "ENCERRADA";

export interface UsuarioRef {
  id: string;
  nome: string;
}

export interface EmpresaRequest {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regimeTributario: RegimeTributario | null;
  email: string | null;
  telefone: string | null;
  responsavelId: string | null;
  honorarioMensal: number | null;
  dataInicio: string | null;
  observacoes: string | null;
}

export interface EmpresaResumo {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  cnpjFormatado: string;
  regimeTributario?: RegimeTributario;
  status: StatusEmpresa;
  email?: string;
  telefone?: string;
  responsavel?: UsuarioRef;
  honorarioMensal?: number;
  dataInicio?: string;
  tarefasAbertasHoje: number;
  tarefasAtrasadas: number;
}

export interface EmpresaDetalhe extends EmpresaResumo {
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
  equipe: UsuarioRef[];
  usuariosPortal: Array<{
    id: string;
    nome: string;
    email: string;
    ativo: boolean;
    ultimoAcesso?: string;
  }>;
  integracoes: Array<{
    id: string;
    provedor: string;
    status: string;
    ultimaSincronizacao?: string;
  }>;
}
