import { CONFIG } from "./config.js";

function trimBaseUrl(url) {
  return String(url || CONFIG.ollamaUrl).replace(/\/+$/, "");
}

export async function listModels(baseUrl = CONFIG.ollamaUrl) {
  const options = { method: "GET" };
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    options.signal = AbortSignal.timeout(6000);
  }

  const response = await fetch(`${trimBaseUrl(baseUrl)}/api/tags`, options);
  if (!response.ok) {
    throw new Error(`Ollama respondeu com status ${response.status}.`);
  }

  const data = await response.json();
  const models = Array.isArray(data?.models) ? data.models : [];

  // "llama3.2:latest" e "llama3.2" apontam para o mesmo modelo; exibimos a
  // forma curta para manter o seletor limpo.
  const names = models
    .map((model) => String(model?.name ?? "").replace(/:latest$/, ""))
    .filter(Boolean);

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export async function checkHealth() {
  try {
    await listModels();
    return true;
  } catch {
    return false;
  }
}

/**
 * Envia o histórico para /api/chat e entrega os pedaços de texto via onToken.
 */
export async function streamChat({ baseUrl = CONFIG.ollamaUrl, model, messages, signal, onToken }) {
  const response = await fetch(`${trimBaseUrl(baseUrl)}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const text = await response.text();
      const data = JSON.parse(text);
      detail = data?.error || data?.message || "";
    } catch {
      // Corpo não-JSON: usa a mensagem padrão abaixo.
    }
    throw new Error(detail || `Ollama respondeu com status ${response.status}.`);
  }

  if (!response.body) {
    throw new Error("Este navegador não suporta streaming de resposta.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let data;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (data?.error) {
      throw new Error(String(data.error));
    }

    const chunk = data?.message?.content;
    if (typeof chunk === "string" && chunk.length > 0) {
      onToken(chunk);
    }

    if (data?.done) finished = true;
  };

  try {
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        handleLine(line);
        if (finished) break;
        newline = buffer.indexOf("\n");
      }
    }

    if (!finished) {
      buffer += decoder.decode();
      handleLine(buffer);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
