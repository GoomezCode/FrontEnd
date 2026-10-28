/**
 * Configuração única do WebUI.
 * Ajuste aqui as URLs do Ollama, o modelo padrão e os limites do histórico.
 */

const NETWORK_OLLAMA_URL = "http://10.64.46.25:11434";
const LOCAL_OLLAMA_URL = "http://localhost:11434";

/**
 * Quando a página é aberta por um IP de rede, assume que o Ollama roda no
 * mesmo host. Em localhost, usa o endereço de rede configurado acima para
 * que a conexão funcione também a partir de outras máquinas.
 */
function initialOllamaUrl() {
  if (typeof window === "undefined" || !window.location) return NETWORK_OLLAMA_URL;

  const host = window.location.hostname;
  if (!host || host === "localhost" || host === "127.0.0.1") return NETWORK_OLLAMA_URL;
  return `http://${host}:11434`;
}

export const CONFIG = Object.freeze({
  ollamaUrl: initialOllamaUrl(),
  networkOllamaUrl: NETWORK_OLLAMA_URL,
  localOllamaUrl: LOCAL_OLLAMA_URL,
  defaultModel: "llama3.2",
  storageKey: "nexa.chat.v1",
  maxConversations: 50,
  historyWindow: 40,
  maxTitleLength: 60,
  // Deixe vazio para não enviar mensagem de sistema.
  systemPrompt: "",
});
