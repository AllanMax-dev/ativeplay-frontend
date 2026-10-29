import type { MeResponse, Modulo, Perfil } from "@/types/api";

export interface AppRoute {
  path: string;
  modulo: Modulo;
  perfis?: Perfil[];
}

export const APP_ROUTES: AppRoute[] = [
  { path: "/inicio", modulo: "PAINEL" },
  { path: "/empresas", modulo: "EMPRESAS" },
  { path: "/tarefas/checklist-modelo", modulo: "TAREFAS", perfis: ["ADMIN", "GESTOR"] },
  { path: "/tarefas", modulo: "TAREFAS" },
  { path: "/usuarios", modulo: "USUARIOS" },
  { path: "/setores", modulo: "CONFIGURACOES" },
  { path: "/permissoes", modulo: "CONFIGURACOES" },
  { path: "/auditoria", modulo: "AUDITORIA" },
];

export function canReadModule(me: MeResponse, modulo: Modulo): boolean {
  if (me.perfil === "CLIENTE") return false;
  return (
    me.permissoes === "TODAS" ||
    me.permissoes.some((permissao) => permissao.modulo === modulo)
  );
}

export function canWriteModule(me: MeResponse, modulo: Modulo): boolean {
  if (me.perfil === "CLIENTE") return false;
  return (
    me.permissoes === "TODAS" ||
    me.permissoes.some(
      (permissao) => permissao.modulo === modulo && permissao.escrita,
    )
  );
}

export function defaultAuthenticatedRoute(me: MeResponse): string {
  if (me.perfil === "CLIENTE") return "/portal";
  return APP_ROUTES.find(
    (route) => canReadModule(me, route.modulo) && (!route.perfis || route.perfis.includes(me.perfil)),
  )?.path ?? "/sem-acesso";
}

export function canAccessPath(me: MeResponse, pathname: string): boolean {
  if (me.perfil === "CLIENTE") return pathname === "/portal";

  if (pathname === "/sem-acesso") {
    return defaultAuthenticatedRoute(me) === "/sem-acesso";
  }

  const route = APP_ROUTES.find(
    (candidate) =>
      pathname === candidate.path || pathname.startsWith(`${candidate.path}/`),
  );
  return route
    ? canReadModule(me, route.modulo) && (!route.perfis || route.perfis.includes(me.perfil))
    : false;
}
