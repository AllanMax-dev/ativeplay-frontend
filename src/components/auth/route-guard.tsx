"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

function defaultRoute(isClient: boolean): string {
  return isClient ? "/portal" : "/inicio";
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, me } = useAuth();
  const isClient = me?.perfil === "CLIENTE";
  const isAllowed = isClient ? pathname === "/portal" : pathname === "/inicio";

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && !isAllowed) {
      router.replace(defaultRoute(isClient));
    }
  }, [status, isAllowed, isClient, router]);

  if (status === "loading" || status === "anonymous" || !isAllowed) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/40 px-6">
        <div className="w-full max-w-sm space-y-4" aria-label="Carregando sessão">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </main>
    );
  }

  return children;
}
