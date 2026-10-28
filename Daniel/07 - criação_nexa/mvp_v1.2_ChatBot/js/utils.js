export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function timeLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return timeFormatter.format(date);
}

export function dayGroupLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Mais antigas";

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday - startDate) / 86_400_000);

  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return "Últimos 7 dias";
  return "Mais antigas";
}

export function titleFromPrompt(prompt, maxLength = 60) {
  const clean = String(prompt ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Nova conversa";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trimEnd()}…`;
}

export function debounce(fn, wait = 150) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

/**
 * Normaliza a URL base do Ollama: adiciona http:// quando falta o protocolo,
 * remove barras finais e rejeita valores inválidos.
 */
export function normalizeBaseUrl(value) {
  let url = String(value ?? "").trim();
  if (!url) return "";

  const hasHttpScheme = /^https?:\/\//i.test(url);
  const hasOtherScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
  if (!hasHttpScheme && hasOtherScheme) return "";
  if (!hasHttpScheme) url = `http://${url}`;

  url = url.replace(/\/+$/, "");

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (!parsed.hostname) return "";
    return url;
  } catch {
    return "";
  }
}

export function isLoopbackHost(host) {
  const value = String(host ?? "").toLowerCase();
  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    value === "[::1]" ||
    value.endsWith(".localhost")
  );
}

/**
 * O Ollama aceita, por padrão, apenas origens de loopback (localhost/127.0.0.1).
 * Quando a interface é aberta por um IP, o navegador envia essa origem e o
 * Ollama responde 403 (o fetch falha como se estivesse offline). Esta dica
 * explica o motivo e o que fazer.
 */
export function corsHint() {
  if (typeof window === "undefined" || !window.location) return "";

  const { hostname, origin, port } = window.location;
  if (!hostname || isLoopbackHost(hostname)) return "";

  const localUrl = port ? `http://localhost:${port}` : "http://localhost";
  return `Esta página foi aberta por ${origin}. O Ollama só aceita origens localhost por padrão, então a conexão é bloqueada por CORS. Reinicie o Ollama com OLLAMA_ORIGINS="${origin}" ou abra a interface em ${localUrl}.`;
}
