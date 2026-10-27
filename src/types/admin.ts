import type { Modulo, Perfil } from "@/types/api";

export interface UsuarioLista {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  cargo?: string;
  telefone?: string;
  ativo: boolean;
  empresaId?: string;
  ultimoAcesso?: string;
  criadoEm: string;
  setores: string[];
  empresasNaCarteira: number;
}

export interface UsuarioSetor {
  id: string;
  nome: string;
}

export interface UsuarioEmpresa {
  id: string;
  razaoSocial: string;
}

export interface UsuarioDetalhe {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  cargo?: string;
  telefone?: string;
  ativo: boolean;
  empresaId?: string;
  ultimoAcesso?: string;
  criadoEm: string;
  atualizadoEm: string;
  setores: UsuarioSetor[];
  carteira: UsuarioEmpresa[];
}

export interface CriarUsuarioRequest {
  nome: string;
  email: string;
  perfil: Perfil;
  cargo: string | null;
  telefone: string | null;
  senha: string | null;
  empresaId: string | null;
  setorIds: string[];
  empresaIds: string[];
}

export interface AtualizarUsuarioRequest {
  nome: string;
  email: string;
  perfil: Perfil;
  cargo: string | null;
  telefone: string | null;
  empresaId: string | null;
}

export interface UsuarioCriadoResposta {
  usuario: UsuarioDetalhe;
  senhaTemporaria?: string;
}

export interface SenhaTemporariaResposta {
  senhaTemporaria: string;
}

export interface Setor {
  id: string;
  nome: string;
  cor?: string;
  ordem: number;
  ativo: boolean;
  membros: number;
}

export interface SetorRequest {
  nome: string;
  cor: string | null;
}

export type NivelPermissao = "NENHUM" | "LEITURA" | "ESCRITA";

export interface PermissaoItem {
  perfil: Perfil;
  modulo: Modulo;
  nivel: NivelPermissao;
}

export interface AuditoriaItem {
  id: number;
  escritorioId: string;
  usuarioId?: string;
  empresaId?: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  descricao?: string;
  dados?: Record<string, unknown>;
  ip?: string;
  criadoEm: string;
}
