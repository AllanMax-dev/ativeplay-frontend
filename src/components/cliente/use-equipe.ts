"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { canReadModule } from "@/lib/access-control";
import { api, withQuery } from "@/lib/api";
import type { UsuarioLista } from "@/types/admin";
import type { Pagina } from "@/types/api";
import type { UsuarioRef } from "@/types/empresa";

/**
 * Pessoas que podem ser responsáveis por algo da empresa: toda a equipe ativa para quem
 * pode listar usuários; caso contrário, a equipe vinculada à empresa.
 */
export function useEquipeEmpresa(empresaId: string): { team: UsuarioRef[]; loading: boolean } {
  const { me } = useAuth();
  const canListUsers = me ? canReadModule(me, "USUARIOS") : false;
  const [state, setState] = useState<{ key: string; team: UsuarioRef[] } | null>(null);
  const key = `${empresaId}:${canListUsers}`;

  useEffect(() => {
    let active = true;
    const request = canListUsers
      ? api
          .get<Pagina<UsuarioLista>>(withQuery("/usuarios", { ativo: true, pagina: 1, porPagina: 100 }))
          .then((response) =>
            response.dados
              .filter((user) => user.perfil !== "CLIENTE")
              .map((user) => ({ id: user.id, nome: user.nome })),
          )
      : api.get<UsuarioRef[]>(`/empresas/${empresaId}/equipe`);

    request
      .then((team) => {
        if (active) setState({ key, team });
      })
      .catch(() => {
        if (active) setState({ key, team: me ? [{ id: me.id, nome: me.nome }] : [] });
      });

    return () => {
      active = false;
    };
  }, [canListUsers, empresaId, key, me]);

  return { team: state?.key === key ? state.team : [], loading: state?.key !== key };
}
