# Levantamento: Chat de IA via Web

Documento de planejamento para um chat de IA na web que recebe uma pergunta e devolve a resposta, com login e cadastro de usuários.

## Decisões já tomadas

| Item | Decisão |
|---|---|
| Backend | API em Python |
| Banco de dados | MySQL (login e cadastro) |
| Frontend | **React** |
| IA agora | **Modelo local** |
| IA no futuro | Nuvem, com troca fácil (sem reescrever o sistema) |

---

## 1. Arquitetura

```
[Frontend React] ⇄ [API Python (FastAPI)] ⇄ [MySQL]
                          │
                          └──⇄ [Provedor de IA: Local (Ollama) ou Nuvem (API)]
```

O frontend **nunca** fala direto com a IA. Só a API fala, porque assim:

- a chave da API de nuvem fica protegida;
- você controla login, limites de uso e histórico;
- trocar de modelo não afeta o frontend.

---

## 2. Backend

- **Linguagem:** Python (maior suporte para IA).
- **Framework:** **FastAPI** (rápido, `async`, documentação automática via Swagger e suporte a **streaming**).
- **Banco:** MySQL com **SQLAlchemy** (ORM) e **Alembic** (migrações).
- **Login e cadastro:**
  - senhas com hash (`bcrypt` ou `argon2`), nunca em texto puro;
  - **JWT** para manter a sessão (`PyJWT` ou `python-jose`);
  - FastAPI tem suporte nativo a OAuth2/JWT.

---

## 3. Frontend (React)

- **React + Vite** (rápido de configurar, grande comunidade).
- **Tailwind CSS** para estilo.
- **react-markdown** para renderizar as respostas da IA.
- Consumir **streaming (SSE)** para a resposta aparecer palavra por palavra.
- Guardar o token JWT e enviá-lo no header `Authorization: Bearer <token>`.

---

## 4. Como conectar o modelo de IA

### IA local (uso atual)

- **Ollama** (mais fácil): baixa e roda modelos (Llama, Qwen, Mistral, Gemma etc.) e expõe uma API HTTP em `http://localhost:11434`.
- **LM Studio**: interface gráfica, API compatível com a da OpenAI.
- **llama.cpp / vLLM**: opções avançadas, focadas em performance.

Passos:

1. Instalar o Ollama.
2. Baixar um modelo: `ollama pull <modelo>`.
3. A API FastAPI faz requisições HTTP ao Ollama (com `httpx` ou a lib `ollama`).
4. A resposta é repassada ao frontend em streaming.

**Hardware:** modelos pequenos (1B a 8B parâmetros) rodam em CPU com 16 GB de RAM, porém devagar. Com GPU (a VRAM é o fator principal) a velocidade melhora muito.

### IA em nuvem (uso futuro)

Envia-se o histórico por HTTP e recebe-se a resposta. Opções: Anthropic (Claude), OpenAI, Google (Gemini), entre outras. Todas têm SDK Python oficial.

---

## 5. Como deixar a troca Local → Nuvem fácil

A chave é uma **camada de abstração** (padrão *Strategy*): o resto do sistema só conhece uma interface, e cada provedor é uma implementação dela. Para trocar, muda-se **apenas uma variável de ambiente**.

### Estrutura de pastas sugerida

```
backend/
├── app/
│   ├── main.py
│   ├── config.py              # lê o .env
│   ├── api/
│   │   ├── auth.py            # login e cadastro
│   │   └── chat.py            # endpoint /chat
│   ├── core/
│   │   └── security.py        # hash de senha, JWT
│   ├── db/
│   │   ├── database.py
│   │   └── models.py
│   └── ai/
│       ├── base.py            # interface (contrato)
│       ├── ollama_provider.py # IA local
│       ├── cloud_provider.py  # IA nuvem (futuro)
│       └── factory.py         # escolhe o provedor
├── .env
└── requirements.txt
```

### `.env`

```env
# Troque apenas esta linha para mudar de IA
AI_PROVIDER=ollama

# Local
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

# Nuvem (preencher só quando for usar)
CLOUD_API_KEY=
CLOUD_MODEL=
```

### `ai/base.py` (o contrato)

```python
from abc import ABC, abstractmethod
from typing import AsyncIterator

class AIProvider(ABC):
    @abstractmethod
    async def generate(self, messages: list[dict]) -> str:
        """Retorna a resposta completa."""

    @abstractmethod
    async def stream(self, messages: list[dict]) -> AsyncIterator[str]:
        """Retorna a resposta em pedaços (streaming)."""
```

`messages` segue o formato padrão: `[{"role": "user", "content": "..."}, ...]`.

### `ai/ollama_provider.py` (IA local)

```python
import json
import httpx
from .base import AIProvider

class OllamaProvider(AIProvider):
    def __init__(self, url: str, model: str):
        self.url = url
        self.model = model

    async def generate(self, messages: list[dict]) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{self.url}/api/chat",
                json={"model": self.model, "messages": messages, "stream": False},
            )
            r.raise_for_status()
            return r.json()["message"]["content"]

    async def stream(self, messages: list[dict]):
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{self.url}/api/chat",
                json={"model": self.model, "messages": messages, "stream": True},
            ) as r:
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    chunk = data.get("message", {}).get("content", "")
                    if chunk:
                        yield chunk
```

### `ai/cloud_provider.py` (esqueleto para o futuro)

```python
from .base import AIProvider

class CloudProvider(AIProvider):
    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        # self.client = SDK_DO_PROVEDOR(api_key=api_key)

    async def generate(self, messages: list[dict]) -> str:
        # Chamar o SDK do provedor escolhido e retornar o texto
        raise NotImplementedError

    async def stream(self, messages: list[dict]):
        # Chamar o SDK em modo streaming e dar yield nos pedaços
        raise NotImplementedError
        yield
```

### `ai/factory.py` (escolhe o provedor)

```python
from app.config import settings
from .base import AIProvider
from .ollama_provider import OllamaProvider
from .cloud_provider import CloudProvider

def get_ai_provider() -> AIProvider:
    if settings.AI_PROVIDER == "ollama":
        return OllamaProvider(settings.OLLAMA_URL, settings.OLLAMA_MODEL)
    if settings.AI_PROVIDER == "cloud":
        return CloudProvider(settings.CLOUD_API_KEY, settings.CLOUD_MODEL)
    raise ValueError(f"AI_PROVIDER inválido: {settings.AI_PROVIDER}")
```

### `api/chat.py` (usa só a interface)

```python
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.ai.factory import get_ai_provider
from app.ai.base import AIProvider

router = APIRouter()

@router.post("/chat")
async def chat(payload: dict, ai: AIProvider = Depends(get_ai_provider)):
    messages = payload["messages"]

    async def event_stream():
        async for chunk in ai.stream(messages):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

> O endpoint **não sabe** se a IA é local ou nuvem. Para migrar no futuro: implementar `CloudProvider`, preencher o `.env` e trocar `AI_PROVIDER=cloud`.

---

## 6. Banco de dados

Necessário por causa de login e cadastro (e para guardar o histórico).

| Tabela | Colunas |
|---|---|
| `users` | id, nome, email, senha_hash, criado_em |
| `conversations` | id, user_id, titulo, criado_em |
| `messages` | id, conversation_id, role (`user`/`assistant`), conteudo, criado_em |

Os modelos de IA **não têm memória própria**: a cada pergunta, a API reenvia as mensagens anteriores da conversa como contexto.

---

## 7. Custos

| Item | Custo |
|---|---|
| IA local (Ollama) | Grátis (só energia e hardware) |
| IA em nuvem | Por uso (tokens); barato para testes, cresce com o volume |
| FastAPI, MySQL, React | Grátis (open source) |
| Hospedagem (VPS, Railway, Render etc.) | De grátis (limitado) a alguns dólares por mês |
| Domínio | Cerca de R$ 40 a R$ 80 por ano |

- **Desenvolvimento:** tudo a custo zero (Ollama + MySQL + React local).
- **Produção:** o custo vem da hospedagem e, se usar IA em nuvem, dos tokens.
- Modelo local em produção exige servidor com GPU, que costuma sair mais caro do que pagar a API de nuvem.

---

## 8. Stack final

- **Backend:** Python + FastAPI + SQLAlchemy + Alembic + MySQL + JWT
- **IA:** Ollama (agora) → provedor de nuvem (futuro), via camada de abstração
- **Frontend:** React + Vite + Tailwind + react-markdown
- **Comunicação:** streaming via SSE

---

## 9. Próximos passos

1. Instalar o Ollama e testar um modelo no terminal.
2. Criar o projeto FastAPI com a estrutura de pastas acima.
3. Implementar `AIProvider` + `OllamaProvider` e o endpoint `/chat`.
4. Criar o banco MySQL e as tabelas (`users`, `conversations`, `messages`).
5. Implementar cadastro e login com JWT.
6. Criar o frontend React com tela de login e tela de chat (streaming).
7. Salvar o histórico das conversas no banco.
8. (Futuro) Implementar `CloudProvider` e trocar `AI_PROVIDER` no `.env`.
