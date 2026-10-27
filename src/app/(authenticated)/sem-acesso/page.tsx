import { ShieldX } from "lucide-react";

export default function SemAcessoPage() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <ShieldX className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">
        Nenhum módulo disponível
      </h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        Seu perfil ainda não possui permissão de leitura. Peça ao administrador do escritório para revisar seus acessos.
      </p>
    </div>
  );
}
