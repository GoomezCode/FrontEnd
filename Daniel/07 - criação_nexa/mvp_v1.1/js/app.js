import { CONFIG } from "./config.js";
import {
  clearConversation,
  createConversation,
  deleteConversation,
  getActive,
  persist,
  renameConversation,
  setActive,
  sortedConversations,
  state,
} from "./state.js";
import { listModels } from "./ollama.js";
import * as ui from "./ui.js";
import {
  isStreaming,
  retryLast,
  sendMessage,
  setChatHooks,
  stopStreaming,
} from "./chat.js";
import { corsHint, debounce, normalizeBaseUrl } from "./utils.js";

let searchQuery = "";

function init() {
  setChatHooks({ onConversationsChanged: renderSidebar });
  ui.applyTheme(state.settings.theme);
  syncConnectionUI();
  ui.setStreamingUI(false);
  renderAll();
  bindEvents();
  refreshModels({ silent: true });
  ui.focusPrompt();
}

function renderAll() {
  const conversation = getActive();
  ui.renderHeader(conversation, state.settings.model);
  ui.renderMessages(conversation);
  renderSidebar();
  ui.populateModels([state.settings.model], state.settings.model);
}

function renderSidebar() {
  ui.renderSidebar(sortedConversations(), state.activeId, searchQuery);
}

function bindEvents() {
  ui.els.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    handleSend();
  });

  ui.els.prompt.addEventListener("input", ui.autoGrowPrompt);
  ui.els.prompt.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      handleSend();
    }
  });

  ui.els.stop.addEventListener("click", stopStreaming);
  ui.els.newChat.addEventListener("click", startNewChat);
  ui.els.openSidebar.addEventListener("click", ui.openSidebar);
  ui.els.closeSidebar.addEventListener("click", ui.closeSidebar);
  ui.els.backdrop.addEventListener("click", ui.closeSidebar);
  ui.els.themeButton.addEventListener("click", toggleTheme);
  ui.els.clear.addEventListener("click", clearCurrentConversation);
  ui.els.refreshModels.addEventListener("click", () => refreshModels());
  ui.els.retryConnection.addEventListener("click", () => refreshModels());
  ui.els.modelSelect.addEventListener("change", changeModel);
  ui.els.applyUrl.addEventListener("click", () => applyOllamaUrl(ui.els.ollamaUrl.value));
  ui.els.ollamaUrl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyOllamaUrl(ui.els.ollamaUrl.value);
  });
  ui.els.presets.addEventListener("click", onPresetClick);

  ui.els.search.addEventListener("input", onSearch);
  ui.els.search.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    ui.els.search.value = "";
    searchQuery = "";
    renderSidebar();
  });

  ui.els.conversationList.addEventListener("click", onConversationClick);
  ui.els.conversationList.addEventListener("keydown", onConversationKeydown);
  ui.els.suggestions.addEventListener("click", onSuggestionClick);
  ui.els.messages.addEventListener("click", onMessageClick);

  document.addEventListener("keydown", onGlobalKeydown);
}

async function handleSend() {
  const text = ui.getPromptValue().trim();
  if (!text || isStreaming()) return;

  await sendMessage(text);
  ui.focusPrompt();
}

function startNewChat() {
  if (isStreaming()) {
    ui.toast("Pare a resposta antes de criar outra conversa.", "info");
    return;
  }

  const active = getActive();
  if (active && !active.messages.length) {
    ui.closeSidebar();
    ui.focusPrompt();
    return;
  }

  const reused = sortedConversations().find((conversation) => !conversation.messages.length);
  if (reused) setActive(reused.id);
  else createConversation();

  renderAll();
  ui.closeSidebar();
  ui.focusPrompt();
}

function openConversation(id) {
  if (isStreaming()) {
    ui.toast("Aguarde a resposta atual terminar.", "info");
    return;
  }

  if (id === state.activeId) {
    ui.closeSidebar();
    ui.focusPrompt();
    return;
  }

  setActive(id);
  const conversation = getActive();
  ui.renderHeader(conversation, state.settings.model);
  ui.renderMessages(conversation);
  renderSidebar();
  ui.closeSidebar();
  ui.focusPrompt();
}

function clearCurrentConversation() {
  const conversation = getActive();
  if (!conversation || !conversation.messages.length) {
    ui.toast("Não há mensagens para limpar.", "info");
    return;
  }

  if (isStreaming()) {
    ui.toast("Pare a resposta antes de limpar.", "info");
    return;
  }

  if (!window.confirm("Limpar todas as mensagens desta conversa?")) return;

  clearConversation(conversation.id);
  renderAll();
  ui.toast("Conversa limpa.", "info");
}

function toggleTheme() {
  state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
  ui.applyTheme(state.settings.theme);
  persist();
}

function changeModel() {
  const model = ui.els.modelSelect.value;
  if (!model) return;
  state.settings.model = model;
  persist();
  ui.renderHeader(getActive(), model);
}

function trimUrl(url) {
  return String(url ?? "").replace(/\/+$/, "");
}

function syncConnectionUI() {
  ui.els.ollamaUrl.value = state.settings.ollamaUrl;
  const current = trimUrl(state.settings.ollamaUrl);

  ui.els.presets.querySelectorAll("[data-preset]").forEach((button) => {
    const target =
      button.dataset.preset === "local" ? CONFIG.localOllamaUrl : CONFIG.networkOllamaUrl;
    const active = trimUrl(target) === current;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.title = target;
  });
}

function onPresetClick(event) {
  const button = event.target.closest("[data-preset]");
  if (!button) return;

  const url =
    button.dataset.preset === "local" ? CONFIG.localOllamaUrl : CONFIG.networkOllamaUrl;
  ui.els.ollamaUrl.value = url;
  applyOllamaUrl(url);
}

async function applyOllamaUrl(rawUrl) {
  if (isStreaming()) {
    ui.toast("Pare a resposta antes de trocar de servidor.", "info");
    return;
  }

  const url = normalizeBaseUrl(rawUrl);
  if (!url) {
    ui.toast("URL inválida. Use algo como http://192.168.0.10:11434.", "error");
    syncConnectionUI();
    return;
  }

  state.settings.ollamaUrl = url;
  persist();
  syncConnectionUI();

  const ok = await refreshModels({ silent: true });
  if (ok) ui.toast(`Conectado a ${url}.`, "success");
  else ui.toast(`Não foi possível conectar a ${url}.`, "error");
}

const onSearch = debounce(() => {
  searchQuery = ui.els.search.value.trim();
  renderSidebar();
}, 140);

function onConversationClick(event) {
  const row = event.target.closest(".conv");
  if (!row) return;

  const action = event.target.closest("[data-action]");
  if (action) {
    handleConversationAction(action.dataset.action, row.dataset.id);
    return;
  }

  openConversation(row.dataset.id);
}

function onConversationKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;

  const row = event.target.closest(".conv");
  if (!row || event.target !== row) return;

  event.preventDefault();
  openConversation(row.dataset.id);
}

function handleConversationAction(action, id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;

  if (action === "rename") {
    ui.startRename(id, conversation.title, (value) => {
      if (value) renameConversation(id, value);
      renderSidebar();
      ui.renderHeader(getActive(), state.settings.model);
    });
    return;
  }

  if (action === "delete") {
    if (isStreaming()) {
      ui.toast("Pare a resposta antes de excluir a conversa.", "info");
      return;
    }

    const confirmed = window.confirm(
      `Excluir "${conversation.title}"? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    deleteConversation(id);
    renderAll();
    ui.toast("Conversa excluída.", "info");
  }
}

function onSuggestionClick(event) {
  const button = event.target.closest("[data-prompt]");
  if (!button || isStreaming()) return;

  ui.setPromptValue(button.dataset.prompt);
  handleSend();
}

async function onMessageClick(event) {
  const codeButton = event.target.closest(".code-copy");
  if (codeButton) {
    await copyText(codeButton.dataset.code ?? "");
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.action;

  if (action === "retry" || action === "regenerate") {
    if (isStreaming()) return;
    await retryLast();
    ui.focusPrompt();
    return;
  }

  if (action === "copy") {
    const article = actionButton.closest(".msg");
    const conversation = getActive();
    const message = conversation?.messages.find((item) => item.id === article?.dataset.id);
    if (message) await copyText(message.content);
  }
}

function onGlobalKeydown(event) {
  if (event.key === "Escape") {
    if (ui.els.sidebar.classList.contains("is-open")) {
      ui.closeSidebar();
      return;
    }
    if (isStreaming()) {
      stopStreaming();
      return;
    }
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (window.matchMedia("(max-width: 900px)").matches) ui.openSidebar();
    ui.els.search.focus();
  }
}

async function copyText(text) {
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    ui.toast("Copiado para a área de transferência.", "success");
    return;
  } catch {
    // Fallback para navegadores sem permissão de clipboard.
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.append(helper);
  helper.select();

  try {
    document.execCommand("copy");
    ui.toast("Copiado.", "success");
  } catch {
    ui.toast("Não foi possível copiar.", "error");
  } finally {
    helper.remove();
  }
}

async function refreshModels({ silent = false } = {}) {
  ui.setOllamaStatus("checking", "Verificando Ollama…");

  try {
    const models = await listModels(state.settings.ollamaUrl);

    if (!models.length) {
      ui.setOllamaStatus("offline", "Nenhum modelo instalado");
      ui.setOfflineBanner(true, state.settings.ollamaUrl);
      ui.populateModels([state.settings.model], state.settings.model);
      if (!silent) {
        ui.toast("Nenhum modelo encontrado. Rode: ollama pull llama3.2", "error");
      }
      return false;
    }

    ui.setOllamaStatus(
      "ok",
      `Ollama online · ${models.length} ${models.length === 1 ? "modelo" : "modelos"}`,
    );
    ui.setOfflineBanner(false);

    if (!models.includes(state.settings.model)) {
      state.settings.model = models.includes(CONFIG.defaultModel)
        ? CONFIG.defaultModel
        : models[0];
      persist();
    }

    ui.populateModels(models, state.settings.model);
    ui.renderHeader(getActive(), state.settings.model);
    return true;
  } catch {
    ui.setOllamaStatus("offline", "Ollama offline");
    ui.setOfflineBanner(true, state.settings.ollamaUrl, corsHint());
    ui.populateModels([state.settings.model], state.settings.model);
    if (!silent) {
      ui.toast("Não foi possível falar com o Ollama. Verifique se ele está rodando.", "error");
    }
    return false;
  }
}

init();
