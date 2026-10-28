import { renderMarkdown } from "./markdown.js";
import { dayGroupLabel, timeLabel } from "./utils.js";

function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado.`);
  return node;
}

export const els = {
  sidebar: el("sidebar"),
  backdrop: el("backdrop"),
  conversationList: el("conversation-list"),
  search: el("search"),
  ollamaUrl: el("ollama-url"),
  applyUrl: el("btn-apply-url"),
  presets: el("ollama-presets"),
  modelSelect: el("model-select"),
  refreshModels: el("btn-refresh-models"),
  ollamaStatus: el("ollama-status"),
  themeIcon: el("theme-icon"),
  themeLabel: el("theme-label"),
  themeButton: el("btn-theme"),
  newChat: el("btn-new-chat"),
  closeSidebar: el("btn-close-sidebar"),
  openSidebar: el("btn-open-sidebar"),
  title: el("conversation-title"),
  meta: el("conversation-meta"),
  messages: el("messages"),
  emptyState: el("empty-state"),
  suggestions: el("suggestions"),
  composer: el("composer"),
  prompt: el("prompt"),
  send: el("btn-send"),
  stop: el("btn-stop"),
  clear: el("btn-clear"),
  offlineBanner: el("offline-banner"),
  offlineUrl: el("offline-url"),
  offlineHint: el("offline-hint"),
  retryConnection: el("btn-retry-connection"),
  toasts: el("toasts"),
  srStatus: el("sr-status"),
};

const TYPING = '<span class="typing" aria-label="Gerando resposta"><i></i><i></i><i></i></span>';

const SUN_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

const MOON_ICON =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

const RENAME_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

const TRASH_ICON =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';

/* ---------- Tema ---------- */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeIcon.innerHTML = theme === "dark" ? SUN_ICON : MOON_ICON;
  els.themeLabel.textContent =
    theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro";
}

/* ---------- Cabeçalho ---------- */
export function renderHeader(conversation, model) {
  const title = conversation?.title || "Nova conversa";
  const count = conversation?.messages?.length ?? 0;

  els.title.textContent = title;
  els.meta.textContent = `${model}${count ? ` · ${count} ${count === 1 ? "mensagem" : "mensagens"}` : ""}`;
  document.title = conversation ? `${title} · Nexa` : "Nexa · Chat de IA";
}

/* ---------- Sidebar ---------- */
export function renderSidebar(conversations, activeId, query = "") {
  const term = query.trim().toLowerCase();
  const filtered = term
    ? conversations.filter((conversation) => conversation.title.toLowerCase().includes(term))
    : conversations;

  els.conversationList.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "conv-empty";
    empty.textContent = term ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda.";
    els.conversationList.append(empty);
    return;
  }

  const groups = new Map();
  for (const conversation of filtered) {
    const label = dayGroupLabel(conversation.updatedAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(conversation);
  }

  for (const [label, items] of groups) {
    const group = document.createElement("div");
    group.className = "conv-group";

    const heading = document.createElement("h2");
    heading.className = "conv-group__label";
    heading.textContent = label;
    group.append(heading);

    for (const conversation of items) {
      group.append(conversationNode(conversation, conversation.id === activeId));
    }

    els.conversationList.append(group);
  }
}

function conversationNode(conversation, active) {
  const row = document.createElement("div");
  row.className = active ? "conv is-active" : "conv";
  row.dataset.id = conversation.id;
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-current", active ? "true" : "false");
  row.setAttribute("aria-label", `Conversa: ${conversation.title}`);
  row.title = conversation.title;

  const title = document.createElement("span");
  title.className = "conv__title";
  title.textContent = conversation.title;

  const actions = document.createElement("span");
  actions.className = "conv__actions";
  actions.append(
    conversationAction("rename", "Renomear conversa", RENAME_ICON),
    conversationAction("delete", "Excluir conversa", TRASH_ICON),
  );

  row.append(title, actions);
  return row;
}

function conversationAction(action, label, icon) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "conv__action";
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}

export function startRename(conversationId, currentTitle, onDone) {
  const row = els.conversationList.querySelector(
    `.conv[data-id="${CSS.escape(conversationId)}"]`,
  );
  const titleNode = row?.querySelector(".conv__title");
  if (!row || !titleNode) return;

  const input = document.createElement("input");
  input.className = "conv__rename";
  input.value = currentTitle;
  input.maxLength = 80;
  input.setAttribute("aria-label", "Novo título da conversa");
  titleNode.replaceWith(input);
  input.focus();
  input.select();

  let settled = false;
  const finish = (save) => {
    if (settled) return;
    settled = true;
    const value = input.value.trim();
    onDone(save && value && value !== currentTitle ? value : null);
  };

  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true));
  input.addEventListener("click", (event) => event.stopPropagation());
}

/* ---------- Modelos e status ---------- */
export function populateModels(names, selected) {
  const unique = [...new Set([...(names ?? []), selected].filter(Boolean))];
  els.modelSelect.replaceChildren();

  for (const name of unique) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.modelSelect.append(option);
  }

  els.modelSelect.value = selected && unique.includes(selected) ? selected : unique[0] ?? "";
}

export function setOllamaStatus(status, text) {
  els.ollamaStatus.dataset.state = status;
  const node = els.ollamaStatus.querySelector(".status__text");
  if (node) node.textContent = text;
}

export function setOfflineBanner(visible, url, hint = "") {
  els.offlineBanner.hidden = !visible;
  if (!visible) return;
  if (url) els.offlineUrl.textContent = url;
  els.offlineHint.textContent = hint;
  els.offlineHint.hidden = !hint;
}

/* ---------- Mensagens ---------- */
export function renderMessages(conversation) {
  els.messages.replaceChildren();

  const messages = conversation?.messages ?? [];
  if (!messages.length) {
    els.emptyState.hidden = false;
    return;
  }

  els.emptyState.hidden = true;

  messages.forEach((message, index) => {
    els.messages.append(messageNode(message, index === messages.length - 1));
  });

  scrollToBottom(true);
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
  author.textContent = message.role === "user" ? "Você" : "Nexa";

  const time = document.createElement("time");
  time.className = "msg__time";
  time.dateTime = message.createdAt;
  time.textContent = timeLabel(message.createdAt);

  meta.append(author, time);

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
      retry.dataset.action = "retry";
      retry.textContent = "Tentar novamente";
      error.append(retry);
    }

    body.append(error);
  }

  const actions = document.createElement("div");
  actions.className = "msg__actions";

  if (message.content) actions.append(messageAction("copy", "Copiar"));
  if (message.role === "assistant" && isLast && !message.pending) {
    actions.append(messageAction("regenerate", "Regenerar"));
  }

  if (actions.childElementCount) body.append(actions);

  article.append(avatar, body);
  return article;
}

function messageAction(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "msg__action";
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

export function setStreamingAssistant(messageId, text) {
  const node = els.messages.querySelector(`[data-id="${CSS.escape(messageId)}"]`);
  if (!node) return;

  const content = node.querySelector(".msg__content");
  if (!content) return;

  const stick = isNearBottom();
  content.classList.add("is-streaming");
  content.textContent = text;
  if (stick) els.messages.scrollTop = els.messages.scrollHeight;
}

export function scrollToBottom(force = false) {
  if (!force && !isNearBottom()) return;
  els.messages.scrollTop = els.messages.scrollHeight;
}

export function isNearBottom() {
  const distance =
    els.messages.scrollHeight - els.messages.scrollTop - els.messages.clientHeight;
  return distance < 120;
}

/* ---------- Composer ---------- */
export function setStreamingUI(streaming) {
  els.send.hidden = streaming;
  els.stop.hidden = !streaming;
  els.composer.classList.toggle("is-streaming", streaming);
}

export function getPromptValue() {
  return els.prompt.value;
}

export function setPromptValue(value) {
  els.prompt.value = value;
  autoGrowPrompt();
}

export function autoGrowPrompt() {
  els.prompt.style.height = "auto";
  els.prompt.style.height = `${Math.min(els.prompt.scrollHeight, 200)}px`;
}

export function focusPrompt() {
  els.prompt.focus({ preventScroll: true });
}

/* ---------- Sidebar mobile ---------- */
export function openSidebar() {
  els.sidebar.classList.add("is-open");
  els.backdrop.hidden = false;
  document.body.classList.add("sidebar-open");
}

export function closeSidebar() {
  els.sidebar.classList.remove("is-open");
  els.backdrop.hidden = true;
  document.body.classList.remove("sidebar-open");
}

/* ---------- Feedback ---------- */
export function toast(message, type = "info") {
  const node = document.createElement("div");
  node.className = `toast toast--${type}`;
  node.textContent = message;
  node.addEventListener("click", () => node.remove());
  els.toasts.append(node);

  while (els.toasts.childElementCount > 3) {
    els.toasts.firstElementChild?.remove();
  }

  window.setTimeout(() => node.remove(), 5200);
}

export function announce(message) {
  els.srStatus.textContent = "";
  window.requestAnimationFrame(() => {
    els.srStatus.textContent = message;
  });
}
