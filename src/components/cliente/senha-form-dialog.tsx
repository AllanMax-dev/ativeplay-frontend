"use client";

import { Eye, EyeOff, Wand2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { CategoriaSenha, SenhaRequest, SenhaSalva } from "@/types/cliente";

export const CATEGORIA_LABELS: Record<CategoriaSenha, string> = {
  BANCO: "Banco",
  CERTIFICADO: "Certificado digital",
  PORTAL: "Portal / concessionária",
  ERP: "ERP / sistema",
  EMAIL: "E-mail",
  GOVERNO: "Governo / prefeitura",
  OUTRO: "Outro",
};

/** Senha aleatória forte (sem caracteres ambíguos), gerada no navegador. */
function gerarSenha(tamanho = 16): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?";
  const valores = new Uint32Array(tamanho);
  crypto.getRandomValues(valores);
  return Array.from(valores, (valor) => alfabeto[valor % alfabeto.length]).join("");
}

export function SenhaFormDialog({
  empresaId,
  empresaNome,
  senha,
  onClose,
  onSaved,
}: {
  empresaId: string;
  empresaNome: string;
  senha: SenhaSalva | null;
  onClose: () => void;
  onSaved: (saved: SenhaSalva) => void;
}) {
  const [acesso, setAcesso] = useState(senha?.acesso ?? "");
  const [categoria, setCategoria] = useState<CategoriaSenha>(senha?.categoria ?? "BANCO");
  const [usuario, setUsuario] = useState(senha?.usuario ?? "");
  const [valorSenha, setValorSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [removerSenha, setRemoverSenha] = useState(false);
  const [url, setUrl] = useState(senha?.url ?? "");
  const [observacoes, setObservacoes] = useState(senha?.observacoes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  function validate(): Record<string, string> {
    const fields: Record<string, string> = {};
    if (!acesso.trim()) fields.acesso = "Informe o nome do acesso.";
    if (url.trim() && !/^https?:\/\/\S+$/i.test(url.trim())) {
      fields.url = "O link deve começar com http:// ou https://";
    }
    return fields;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validate();
    setClientErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const payload: SenhaRequest = {
      acesso: acesso.trim(),
      categoria,
      usuario: usuario.trim() || null,
      senha: removerSenha ? null : valorSenha || null,
      url: url.trim() || null,
      observacoes: observacoes.trim() || null,
      removerSenha: senha ? removerSenha : undefined,
    };

    setSubmitting(true);
    setError(null);
    try {
      const saved = senha
        ? await api.put<SenhaSalva, SenhaRequest>(`/empresas/${empresaId}/senhas/${senha.id}`, payload)
        : await api.post<SenhaSalva, SenhaRequest>(`/empresas/${empresaId}/senhas`, payload);
      onSaved(saved);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause : new ApiError({ status: 0, detail: "Não foi possível salvar o acesso." }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const errors = { ...error?.campos, ...clientErrors };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{senha ? "Editar acesso" : "Adicionar senha"}</DialogTitle>
          <DialogDescription>
            Acessos de {empresaNome} usados na gestão financeira: bancos, certificado digital, portais de energia,
            prefeitura e sistemas. A senha é guardada cifrada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate autoComplete="off">
          {error ? (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error.message}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="space-y-2">
              <Label htmlFor="senha-acesso">Acesso *</Label>
              <Input
                id="senha-acesso"
                value={acesso}
                maxLength={150}
                autoFocus
                placeholder="Ex.: Banco Itaú, Portal da energia"
                aria-invalid={Boolean(errors.acesso)}
                onChange={(event) => { setAcesso(event.target.value); setClientErrors({}); }}
                className="h-10"
              />
              {errors.acesso ? <p className="text-sm text-destructive">{errors.acesso}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(value) => value && setCategoria(value as CategoriaSenha)}>
                <SelectTrigger className="h-10 w-full"><SelectValue>{CATEGORIA_LABELS[categoria]}</SelectValue></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha-usuario">Usuário</Label>
            <Input
              id="senha-usuario"
              value={usuario}
              maxLength={200}
              placeholder="Login, CPF/CNPJ, agência e conta ou e-mail"
              autoComplete="off"
              onChange={(event) => setUsuario(event.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha-valor">Senha</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="senha-valor"
                  type={mostrar ? "text" : "password"}
                  value={valorSenha}
                  maxLength={500}
                  disabled={removerSenha}
                  autoComplete="new-password"
                  placeholder={senha?.possuiSenha ? "Deixe em branco para manter a senha atual" : "Senha do acesso"}
                  onChange={(event) => setValorSenha(event.target.value)}
                  className="h-10 pr-10 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1.5 right-1.5"
                  onClick={() => setMostrar((current) => !current)}
                  aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrar ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                disabled={removerSenha}
                onClick={() => { setValorSenha(gerarSenha()); setMostrar(true); }}
                title="Gerar uma senha forte"
              >
                <Wand2 aria-hidden="true" /> Gerar
              </Button>
            </div>
            {senha?.possuiSenha ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={removerSenha} onCheckedChange={(checked) => setRemoverSenha(checked)} />
                Remover a senha guardada
              </label>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha-url">Link de acesso</Label>
            <Input
              id="senha-url"
              type="url"
              value={url}
              maxLength={500}
              placeholder="https://"
              aria-invalid={Boolean(errors.url)}
              onChange={(event) => { setUrl(event.target.value); setClientErrors({}); }}
              className="h-10"
            />
            {errors.url ? <p className="text-sm text-destructive">{errors.url}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha-observacoes">Observações</Label>
            <Textarea
              id="senha-observacoes"
              value={observacoes}
              maxLength={5000}
              rows={3}
              placeholder="Ex.: token com o sócio, validade do certificado, perguntas de segurança"
              onChange={(event) => setObservacoes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Salvando..." : senha ? "Salvar alterações" : "Adicionar senha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
