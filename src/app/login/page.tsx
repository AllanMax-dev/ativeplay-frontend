import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,0.95fr)_minmax(30rem,1.05fr)]">
      <section className="hidden bg-accent/45 px-10 py-12 text-foreground lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            AP
          </span>
          <span className="text-lg font-semibold tracking-[-0.02em]">Ative Play</span>
        </div>

        <div className="max-w-xl pb-10">
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em] xl:text-5xl">
            A operação financeira do seu escritório em um só lugar.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Organize empresas, tarefas, documentos e relacionamentos com uma visão clara do trabalho diário.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-foreground/85">
            {["Acesso protegido por perfil", "Sessão renovada com segurança", "Portal exclusivo para clientes"].map(
              (item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">Ative Play · Gestão operacional</p>
      </section>

      <section className="flex items-center justify-center bg-card px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-9 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                AP
              </span>
              <span className="font-semibold tracking-[-0.02em]">Ative Play</span>
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Acesse sua conta</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Use o e-mail e a senha cadastrados no seu escritório.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
