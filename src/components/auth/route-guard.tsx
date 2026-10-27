"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canAccessPath,
  defaultAuthenticatedRoute,
} from "@/lib/access-control";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, me } = useAuth();
  const isAllowed = me ? canAccessPath(me, pathname) : false;

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && me && !isAllowed) {
      router.replace(defaultAuthenticatedRoute(me));
    }
  }, [status, me, isAllowed, router]);

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
