import { CONFIG } from "./config.js";
import { loadState, saveState } from "./storage.js";
import { nowIso, uid } from "./utils.js";

export const state = loadState();

export function persist() {
  return saveState(state);
}

export function getActive() {
  return state.conversations.find((conversation) => conversation.id === state.activeId) ?? null;
}

export function setActive(id) {
  state.activeId = typeof id === "string" ? id : null;
  persist();
}

export function createConversation() {
  const conversation = {
    id: uid(),
    title: "Nova conversa",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    messages: [],
  };

  state.conversations.unshift(conversation);
  state.activeId = conversation.id;
  trimConversations();
  persist();
  return conversation;
}

export function deleteConversation(id) {
  state.conversations = state.conversations.filter((conversation) => conversation.id !== id);
  if (state.activeId === id) {
    state.activeId = sortedConversations()[0]?.id ?? null;
  }
  persist();
}

export function renameConversation(id, title) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  conversation.title = title.trim() || conversation.title;
  conversation.updatedAt = nowIso();
  persist();
}

export function clearConversation(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  conversation.messages = [];
  conversation.title = "Nova conversa";
  conversation.updatedAt = nowIso();
  persist();
}

export function sortedConversations() {
  return [...state.conversations].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
  );
}

function trimConversations() {
  if (state.conversations.length <= CONFIG.maxConversations) return;

  const ordered = sortedConversations();
  const keep = new Set(ordered.slice(0, CONFIG.maxConversations).map((c) => c.id));
  state.conversations = state.conversations.filter((c) => keep.has(c.id));
}
