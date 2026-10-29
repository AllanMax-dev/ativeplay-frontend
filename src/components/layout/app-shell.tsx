"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckSquare2,
  ClipboardList,
  FileText,
  History,
  House,
  Layers3,
  ListChecks,
  LogOut,
  Menu,
  Repeat2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ContadorGeralHeader } from "@/components/sessao/contador-geral";
import { SessaoProvider } from "@/components/sessao/sessao-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { canReadModule } from "@/lib/access-control";
import type { Modulo, Perfil } from "@/types/api";

interface NavigationItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  modulo?: Modulo;
  perfis?: Perfil[];
}

const OPERATION_NAVIGATION: NavigationItem[] = [
  { label: "Painel", href: "/inicio", icon: House, modulo: "PAINEL" },
  { label: "Empresas", href: "/empresas", icon: Building2, modulo: "EMPRESAS" },
  { label: "Tarefas do dia", href: "/tarefas", icon: CheckSquare2, modulo: "TAREFAS" },
  { label: "Checklist modelo", href: "/tarefas/checklist-modelo", icon: ListChecks, modulo: "TAREFAS", perfis: ["ADMIN", "GESTOR"] },
  { label: "Padrões", href: "/tarefas/padroes", icon: ClipboardList, modulo: "TAREFAS" },
  { label: "Rotinas", href: "/tarefas/rotinas", icon: Repeat2, modulo: "TAREFAS" },
  { label: "CRM", icon: BriefcaseBusiness, modulo: "CRM" },
  { label: "Documentos", icon: FileText, modulo: "DOCUMENTOS" },
  { label: "Relatórios", icon: BarChart3, modulo: "RELATORIOS" },
  { label: "Usuários", href: "/usuarios", icon: Users, modulo: "USUARIOS" },
  { label: "Setores", href: "/setores", icon: Layers3, modulo: "CONFIGURACOES" },
  { label: "Permissões", href: "/permissoes", icon: ShieldCheck, modulo: "CONFIGURACOES" },
  { label: "Auditoria", href: "/auditoria", icon: History, modulo: "AUDITORIA" },
];

const PROFILE_LABELS: Record<Perfil, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  OPERADOR: "Operador",
  CLIENTE: "Cliente",
};

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
        AP
      </span>
      <div>
        <p className="font-semibold tracking-[-0.02em] text-sidebar-foreground">Ative Play</p>
        <p className="text-xs text-sidebar-foreground/60">Gestão operacional</p>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { me } = useAuth();
  if (!me) return null;
  const navigation =
    me.perfil === "CLIENTE"
      ? [{ label: "Portal", href: "/portal", icon: House }]
      : OPERATION_NAVIGATION.filter(
          (item) =>
            item.modulo &&
            canReadModule(me, item.modulo) &&
            (!item.perfis || item.perfis.includes(me.perfil)),
        );

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Brand />
      </div>
      <Separator className="bg-sidebar-border" />
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Menu principal">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = item.href === pathname;
          if (!item.href) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/45"
                title="Disponível nas próximas fases"
                aria-disabled="true"
              >
                <Icon className="size-4" aria-hidden="true" />
                <span>{item.label}</span>
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wide">Em breve</span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 pb-5">
        <p className="text-xs font-medium text-sidebar-foreground">{me.nome}</p>
        <p className="mt-1 text-xs text-sidebar-foreground/60">{PROFILE_LABELS[me.perfil]}</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  return (
    <SessaoProvider>
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 bg-sidebar text-sidebar-foreground lg:block">
        <SidebarContent />
      </aside>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/45"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative h-full w-[min(18rem,86vw)] bg-sidebar text-sidebar-foreground shadow-2xl">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-4 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
            >
              <X aria-hidden="true" />
            </Button>
            <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm sm:px-6 lg:px-10">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{me?.escritorio.nome}</p>
            <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
          </div>
          <ContadorGeralHeader />
          <Button
            type="button"
            variant="ghost"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">{loggingOut ? "Saindo..." : "Sair"}</span>
          </Button>
        </header>
        <main className="px-4 py-7 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
    </SessaoProvider>
  );
}
