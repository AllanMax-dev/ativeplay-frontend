"use client";

import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIA_LABELS, SenhaFormDialog } from "@/components/cliente/senha-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { copyToClipboard } from "@/lib/format";
import type { CategoriaSenha, SenhaRevelada, SenhaSalva } from "@/types/cliente";

/** Por quanto tempo uma senha revelada fica visível antes de voltar a ser ocultada. */
const REVEAL_MS = 20_000;

function normalize(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * Cadastro de senhas salvas do cliente: define, visualiza e edita os acessos a outros
 * sistemas ou bancos. Clique em Usuário ou Senha para copiar. Cada senha revelada ou
 * copiada é registrada na auditoria pelo backend.
 */
export function SenhasPanel({
  empresaId,
  empresaNome,
  canWrite,
}: {
  empresaId: string;
  empresaNome: string;
  canWrite: boolean;
}) {
  const [senhas, setSenhas] = useState<SenhaSalva[] | null>(null);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<CategoriaSenha | "TODAS">("TODAS");
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SenhaSalva | null>(null);
  const [deleting, setDeleting] = useState<SenhaSalva | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    api
      .get<SenhaSalva[]>(`/empresas/${empresaId}/senhas`)
      .then((response) => {
        if (active) setSenhas(response);
      })
      .catch((cause: unknown) => {
        if (active) {
          setSenhas([]);
          setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar as senhas.");
        }
      });
    return () => {
      active = false;
    };
  }, [empresaId]);

  useEffect(() => {
    const pending = timers.current;
    return () => Object.values(pending).forEach((id) => window.clearTimeout(id));
  }, []);

  const filtered = useMemo(() => {
    const term = normalize(busca.trim());
    return (senhas ?? []).filter(
      (item) =>
        (categoria === "TODAS" || item.categoria === categoria) &&
        (!term || normalize(item.acesso).includes(term) || normalize(item.usuario).includes(term) || normalize(item.url).includes(term)),
    );
  }, [busca, categoria, senhas]);

  function flashCopied(key: string) {
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
  }

  function hideLater(id: string) {
    window.clearTimeout(timers.current[id]);
    timers.current[id] = window.setTimeout(() => {
      setRevealed((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }, REVEAL_MS);
  }

  async function fetchSecret(item: SenhaSalva): Promise<string | null> {
    if (revealed[item.id] !== undefined) return revealed[item.id];
    setLoadingSecret(item.id);
    setError(null);
    try {
      const response = await api.get<SenhaRevelada>(`/empresas/${empresaId}/senhas/${item.id}/senha`);
      return response.senha;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível obter a senha.");
      return null;
    } finally {
      setLoadingSecret(null);
    }
  }

  async function toggleReveal(item: SenhaSalva) {
    if (revealed[item.id] !== undefined) {
      setRevealed((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      return;
    }
    const secret = await fetchSecret(item);
    if (secret === null) return;
    setRevealed((current) => ({ ...current, [item.id]: secret }));
    hideLater(item.id);
  }

  async function copySecret(item: SenhaSalva) {
    const secret = await fetchSecret(item);
    if (secret === null) return;
    if (await copyToClipboard(secret)) flashCopied(`senha:${item.id}`);
    else setError("O navegador bloqueou a cópia. Revele a senha e copie manualmente.");
  }

  async function copyUser(item: SenhaSalva) {
    if (!item.usuario) return;
    if (await copyToClipboard(item.usuario)) flashCopied(`usuario:${item.id}`);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    setError(null);
    try {
      await api.delete(`/empresas/${empresaId}/senhas/${deleting.id}`);
      setSenhas((current) => current?.filter((item) => item.id !== deleting.id) ?? null);
      setDeleting(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível excluir o acesso.");
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-background" aria-labelledby="passwords-title">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 id="passwords-title" className="font-semibold">Cadastro de senhas salvas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aqui você define, visualiza e edita as senhas de {empresaNome} para acesso a outros sistemas ou bancos.
            Clique sobre os campos Usuário e Senha para copiar a informação desejada.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden="true" /> Adicionar senha
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-b bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:px-6">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Filtrar por acesso, usuário ou link"
            aria-label="Filtrar senhas"
            className="h-9 bg-background pl-8"
          />
        </div>
        <Select value={categoria} onValueChange={(value) => value && setCategoria(value as CategoriaSenha | "TODAS")}>
          <SelectTrigger className="h-9 w-full bg-background sm:w-56">
            <SelectValue>{categoria === "TODAS" ? "Todas as categorias" : CATEGORIA_LABELS[categoria]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas as categorias</SelectItem>
            {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          Cifradas e com visualização auditada
        </p>
      </div>

      {error ? (
        <div className="mx-5 mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive sm:mx-6" role="alert">
          {error}
        </div>
      ) : null}

      {senhas === null ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-11 w-full" />)}
        </div>
      ) : filtered.length > 0 ? (
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5 sm:pl-6">Acesso</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Senha</TableHead>
              <TableHead className="pr-5 text-right sm:pr-6">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => {
              const secret = revealed[item.id];
              const userCopied = copied === `usuario:${item.id}`;
              const secretCopied = copied === `senha:${item.id}`;
              return (
                <TableRow key={item.id}>
                  <TableCell className="pl-5 sm:pl-6">
                    <p className="font-medium">{item.acesso}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{CATEGORIA_LABELS[item.categoria]}</Badge>
                      {item.observacoes ? (
                        <span className="max-w-56 truncate text-xs text-muted-foreground" title={item.observacoes}>
                          {item.observacoes}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.usuario ? (
                      <button
                        type="button"
                        onClick={() => void copyUser(item)}
                        className="group inline-flex max-w-64 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted"
                        title="Clique para copiar o usuário"
                      >
                        <span className="truncate">{item.usuario}</span>
                        {userCopied ? (
                          <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                        ) : (
                          <Copy className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden="true" />
                        )}
                        <span className="sr-only">{userCopied ? "Copiado" : "Copiar usuário"}</span>
                      </button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.possuiSenha ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void copySecret(item)}
                          disabled={loadingSecret === item.id}
                          className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-sm hover:bg-muted disabled:opacity-50"
                          title="Clique para copiar a senha"
                        >
                          <span>{secret ?? "••••••••"}</span>
                          {secretCopied ? (
                            <Check className="size-3.5 text-primary" aria-hidden="true" />
                          ) : (
                            <Copy className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" aria-hidden="true" />
                          )}
                          <span className="sr-only">{secretCopied ? "Copiada" : "Copiar senha"}</span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => void toggleReveal(item)}
                          disabled={loadingSecret === item.id}
                          aria-label={secret !== undefined ? "Ocultar senha" : "Mostrar senha"}
                          title={secret !== undefined ? "Ocultar" : "Mostrar por 20 segundos"}
                        >
                          {secret !== undefined ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                        </Button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <LockKeyhole className="size-3.5" aria-hidden="true" /> Sem senha
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="pr-5 text-right sm:pr-6">
                    <div className="inline-flex items-center gap-1">
                      {item.url ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          render={<a href={item.url} target="_blank" rel="noopener noreferrer" />}
                          nativeButton={false}
                          aria-label={`Abrir ${item.acesso}`}
                          title="Abrir link de acesso"
                        >
                          <ExternalLink aria-hidden="true" />
                        </Button>
                      ) : null}
                      {canWrite ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => { setEditing(item); setFormOpen(true); }}
                            aria-label={`Editar ${item.acesso}`}
                            title="Editar"
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleting(item)}
                            aria-label={`Excluir ${item.acesso}`}
                            title="Excluir"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="px-6 py-14 text-center">
          <KeyRound className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 font-semibold">
            {senhas.length === 0 ? "Nenhuma senha salva para este cliente" : "Nenhum acesso encontrado"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {senhas.length === 0
              ? "Cadastre os acessos de bancos, certificado digital, portais e sistemas que o cliente passou ao escritório."
              : "Ajuste o filtro ou a categoria."}
          </p>
        </div>
      )}

      {senhas && senhas.length > 0 ? (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground sm:px-6">
          {filtered.length} de {senhas.length} {senhas.length === 1 ? "acesso" : "acessos"}
        </p>
      ) : null}

      {formOpen ? (
        <SenhaFormDialog
          key={editing?.id ?? "nova"}
          empresaId={empresaId}
          empresaNome={empresaNome}
          senha={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onSaved={(saved) => {
            setSenhas((current) => {
              const list = current ?? [];
              const exists = list.some((item) => item.id === saved.id);
              const next = exists ? list.map((item) => (item.id === saved.id ? saved : item)) : [...list, saved];
              return next.sort((a, b) => a.acesso.localeCompare(b.acesso, "pt-BR"));
            });
            setRevealed((current) => {
              const next = { ...current };
              delete next[saved.id];
              return next;
            });
            setFormOpen(false);
            setEditing(null);
          }}
        />
      ) : null}

      {deleting ? (
        <Dialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Excluir acesso</DialogTitle>
              <DialogDescription>
                O acesso {deleting.acesso} e a senha guardada serão removidos definitivamente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deletingBusy}>
                {deletingBusy ? "Excluindo..." : "Excluir acesso"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  );
}
