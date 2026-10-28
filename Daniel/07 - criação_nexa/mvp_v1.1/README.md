# Nexa — WebUI de chat com IA local

Evolução do `mvp_v1` para uma interface de chat completa, em **HTML, CSS e JavaScript puros** (sem build), consumindo o **Ollama** diretamente do navegador com **streaming**. A conexão pode ser feita pelo endereço de **rede** ou por **localhost**, alternável na própria interface.

> Planejamento completo do produto (WebUI + API + MySQL): [`docs/plano-de-implementacao.md`](docs/plano-de-implementacao.md).

## Requisitos

- [Ollama](https://ollama.com/) instalado e rodando
- Um modelo baixado, por exemplo: `ollama pull llama3.2`
- Python 3 (ou Node.js) para servir os arquivos estáticos

## Como rodar

1. Inicie o Ollama:

   ```powershell
   ollama serve
   ```

2. Em outro terminal, dentro desta pasta:

   ```powershell
   python -m http.server 5173
   ```

3. Abra <http://localhost:5173> no navegador.

> Os arquivos usam ES Modules, por isso precisam ser servidos por HTTP. Abrir o `index.html` direto pelo disco (`file://`) não funciona.

### CORS

O Ollama aceita, por padrão, origens `localhost` e `127.0.0.1` em qualquer porta. Se aparecer erro de CORS, reinicie o Ollama com:

```powershell
$env:OLLAMA_ORIGINS="*"; ollama serve
```

## Usar o Ollama pela rede

O padrão do WebUI é conectar no endereço de rede definido em `js/config.js`:

| Atalho | Endereço padrão |
|---|---|
| **Rede** | `http://10.64.46.25:11434` |
| **Localhost** | `http://localhost:11434` |

Na barra lateral, o campo **Servidor Ollama** permite trocar a URL a qualquer momento, e os botões **Rede** / **Localhost** alternam entre os dois endereços. A escolha fica salva no `localStorage`; para voltar ao localhost depois, basta clicar no atalho, sem editar código.

Se o Ollama estiver em **outra máquina**:

1. Faça o Ollama escutar na rede, no host onde ele roda:
   - Windows (PowerShell): `$env:OLLAMA_HOST="0.0.0.0:11434"; ollama serve`
   - Linux/macOS: `OLLAMA_HOST=0.0.0.0:11434 ollama serve`
2. Libere a porta `11434` no firewall desse host.
3. Teste a partir do seu computador: `curl http://IP-DO-HOST:11434/api/tags`.
4. No WebUI, informe `http://IP-DO-HOST:11434` no campo **Servidor Ollama** e clique no botão de aplicar.

### Acessar o WebUI de outra máquina

Para abrir a interface a partir de outro computador, sirva os arquivos na rede:

```powershell
python -m http.server 5173 --bind 0.0.0.0
```

Depois acesse `http://IP-DESTA-MAQUINA:5173`. Nesse caso, o padrão do WebUI assume o Ollama no mesmo IP da página (`http://IP-DESTA-MAQUINA:11434`). O CORS do Ollama precisa permitir a origem da interface:

```powershell
$env:OLLAMA_ORIGINS="http://IP-DESTA-MAQUINA:5173"; ollama serve
```

Em ambiente controlado, `OLLAMA_ORIGINS="*"` libera qualquer origem. Evite usar `*` em produção.

> Se o Ollama estiver em outra máquina, execute o ajuste de `OLLAMA_HOST` e `OLLAMA_ORIGINS` **nela**, não no computador que abre o WebUI.

### Funciona em `localhost` mas não pelo IP?

Sintoma: em `http://localhost:5173` os modelos aparecem, mas em `http://10.64.46.25:5173` (ou em outro computador) o status fica **Ollama offline**.

O motivo quase sempre é **CORS**, não a rede. O Ollama só aceita, por padrão, origens de loopback (`localhost`, `127.0.0.1`). Quando a página é servida pelo IP, o navegador envia `Origin: http://10.64.46.25:5173` e o Ollama responde `403` sem o cabeçalho `Access-Control-Allow-Origin`. Para o JavaScript, isso é indistinguível de “servidor fora do ar” — daí a mensagem de offline.

Como confirmar no navegador (F12 → Console):

```
Access to fetch at 'http://10.64.46.25:11434/api/tags' from origin
'http://10.64.46.25:5173' has been blocked by CORS policy
```

Como resolver, no computador que roda o Ollama:

```powershell
# 1. Encerre o Ollama (ícone na bandeja → Quit Ollama)
# 2. Libere a origem exata da interface
$env:OLLAMA_ORIGINS="http://10.64.46.25:5173"
ollama serve
```

Para tornar permanente no Windows, defina a variável de usuário e reabra o Ollama:

```powershell
setx OLLAMA_ORIGINS "http://10.64.46.25:5173"
```

Se acessar por vários endereços, separe por vírgula: `http://10.64.46.25:5173,http://localhost:5173`.

Alternativas:

- abrir a interface em `http://localhost:5173` (origem permitida por padrão);
- usar `OLLAMA_ORIGINS="*"` apenas em ambiente controlado.

Se o acesso for de **outro computador** e o erro for `ERR_CONNECTION_REFUSED` ou timeout (não CORS), verifique:

1. `OLLAMA_HOST="0.0.0.0:11434"` no host do Ollama, com ele reiniciado;
2. regra de entrada no Windows Firewall para a porta `11434`;
3. teste com `curl http://IP-DO-HOST:11434/api/tags` a partir do outro computador.

> O `python -m http.server 5173` já escuta em todas as interfaces, então o WebUI fica acessível pelo IP. Quem precisa liberar a origem é o **Ollama**, não o servidor de arquivos.

## Endpoints do Ollama usados

A WebUI fala diretamente com a API HTTP do Ollama no endereço configurado no campo **Servidor Ollama** (padrão de rede `http://10.64.46.25:11434`, com atalho para `http://localhost:11434`). Apenas dois endpoints são usados:

| Método | Endpoint | Para que serve | Onde é usado |
|---|---|---|---|
| `GET` | `/api/tags` | Listar os modelos instalados e verificar se o Ollama está online | `listModels()` em `js/ollama.js` |
| `POST` | `/api/chat` | Enviar o histórico da conversa e receber a resposta com streaming | `streamChat()` em `js/ollama.js` |

> O `OPTIONS /api/chat` e o `OPTIONS /api/tags` podem aparecer no DevTools: são preflights de CORS gerados automaticamente pelo navegador, não chamadas da aplicação.

### `GET /api/tags`

Usado ao abrir a página, ao clicar em atualizar modelos e no botão de reconexão.

```http
GET http://10.64.46.25:11434/api/tags
```

Resposta (resumida):

```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "model": "llama3.2:latest",
      "size": 2019393189,
      "details": {
        "family": "llama",
        "parameter_size": "3.2B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

A UI usa `name` para preencher o seletor e remove o sufixo `:latest` para exibir `llama3.2`. Se a chamada falhar, o status fica **Ollama offline** e o banner com instruções é exibido.

### `POST /api/chat`

Usado a cada mensagem enviada. Escolhemos `/api/chat` em vez de `/api/generate` porque ele aceita o histórico com papéis (`user` / `assistant` / `system`), que é o formato usado internamente pela UI.

```http
POST http://10.64.46.25:11434/api/chat
Content-Type: application/json
```

Corpo enviado:

```json
{
  "model": "llama3.2",
  "messages": [
    { "role": "user", "content": "Olá!" },
    { "role": "assistant", "content": "Olá! Como posso ajudar?" },
    { "role": "user", "content": "Explique o que é SSE." }
  ],
  "stream": true
}
```

O campo `messages` é montado em `buildContext()` (`js/chat.js`) a partir das mensagens da conversa ativa. Os controles aplicados antes do envio são:

- janela máxima de `historyWindow` mensagens (padrão 40);
- remoção de mensagens vazias e da resposta que está sendo gerada;
- descarte de respostas `assistant` no início do contexto;
- inclusão opcional de `systemPrompt`, se configurado.

**Formato da resposta:** o Ollama não usa SSE neste endpoint. Ele devolve **NDJSON** (`application/x-ndjson`): um objeto JSON por linha, enquanto o texto é gerado.

```json
{"model":"llama3.2","message":{"role":"assistant","content":"SSE é "},"done":false}
{"model":"llama3.2","message":{"role":"assistant","content":"um mecanismo "},"done":false}
{"model":"llama3.2","message":{"role":"assistant","content":"de eventos."},"done":true,"done_reason":"stop"}
```

A UI lê o corpo com `response.body.getReader()`, acumula o buffer, separa por `\n`, faz `JSON.parse` de cada linha e acrescenta `message.content` à bolha. Quando `done: true` chega, a resposta é finalizada e o Markdown é renderizado.

### Cancelamento

O botão **Parar** (e a tecla `Esc`) chama `AbortController.abort()`. Isso encerra a conexão HTTP com o Ollama; não existe endpoint de cancelamento. Se algo já tiver sido recebido, a mensagem é salva com o selo **incompleta**.

### Erros tratados

| Situação | Como a UI reage |
|---|---|
| Ollama não está rodando / erro de rede | Banner "Ollama offline" e aviso para executar `ollama serve` |
| HTTP diferente de 2xx | Mostra o campo `error` retornado pelo Ollama, quando existir |
| Modelo inexistente (`404`) | Mensagem orientando `ollama pull <modelo>` |
| Geração cancelada pelo usuário | Mantém a resposta parcial e marca como incompleta |
| CORS bloqueado | Banner offline; corrigir com `OLLAMA_ORIGINS` (seção acima) |

### Exemplos rápidos

```bash
# Listar modelos (troque o host se estiver usando localhost)
curl http://10.64.46.25:11434/api/tags

# Conversar sem streaming (para testar o endpoint)
curl http://10.64.46.25:11434/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"llama3.2\",\"messages\":[{\"role\":\"user\",\"content\":\"Olá\"}],\"stream\":false}"
```

## Funcionalidades

- **Streaming** da resposta em tempo real, com botão **Parar**
- **Histórico** de conversas no `localStorage` do navegador
  - agrupado por Hoje / Ontem / Últimos 7 dias / Mais antigas
  - busca por título, renomear inline e excluir com confirmação
- **Markdown** seguro: negrito, itálico, listas, títulos, citações, links, tabelas e blocos de código com botão **Copiar**
- **Seletor de modelo** alimentado por `GET /api/tags`, com atualização manual
- **Conexão configurável** com o Ollama: endereço de rede ou localhost, com atalhos e preferência salva
- **Tema claro/escuro** com preferência salva (o primeiro acesso segue o tema do sistema)
- **Regenerar** a última resposta e **tentar novamente** após erro
- Atalhos: `Enter` envia, `Shift+Enter` quebra linha, `Esc` para a geração, `Ctrl+K` busca conversas
- Layout responsivo com sidebar em gaveta no mobile
- Aviso amigável quando o Ollama está offline

## Estrutura

```
mvp_v1.1/
├── index.html
├── css/
│   ├── tokens.css        # variáveis de cor, tipografia e temas
│   ├── base.css          # reset, acessibilidade, scrollbar
│   ├── layout.css        # grid principal, sidebar, responsivo
│   └── components.css    # botões, mensagens, markdown, composer, toasts
└── js/
    ├── config.js         # URLs do Ollama (rede/localhost), modelo e limites
    ├── utils.js          # helpers de data, texto e escape
    ├── storage.js        # leitura/gravação versionada no localStorage
    ├── state.js          # estado e operações de conversas
    ├── ollama.js         # /api/tags e /api/chat com streaming
    ├── markdown.js       # renderer próprio, escape-first
    ├── ui.js             # renderização do DOM e feedback
    ├── chat.js           # envio, streaming, parar e regenerar
    └── app.js            # bootstrap e eventos
```

## Configuração

Edite `js/config.js`:

| Chave | Padrão | Descrição |
|---|---|---|
| `ollamaUrl` | `http://10.64.46.25:11434` | Endereço inicial; quando a página é aberta por um IP, usa o mesmo host na porta 11434 |
| `networkOllamaUrl` | `http://10.64.46.25:11434` | Endereço do atalho **Rede** |
| `localOllamaUrl` | `http://localhost:11434` | Endereço do atalho **Localhost** |
| `defaultModel` | `llama3.2` | Modelo usado quando não há preferência salva |
| `systemPrompt` | `""` | Mensagem de sistema opcional enviada ao modelo |
| `historyWindow` | `40` | Máximo de mensagens enviadas como contexto |
| `maxConversations` | `50` | Conversas mantidas no histórico local |

> O endereço escolhido no campo **Servidor Ollama** fica salvo no `localStorage` e tem prioridade sobre o padrão do `config.js`. Para redefinir, use os atalhos **Rede** ou **Localhost**.

## Privacidade

As conversas ficam apenas no `localStorage` deste navegador. As mensagens são enviadas somente ao servidor Ollama configurado (rede ou localhost); nada é enviado para serviços externos.

## Limitações desta versão

- Sem login, backend ou banco de dados — esses itens estão previstos no SRS (`docs/SRS-API-Chat-IA.md`) para a etapa FastAPI + MySQL.
- Sem voz (Web Speech API) nesta versão.
- O histórico fica limitado ao navegador e ao espaço do `localStorage`.
- O modelo precisa estar previamente baixado no Ollama.

## Próximos passos sugeridos

1. Backend FastAPI com autenticação JWT e MySQL, conforme o SRS.
2. Streaming via SSE a partir da API, escondendo o Ollama do cliente.
3. Camada `AIProvider` para alternar entre Ollama e nuvem por variável de ambiente.
4. Exportação de conversas e upload de arquivos/RAG.
