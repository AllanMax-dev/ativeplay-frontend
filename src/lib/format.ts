/** Cronômetro no formato 00:00:00. */
export function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

/** Duração legível: "2h 15min" ou "35min". */
export function formatHoursMinutes(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** "2026-10-29" → "29/10/2026", sem deslocar o dia pelo fuso. */
export function formatLocalDate(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** Nome de exibição de uma empresa: fantasia quando houver. */
export function companyDisplayName(company: { razaoSocial: string; nomeFantasia?: string | null }): string {
  return company.nomeFantasia?.trim() ? company.nomeFantasia : company.razaoSocial;
}

/** Data de hoje (YYYY-MM-DD) no fuso informado. */
export function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Copia para a área de transferência, com alternativa para navegadores sem a Clipboard API. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // segue para a alternativa abaixo
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Data (dd/mm/aaaa) de um instante, no fuso informado. */
export function formatDateInTimeZone(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(instant),
  );
}

/** Hora (hh:mm:ss) de um instante, no fuso informado. */
export function formatTimeInTimeZone(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

/** Data (AAAA-MM-DD) e hora (hh:mm) de um instante no fuso informado, para campos de formulário. */
export function instantToZonedParts(instant: string, timeZone: string): { data: string; hora: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { data: `${get("year")}-${get("month")}-${get("day")}`, hora: `${get("hour")}:${get("minute")}` };
}

/** Converte data (AAAA-MM-DD) e hora (hh:mm) do relógio do fuso informado no instante ISO (UTC). */
export function zonedPartsToInstant(data: string, hora: string, timeZone: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  const relogio = Date.UTC(ano, mes - 1, dia, h, min);
  const deslocamento = (utc: number) => {
    const { data: d, hora: t } = instantToZonedParts(new Date(utc).toISOString(), timeZone);
    const [a2, m2, d2] = d.split("-").map(Number);
    const [h2, mi2] = t.split(":").map(Number);
    return Date.UTC(a2, m2 - 1, d2, h2, mi2) - utc;
  };
  let utc = relogio - deslocamento(relogio);
  utc = relogio - deslocamento(utc);
  return new Date(utc).toISOString();
}
