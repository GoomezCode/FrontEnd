/**
 * ChatBot flutuante.
 *
 * Módulo independente da WebUI principal: usa histórico próprio
 * (`WIDGET.storageKey`) e reaproveita apenas as partes sem DOM da aplicação
 * (`streamChat` e `renderMarkdown`). O modelo e o servidor vêm de
 * `state.settings`, portanto os controles da barra lateral valem aqui também.
 */

import { WIDGET } from "./config.js";
import { listModels, streamChat } from "./ollama.js";
import { renderMarkdown } from "./markdown.js";
import { state } from "./state.js";
import { corsHint, nowIso, uid } from "./utils.js";

const TYPING =
  '<span class="typing" aria-label="Gerando resposta"><i></i><i></i><i></i></span>';

const STATUS_LABELS = {
  unknown: "Conexão com o Ollama não verificada",
  checking: "Verificando conexão com o Ollama",
  online: "Ollama conectado",
  offline: "Ollama offline",
};

let els = null;
let controller = null;
let frame = 0;
let pendingId = null;
let pendingText = "";
let messages = [];
let isOpen = false;
let statusState = "unknown";
let lastCheck = 0;

/* ---------- Inicialização ---------- */

function init() {
  const root = document.getElementById("bot");
  if (!root) return;

  els = {
    root,
    panel: byId("bot-panel"),
    panelTitle: byId("bot-title"),
    subtitle: byId("bot-subtitle"),
    launcher: byId("bot-launcher"),
    badge: byId("bot-badge"),
    close: byId("bot-close"),
    clear: byId("bot-clear"),
    status: byId("bot-status"),
    messages: byId("bot-messages"),
    empty: byId("bot-empty"),
    greeting: byId("bot-greeting"),
    suggestions: byId("bot-suggestions"),
    banner: byId("bot-banner"),
    bannerUrl: byId("bot-banner-url"),
    bannerHint: byId("bot-banner-hint"),
    retry: byId("bot-retry"),
    form: byId("bot-form"),
    prompt: byId("bot-prompt"),
    send: byId("bot-send"),
    stop: byId("bot-stop"),
    sr: byId("bot-sr"),
  };

  const missing = Object.entries(els).find(([, node]) => !node);
  if (missing) {
    console.warn(`ChatBot: elemento #${missing[0]} não encontrado.`);
    els = null;
    return;
  }

  els.panelTitle.textContent = WIDGET.title;
  els.subtitle.textContent = WIDGET.subtitle;
  els.greeting.textContent = WIDGET.greeting;

  buildSuggestions();
  bindEvents();

  messages = loadMessages();
  setStatus("unknown");
  setStreamingUI(false);
  render();

  // Link direto: abrir o bot ao acessar a página com #chat.
  if (window.location.hash === "#chat") openPanel({ focus: false });
}

function byId(id) {
  return document.getElementById(id);
}

/* ---------- Persistência ---------- */

function normalizeMessage(message) {
  if (!message || !["user", "assistant"].includes(message.role)) return null;
  if (typeof message.content !== "string") return null;

  const normalized = {
    id: typeof message.id === "string" && message.id ? message.id : uid(),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt || nowIso(),
  };

  if (message.incomplete) normalized.incomplete = true;
  if (typeof message.error === "string" && message.error) normalized.error = message.error;
  return normalized;
}

function loadMessages() {
  try {
    const raw = localStorage.getItem(WIDGET.storageKey);
    if (!raw) return [];

    const data = JSON.parse(raw);
    const list = Array.isArray(data?.messages) ? data.messages : [];
    return list
      .map(normalizeMessage)
      .filter(Boolean)
      .slice(-WIDGET.maxMessages);
  } catch (error) {
    console.warn("ChatBot: não foi possível ler o histórico salvo.", error);
    return [];
  }
}

function persist() {
  const payload = {
    version: 1,
    updatedAt: nowIso(),
    messages: messages.slice(-WIDGET.maxMessages),
  };

  try {
    localStorage.setItem(WIDGET.storageKey, JSON.stringify(payload));
    return true;
  } catch (error) {
    for (const keep of [20, 10, 5, 1]) {
      try {
        localStorage.setItem(
          WIDGET.storageKey,
          JSON.stringify({ version: 1, updatedAt: nowIso(), messages: messages.slice(-keep) }),
        );
        console.warn("ChatBot: histórico reduzido para caber no armazenamento local.");
        return true;
      } catch {
        // Tenta um limite menor.
      }
    }

    console.warn("ChatBot: não foi possível salvar o histórico.", error);
    return false;
  }
}

function trimMessages() {
  if (messages.length > WIDGET.maxMessages) {
    messages = messages.slice(-WIDGET.maxMessages);
  }
}

/* ---------- Renderização ---------- */

function render() {
  const stick = isNearBottom();
  els.messages.replaceChildren();

  const hasMessages = messages.length > 0;
  els.empty.hidden = hasMessages;
  els.messages.hidden = !hasMessages;

  messages.forEach((message, index) => {
    els.messages.append(messageNode(message, index === messages.length - 1));
  });

  if (stick) els.messages.scrollTop = els.messages.scrollHeight;
}

function messageNode(message, isLast) {
  const article = document.createElement("article");
  article.className = `msg msg--${message.role}`;
  article.dataset.id = message.id;

  const avatar = document.createElement("div");
  avatar.className = "msg__avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = message.role === "user" ? "EU" : "✦";

  const body = document.createElement("div");
  body.className = "msg__body";

  const meta = document.createElement("div");
  meta.className = "msg__meta";

  const author = document.createElement("span");
  author.className = "msg__author";
  author.textContent = message.role === "user" ? "Você" : WIDGET.title;

  meta.append(author);

  if (message.incomplete) {
    const badge = document.createElement("span");
    badge.className = "msg__badge";
    badge.textContent = "incompleta";
    meta.append(badge);
  }

  const content = document.createElement("div");
  content.className = "msg__content markdown";

  if (message.pending) {
    content.classList.add("is-streaming");
    if (message.content) content.textContent = message.content;
    else content.innerHTML = TYPING;
  } else if (message.role === "assistant") {
    content.innerHTML = renderMarkdown(message.content);
  } else {
    content.textContent = message.content;
  }

  body.append(meta, content);

  if (message.error) {
    const error = document.createElement("div");
    error.className = "msg__error";
    error.textContent = message.error;

    if (isLast) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn btn--small";
      retry.dataset.botAction = "retry";
      retry.textContent = "Tentar novamente";
      error.append(retry);
    }

    body.append(error);
  }

  const actions = document.createElement("div");
  actions.className = "msg__actions";

  if (message.content) actions.append(actionNode("copy", "Copiar"));
  if (message.role === "assistant" && isLast && !message.pending) {
    actions.append(actionNode("regenerate", "Regenerar"));
  }

  if (actions.childElementCount) body.append(actions);

  article.append(avatar, body);
  return article;
}

function actionNode(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "msg__action";
  button.dataset.botAction = action;
  button.textContent = label;
  return button;
}

function setStreamingText(messageId, text) {
  const node = els.messages.querySelector(`[data-id="${CSS.escape(messageId)}"]`);
  if (!node) return;

  const content = node.querySelector(".msg__content");
  if (!content) return;

  const stick = isNearBottom();
  content.classList.add("is-streaming");
  content.textContent = text;
  if (stick) els.messages.scrollTop = els.messages.scrollHeight;
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function isNearBottom() {
  const gap =
    els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight;
  return gap < 80;
}

function buildSuggestions() {
  els.suggestions.replaceChildren();

  for (const prompt of WIDGET.suggestions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion";
    button.dataset.prompt = prompt;
    button.textContent = prompt;
    els.suggestions.append(button);
  }
}

function setStreamingUI(streaming) {
  els.send.hidden = streaming;
  els.stop.hidden = !streaming;
  els.form.classList.toggle("is-streaming", streaming);
}

/* ---------- Abrir e fechar ---------- */

function openPanel({ focus = true } = {}) {
  if (isOpen) return;
  isOpen = true;

  els.panel.hidden = false;
  els.root.classList.add("is-open");
  els.launcher.setAttribute("aria-expanded", "true");
  els.launcher.setAttribute("aria-label", "Fechar chat do assistente Nexa");
  document.body.classList.add("bot-open");

  clearUnread();
  render();

  if (focus) els.prompt.focus({ preventScroll: true });
  scrollToBottom();

  if (statusState !== "online") checkStatus();
}

function closePanel() {
  if (!isOpen) return;
  isOpen = false;

  els.panel.hidden = true;
  els.root.classList.remove("is-open");
  els.launcher.setAttribute("aria-expanded", "false");
  els.launcher.setAttribute("aria-label", "Abrir chat do assistente Nexa");
  document.body.classList.remove("bot-open");

  if (focusInsidePanel()) els.launcher.focus({ preventScroll: true });
}

function focusInsidePanel() {
  const active = document.activeElement;
  return Boolean(active && els.panel.contains(active));
}

function togglePanel() {
  if (isOpen) closePanel();
  else openPanel();
}

function markUnread() {
  els.badge.hidden = false;
}

function clearUnread() {
  els.badge.hidden = true;
}

/* ---------- Status do Ollama ---------- */

function setStatus(next) {
  statusState = next;
  els.status.dataset.state = next;
  els.status.setAttribute("aria-label", STATUS_LABELS[next] ?? STATUS_LABELS.unknown);
}

async function checkStatus({ force = false } = {}) {
  if (statusState === "checking") return;

  const now = Date.now();
  if (!force && statusState === "online" && now - lastCheck < 30000) return;

  lastCheck = now;
  setStatus("checking");

  try {
    await listModels(state.settings.ollamaUrl);
    setStatus("online");
    hideBanner();
  } catch {
    setStatus("offline");
    showBanner(state.settings.ollamaUrl, corsHint());
  }
}

function showBanner(url, hint) {
  els.bannerUrl.textContent = url || "—";
  els.bannerHint.textContent = hint || "";
  els.banner.hidden = false;
}

function hideBanner() {
  els.banner.hidden = true;
}

/* ---------- Envio e streaming ---------- */

async function send(rawText) {
  const text = String(rawText ?? "").trim();
  if (!text || controller) return;

  openPanel({ focus: false });

  messages.push({
    id: uid(),
    role: "user",
    content: text,
    createdAt: nowIso(),
  });
  trimMessages();
  persist();

  setPromptValue("");
  render();
  scrollToBottom();

  await complete();
}

async function complete() {
  const model = state.settings.model;

  const assistant = {
    id: uid(),
    role: "assistant",
    content: "",
    createdAt: nowIso(),
    pending: true,
  };

  messages.push(assistant);
  pendingId = assistant.id;
  pendingText = "";

  render();
  scrollToBottom();
  setStreamingUI(true);

  controller = new AbortController();

  try {
    await streamChat({
      baseUrl: state.settings.ollamaUrl,
      model,
      messages: buildContext(assistant.id),
      signal: controller.signal,
      onToken: (chunk) => {
        assistant.content += chunk;
        pendingText = assistant.content;
        scheduleFrame();
      },
    });

    if (!assistant.content.trim()) {
      throw new Error("O modelo não retornou conteúdo.");
    }

    cancelFrame();
    delete assistant.pending;
    delete assistant.error;
    delete assistant.incomplete;

    setStatus("online");
    hideBanner();
    persist();
    render();
    scrollToBottom();
    announce("Resposta concluída.");
    if (!isOpen) markUnread();
  } catch (error) {
    const aborted = error?.name === "AbortError";
    cancelFrame();
    delete assistant.pending;

    if (aborted) {
      if (assistant.content) {
        assistant.incomplete = true;
      } else {
        messages = messages.filter((message) => message.id !== assistant.id);
      }
      persist();
      render();
      announce("Resposta interrompida.");
    } else {
      assistant.error = friendlyError(error, model);
      if (assistant.content) assistant.incomplete = true;
      persist();
      render();
      announce("Falha ao obter resposta.");

      if (isNetworkError(error)) {
        setStatus("offline");
        showBanner(state.settings.ollamaUrl, corsHint());
      }
    }
  } finally {
    controller = null;
    pendingId = null;
    pendingText = "";
    setStreamingUI(false);
    trimMessages();
    persist();
  }
}

function stop() {
  if (controller) controller.abort();
}

async function retryLast() {
  if (controller) return false;

  const last = messages[messages.length - 1];
  if (!last) return false;

  const tail = last.role === "assistant" ? messages[messages.length - 2] : last;
  if (!tail || tail.role !== "user") return false;

  if (last.role === "assistant") messages.pop();

  persist();
  render();
  scrollToBottom();
  await complete();
  return true;
}

function clearConversation() {
  if (controller) {
    announce("Pare a resposta antes de limpar a conversa.");
    return;
  }

  if (!messages.length) {
    announce("Não há mensagens para limpar.");
    return;
  }

  if (!window.confirm("Limpar a conversa do assistente?")) return;

  messages = [];
  persist();
  render();
  announce("Conversa do bot limpa.");
  els.prompt.focus({ preventScroll: true });
}

function buildContext(excludeId) {
  let history = messages
    .filter((message) => message.id !== excludeId && !message.pending)
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.content }));

  if (history.length > WIDGET.historyWindow) {
    history = history.slice(-WIDGET.historyWindow);
  }

  while (history.length && history[0].role === "assistant") {
    history.shift();
  }

  if (WIDGET.systemPrompt) {
    history.unshift({ role: "system", content: WIDGET.systemPrompt });
  }

  return history;
}

function scheduleFrame() {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    if (pendingId) setStreamingText(pendingId, pendingText);
  });
}

function cancelFrame() {
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
}

/* ---------- Composer ---------- */

function getPromptValue() {
  return els.prompt.value;
}

function setPromptValue(value) {
  els.prompt.value = value;
  autoGrowPrompt();
}

function autoGrowPrompt() {
  els.prompt.style.height = "auto";
  els.prompt.style.height = `${Math.min(els.prompt.scrollHeight, 120)}px`;
}

function focusPrompt() {
  els.prompt.focus({ preventScroll: true });
}

/* ---------- Eventos ---------- */

function bindEvents() {
  els.launcher.addEventListener("click", togglePanel);
  els.close.addEventListener("click", closePanel);
  els.clear.addEventListener("click", clearConversation);
  els.retry.addEventListener("click", () => checkStatus({ force: true }));

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSend();
  });

  els.prompt.addEventListener("input", autoGrowPrompt);
  els.prompt.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      handleSend();
    }
  });

  els.stop.addEventListener("click", stop);

  els.suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prompt]");
    if (!button || controller) return;

    setPromptValue(button.dataset.prompt);
    handleSend();
  });

  els.messages.addEventListener("click", onMessagesClick);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen || !focusInsidePanel()) return;

    if (controller) {
      stop();
      return;
    }

    closePanel();
  });
}

function handleSend() {
  if (controller) return;
  const text = getPromptValue().trim();
  if (!text) return;
  send(text);
}

async function onMessagesClick(event) {
  const codeButton = event.target.closest(".code-copy");
  if (codeButton) {
    await copyText(codeButton.dataset.code ?? "", codeButton);
    return;
  }

  const action = event.target.closest("[data-bot-action]");
  if (!action) return;

  if (action.dataset.botAction === "retry" || action.dataset.botAction === "regenerate") {
    await retryLast();
    focusPrompt();
    return;
  }

  if (action.dataset.botAction === "copy") {
    const article = action.closest(".msg");
    const message = messages.find((item) => item.id === article?.dataset.id);
    if (message) await copyText(message.content, action);
  }
}

/* ---------- Utilidades ---------- */

async function copyText(text, button) {
  if (!text) return;

  let copied = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    copied = fallbackCopy(text);
  }

  if (button) {
    const original = button.textContent;
    button.textContent = copied ? "Copiado" : "Falhou";
    window.setTimeout(() => {
      button.textContent = original;
    }, 1400);
  }
}

function fallbackCopy(text) {
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.append(helper);
  helper.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    helper.remove();
  }
}

function announce(text) {
  els.sr.textContent = "";
  window.requestAnimationFrame(() => {
    els.sr.textContent = text;
  });
}

function isNetworkError(error) {
  if (error instanceof TypeError) return true;
  return /failed to fetch|load failed|networkerror|network request failed/i.test(
    error?.message ?? "",
  );
}

function friendlyError(error, model) {
  const message = error?.message || "Erro inesperado.";

  if (isNetworkError(error)) {
    return `Não foi possível conectar ao Ollama em ${state.settings.ollamaUrl}. Verifique se ele está rodando (ollama serve) e se o endereço está correto.`;
  }

  if (/not found|no such model/i.test(message)) {
    return `O modelo "${model}" não está disponível. Baixe com: ollama pull ${model}`;
  }

  return message;
}

init();
