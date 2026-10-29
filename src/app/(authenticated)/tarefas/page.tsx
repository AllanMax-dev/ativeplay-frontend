import { Suspense } from "react";
import { TarefasScreen } from "@/components/tarefas/tarefas-screen";

export default function TarefasPage() {
  // useSearchParams (empresa e aba na URL) exige um limite de Suspense
  return (
    <Suspense fallback={null}>
      <TarefasScreen />
    </Suspense>
  );
}
