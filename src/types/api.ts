export type Perfil = "ADMIN" | "GESTOR" | "OPERADOR" | "CLIENTE";

export type Modulo =
  | "PAINEL"
  | "EMPRESAS"
  | "TAREFAS"
  | "CRM"
  | "DOCUMENTOS"
  | "RELATORIOS"
  | "INTEGRACOES"
  | "USUARIOS"
  | "CONFIGURACOES"
  | "AUDITORIA";

export interface Pagina<T> {
  dados: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

export interface ProblemDetail {
  status: number;
  detail: string;
  campos?: Record<string, string>;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface UsuarioResumo {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  escritorioId: string;
  empresaId: string | null;
}

export interface SessaoResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  usuario: UsuarioResumo;
}

export interface EscritorioResumo {
  id: string;
  nome: string;
  slug: string;
  plano: string;
  fusoHorario: string;
}

export interface EmpresaResumo {
  id: string;
  razaoSocial: string;
}

export interface SetorResumo {
  id: string;
  nome: string;
}

export interface PermissaoResumo {
  modulo: Modulo;
  escrita: boolean;
}

export interface MeResponse {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  cargo: string | null;
  escritorio: EscritorioResumo;
  empresa?: EmpresaResumo;
  setores: SetorResumo[];
  permissoes: "TODAS" | PermissaoResumo[];
}
