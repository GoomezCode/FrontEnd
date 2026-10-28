import { CONFIG } from "./config.js";
import { uid } from "./utils.js";

function defaultState() {
  const prefersLight =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches;

  return {
    version: 1,
    activeId: null,
    settings: {
      theme: prefersLight ? "light" : "dark",
      model: CONFIG.defaultModel,
      ollamaUrl: CONFIG.ollamaUrl,
    },
    conversations: [],
  };
}

function normalizeMessage(message) {
  if (!message || !["user", "assistant"].includes(message.role)) return null;
  if (typeof message.content !== "string") return null;

  const normalized = {
    id: typeof message.id === "string" && message.id ? message.id : uid(),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt || new Date().toISOString(),
  };

  if (message.incomplete) normalized.incomplete = true;
  if (typeof message.error === "string" && message.error) normalized.error = message.error;
  return normalized;
}

function normalizeConversation(conversation) {
  if (!conversation || typeof conversation !== "object") return null;

  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.map(normalizeMessage).filter(Boolean)
    : [];

  return {
    id: typeof conversation.id === "string" && conversation.id ? conversation.id : uid(),
    title:
      typeof conversation.title === "string" && conversation.title.trim()
        ? conversation.title.trim()
        : "Nova conversa",
    createdAt: conversation.createdAt || new Date().toISOString(),
    updatedAt: conversation.updatedAt || conversation.createdAt || new Date().toISOString(),
    messages,
  };
}

function normalize(data) {
  const state = defaultState();
  if (!data || typeof data !== "object") return state;

  if (data.settings && typeof data.settings === "object") {
    if (data.settings.theme === "dark" || data.settings.theme === "light") {
      state.settings.theme = data.settings.theme;
    }
    if (typeof data.settings.model === "string" && data.settings.model.trim()) {
      state.settings.model = data.settings.model.trim();
    }
    if (typeof data.settings.ollamaUrl === "string" && data.settings.ollamaUrl.trim()) {
      state.settings.ollamaUrl = data.settings.ollamaUrl.trim();
    }
  }

  if (Array.isArray(data.conversations)) {
    state.conversations = data.conversations
      .map(normalizeConversation)
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  if (typeof data.activeId === "string" && state.conversations.some((c) => c.id === data.activeId)) {
    state.activeId = data.activeId;
  }

  return state;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch (error) {
    console.warn("Não foi possível ler o histórico salvo.", error);
    return defaultState();
  }
}

/**
 * Salva o estado. Se a cota do localStorage estourar, remove as conversas
 * mais antigas e tenta novamente.
 */
export function saveState(state) {
  const write = () => localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));

  try {
    write();
    return true;
  } catch (error) {
    const ordered = [...state.conversations].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    );

    for (const keep of [20, 10, 5, 1]) {
      if (ordered.length <= keep) continue;
      const backup = state.conversations;
      state.conversations = ordered.slice(0, keep);
      if (state.activeId && !state.conversations.some((c) => c.id === state.activeId)) {
        state.activeId = state.conversations[0]?.id ?? null;
      }
      try {
        write();
        console.warn("Histórico reduzido para caber no armazenamento local.");
        return true;
      } catch {
        state.conversations = backup;
      }
    }

    console.warn("Não foi possível salvar o histórico.", error);
    return false;
  }
}
