import { CONFIG } from "./config.js";
import { createConversation, getActive, persist, state } from "./state.js";
import { streamChat } from "./ollama.js";
import * as ui from "./ui.js";
import { corsHint, nowIso, titleFromPrompt, uid } from "./utils.js";

let controller = null;
let frame = 0;
let pendingMessageId = null;
let pendingText = "";
let notifyConversations = () => {};

export function setChatHooks(hooks) {
  notifyConversations = typeof hooks?.onConversationsChanged === "function"
    ? hooks.onConversationsChanged
    : () => {};
}

export function isStreaming() {
  return Boolean(controller);
}

export async function sendMessage(rawText) {
  const text = String(rawText ?? "").trim();
  if (!text || isStreaming()) return false;

  let conversation = getActive();
  if (!conversation) conversation = createConversation();

  const isUntitled =
    !conversation.messages.length || conversation.title === "Nova conversa";
  if (isUntitled) conversation.title = titleFromPrompt(text, CONFIG.maxTitleLength);

  conversation.messages.push({
    id: uid(),
    role: "user",
    content: text,
    createdAt: nowIso(),
  });
  conversation.updatedAt = nowIso();
  persist();

  ui.setPromptValue("");
  ui.renderHeader(conversation, state.settings.model);
  ui.renderMessages(conversation);
  notifyConversations();

  return runCompletion(conversation);
}

export async function retryLast() {
  if (isStreaming()) return false;

  const conversation = getActive();
  if (!conversation || !conversation.messages.length) return false;

  const last = conversation.messages[conversation.messages.length - 1];
  if (last.role === "assistant") conversation.messages.pop();

  const tail = conversation.messages[conversation.messages.length - 1];
  if (!tail || tail.role !== "user") return false;

  persist();
  ui.renderMessages(conversation);
  notifyConversations();
  return runCompletion(conversation);
}

export function stopStreaming() {
  if (controller) controller.abort();
}

async function runCompletion(conversation) {
  const model = state.settings.model;
  const assistant = {
    id: uid(),
    role: "assistant",
    content: "",
    createdAt: nowIso(),
    pending: true,
  };

  conversation.messages.push(assistant);
  conversation.updatedAt = nowIso();

  ui.renderHeader(conversation, model);
  ui.renderMessages(conversation);
  ui.setStreamingUI(true);
  ui.scrollToBottom(true);
  notifyConversations();

  controller = new AbortController();
  pendingMessageId = assistant.id;
  pendingText = "";

  try {
    await streamChat({
      baseUrl: state.settings.ollamaUrl,
      model,
      messages: buildContext(conversation, assistant.id),
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
    assistant.pending = false;
    delete assistant.error;
    delete assistant.incomplete;
    conversation.updatedAt = nowIso();
    persist();

    ui.renderMessages(conversation);
    ui.renderHeader(conversation, model);
    notifyConversations();
    ui.announce("Resposta concluída.");
  } catch (error) {
    const aborted = error?.name === "AbortError";
    cancelFrame();
    assistant.pending = false;

    if (aborted) {
      if (assistant.content) {
        assistant.incomplete = true;
      } else {
        conversation.messages = conversation.messages.filter(
          (message) => message.id !== assistant.id,
        );
      }
      conversation.updatedAt = nowIso();
      persist();
      ui.announce("Resposta interrompida.");
    } else {
      assistant.error = friendlyError(error, model);
      if (assistant.content) assistant.incomplete = true;
      conversation.updatedAt = nowIso();
      persist();
      ui.toast(assistant.error, "error");
      ui.announce("Falha ao obter resposta.");

      if (isNetworkError(error)) {
        ui.setOllamaStatus("offline", "Ollama offline");
        ui.setOfflineBanner(true, state.settings.ollamaUrl, corsHint());
      }
    }

    ui.renderMessages(conversation);
    notifyConversations();
  } finally {
    controller = null;
    pendingMessageId = null;
    pendingText = "";
    ui.setStreamingUI(false);
  }
}

function buildContext(conversation, excludeId) {
  let history = conversation.messages
    .filter((message) => message.id !== excludeId && !message.pending)
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.content }));

  if (history.length > CONFIG.historyWindow) {
    history = history.slice(-CONFIG.historyWindow);
  }

  while (history.length && history[0].role === "assistant") {
    history.shift();
  }

  if (CONFIG.systemPrompt) {
    history.unshift({ role: "system", content: CONFIG.systemPrompt });
  }

  return history;
}

function scheduleFrame() {
  if (frame) return;
  frame = window.requestAnimationFrame(() => {
    frame = 0;
    if (pendingMessageId) ui.setStreamingAssistant(pendingMessageId, pendingText);
  });
}

function cancelFrame() {
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
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
