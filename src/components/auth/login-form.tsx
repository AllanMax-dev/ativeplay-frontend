"use client";

import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const { status, me, login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (status === "authenticated" && me) {
      router.replace(me.perfil === "CLIENTE" ? "/portal" : "/inicio");
    }
  }, [status, me, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const session = await login({ email, senha });
      router.replace(session.usuario.perfil === "CLIENTE" ? "/portal" : "/inicio");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause
          : new ApiError({
              status: 0,
              detail: "Não foi possível entrar. Tente novamente.",
            }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error.message}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@escritorio.com.br"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error?.campos?.email)}
          aria-describedby={error?.campos?.email ? "email-error" : undefined}
          className="h-11"
          required
        />
        {error?.campos?.email ? (
          <p id="email-error" className="text-sm text-destructive">
            {error.campos.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="senha">Senha</Label>
          <span className="text-xs text-muted-foreground">Mínimo de 8 caracteres</span>
        </div>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          placeholder="Digite sua senha"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          aria-invalid={Boolean(error?.campos?.senha)}
          aria-describedby={error?.campos?.senha ? "senha-error" : undefined}
          className="h-11"
          required
        />
        {error?.campos?.senha ? (
          <p id="senha-error" className="text-sm text-destructive">
            {error.campos.senha}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
        {submitting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <LockKeyhole aria-hidden="true" />
        )}
        {submitting ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
