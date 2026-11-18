import type { Perfil } from "@/types/api";

/** Registro do ponto eletrônico (de um login até o logout). */
export interface RegistroPonto {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  inicio: string;
  fim: string | null;
  ultimoSinal: string | null;
  pendente: boolean;
  duracaoMs: number;
}

export interface CargaDia {
  /** AAAA-MM-DD no fuso do escritório. */
  data: string;
  totalMs: number;
}

export interface CargaFuncionario {
  usuarioId: string;
  usuarioNome: string;
  perfil: Perfil;
  totalMesMs: number;
  pendentes: number;
  dias: CargaDia[];
}
