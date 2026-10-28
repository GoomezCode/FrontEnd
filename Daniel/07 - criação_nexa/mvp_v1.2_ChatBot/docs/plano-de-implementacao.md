# Plano de Implementação — Nexa

**Produto:** Chat de IA via Web (WebUI + API + MySQL)  
**Versão do plano:** 1.0  
**Data:** 27/10/2026  
**Status geral:** WebUI local concluída; backend e banco ainda não iniciados  
**Documentos de referência:** [`SRS-API-Chat-IA.md`](../../docs/SRS-API-Chat-IA.md), [`levantamento-chat-ia-web.md`](../../docs/levantamento-chat-ia-web.md), [`ideia_web_jarvis.md`](../../docs/ideia_web_jarvis.md)

---

## 1. Resumo executivo

O projeto é um chat de IA via web com autenticação, histórico persistido e administração. A entrega evolui em duas camadas:

1. **WebUI local (concluída):** interface em HTML/CSS/JS puro que conversa diretamente com o Ollama, com streaming, Markdown, histórico no navegador, seleção de modelo e temas. Está em `mvp_v1.1/`.
2. **Plataforma completa (a construir):** API em Python/FastAPI, banco MySQL, autenticação JWT, histórico por usuário, administração, auditoria e camada de abstração de IA. É o escopo detalhado no SRS.

O objetivo deste plano é ordenar a construção da segunda camada sem retrabalho, mantendo a WebUI atual como cliente funcional e preparando sua integração com a API.

**Próximo marco:** subir o backend com autenticação e o endpoint de chat em streaming, ainda usando o Ollama como provedor.

---

## 2. Visão do produto

### 2.1 Problema

Usuários precisam conversar com modelos de IA por uma interface web simples, com respostas em tempo real, histórico consultável e acesso protegido. O operador precisa gerenciar usuários, acompanhar uso e trocar o provedor de IA sem reescrever o sistema.

### 2.2 Classes de usuário

| Classe | Necessidades principais |
|---|---|
| Visitante | Cadastrar-se, entrar, consultar saúde da API |
| Usuário | Conversar, organizar conversas, consultar histórico, editar perfil |
| Administrador | Gerenciar usuários, ver estatísticas, auditar ações, acompanhar a IA |
| Cliente da API | Consumir os mesmos recursos com token JWT |

### 2.3 Fluxos principais

1. **Onboarding:** cadastro → login → primeira conversa → resposta em streaming.
2. **Uso recorrente:** login → retomar conversa → enviar nova mensagem → histórico salvo.
3. **Administração:** login admin → listar/editar/desativar usuários → consultar estatísticas e auditoria.
4. **Operação:** trocar `AI_PROVIDER` no `.env` → reiniciar API → nenhuma mudança no frontend ou nos endpoints.

---

## 3. Estado atual

| Componente | Status | Local | Observações |
|---|---|---|---|
| MVP inicial | Concluído | `mvp_v1/` | Um input, um botão e `fetch` em `/api/generate` |
| WebUI local | **Concluída** | `mvp_v1.1/` | Streaming, histórico local, Markdown, temas, modelos |
| Especificação (SRS) | Concluída | `docs/SRS-API-Chat-IA.md` | Base para backend, dados e aceitação |
| Backend FastAPI | Não iniciado | — | Estrutura definida neste plano |
| Banco MySQL | Não iniciado | — | Modelo definido no SRS (seção 3.3) |
| Autenticação JWT | Não iniciada | — | Cadastro, login, refresh e logout |
| Administração | Não iniciada | — | Usuários, estatísticas, auditoria, status da IA |
| Deploy e CI | Não iniciados | — | Docker, pipelines e testes automatizados |

### 3.1 Entregue no `mvp_v1.1`

- Streaming via `POST /api/chat` do Ollama, com cancelamento por `AbortController`.
- Histórico de conversas em `localStorage` (chave `nexa.chat.v1`), com busca, renomear e excluir.
- Markdown próprio com escape-first, tabelas, listas e blocos de código com cópia.
- Seletor de modelos alimentado por `GET /api/tags` (normaliza o sufixo `:latest`).
- Tema claro/escuro persistido e layout responsivo.
- Tratamento de Ollama offline, erros, resposta parcial e regeneração.
- Validações executadas: sintaxe dos módulos, renderer Markdown contra XSS, streaming real e fluxo E2E no Chrome (envio, parar, regenerar, renomear, recarregar e tema).

### 3.2 Lacunas conhecidas da WebUI local

- Fala diretamente com `localhost:11434`; não há backend, login nem autorização.
- Histórico preso ao navegador e ao limite do `localStorage`.
- Sem contexto de usuário, rate limit ou persistência entre dispositivos.
- Sem voz (Web Speech API), exportação ou upload de arquivos.

---

## 4. Escopo

### 4.1 Dentro do escopo da versão 1.0

- Cadastro, login, refresh token e logout.
- Perfil do usuário (consultar, editar, trocar senha, excluir conta).
- Chat com resposta completa ou streaming via SSE.
- Conversas e mensagens persistidas por usuário.
- Administração de usuários, estatísticas, status do provedor e auditoria.
- Health checks, documentação OpenAPI e erros padronizados.
- Camada `AIProvider` com `OllamaProvider` e esqueleto de `CloudProvider`.
- Testes automatizados, lint, tipagem, Docker e migrations.

### 4.2 Fora do escopo desta versão

- Cobrança, planos e controle de custo por tokens.
- Verificação de e-mail e recuperação de senha.
- Login social e MFA.
- Upload de arquivos, imagens e RAG.
- Compartilhamento de conversas e lixeira.
- Implementação efetiva do provedor de nuvem (somente contrato e esqueleto).
- Voz no WebUI (pode entrar como evolução opcional).

---

## 5. Decisões arquiteturais

| ID | Decisão | Justificativa | Consequência |
|---|---|---|---|
| ADR-01 | Manter a WebUI em HTML/CSS/JS puro no curto prazo | Já funciona, não exige build e reduz atrito para o MVP | Migração para React fica opcional e incremental |
| ADR-02 | No `mvp_v1.1`, o navegador fala direto com o Ollama; na v1.0, somente a API fala | Protege chaves, centraliza limites e histórico | A WebUI ganha uma camada `api.js` e passa a usar JWT |
| ADR-03 | Padrão **Strategy** para IA (`AIProvider`) | Trocar local ↔ nuvem por configuração | Endpoints dependem só da interface |
| ADR-04 | SSE com JSON em `data:` | Evita quebras com novas linhas no texto | Eventos `done` e `error` explícitos |
| ADR-05 | JWT de acesso curto + refresh token com hash no banco | Sessão segura e revogável | Tabela `refresh_tokens` e endpoint de refresh |
| ADR-06 | MySQL + SQLAlchemy + Alembic | Definido no SRS | Migrações versionadas obrigatórias |
| ADR-07 | Markdown próprio com escape-first | Sem CDN, seguro contra HTML da IA | Menos recursos que um parser completo |
| ADR-08 | Histórico local agora, histórico no servidor depois | Entrega valor sem backend | Importação de conversas locais fica opcional |
| ADR-09 | Rate limit por usuário com janela deslizante | Requisito RF-CHAT-09 | Em múltiplas instâncias, usar Redis |
| ADR-10 | API versionada em `/api/v1` | Evolução sem quebrar clientes | Health e docs ficam fora do prefixo |

### 5.1 Sobre o frontend

O levantamento original previa React + Vite + Tailwind. A implementação atual optou por vanilla para validar o produto rapidamente. Este plano **não bloqueia** o backend por causa disso:

- a WebUI atual será adaptada com um cliente de API (`js/api.js`) e telas de login;
- a separação em módulos (`ui`, `chat`, `state`, `storage`) permite reutilizar o desenho ao migrar para React;
- a migração para React será reavaliada após a integração com a API, quando o custo real de manutenção for conhecido.

---

## 6. Arquitetura alvo

```
┌──────────────────────────────────────────┐
│ Navegador                                │
│ Nexa WebUI (HTML/CSS/JS ou React)        │
│  · login e sessão                        │
│  · chat com streaming (SSE)              │
│  · histórico vindo da API                │
└───────────────────┬──────────────────────┘
                    │ HTTPS · JSON / SSE
┌───────────────────▼──────────────────────┐
│ API FastAPI — /api/v1                    │
│  auth · perfil · chat · conversas · admin│
│  rate limit · auditoria · observabilidade│
└──────────┬───────────────────┬───────────┘
           │ SQLAlchemy        │ HTTP
┌──────────▼─────────┐  ┌──────▼──────────────┐
│ MySQL 8            │  │ AIProvider          │
│ users              │  │  ├─ OllamaProvider  │
│ conversations      │  │  └─ CloudProvider   │
│ messages           │  │     (futuro)        │
│ refresh_tokens     │  └─────────────────────┘
│ audit_logs         │
└────────────────────┘
```

**Regra de ouro:** o frontend nunca recebe chaves nem fala com o provedor de IA em produção. Somente a API conhece o provedor ativo.

### 6.1 Camadas do backend

| Camada | Responsabilidade |
|---|---|
| `api/` | Rotas, validação de entrada, dependências e códigos HTTP |
| `services/` | Regras de negócio, transações e orquestração |
| `db/` | Sessão, modelos SQLAlchemy e repositórios |
| `ai/` | Contrato `AIProvider`, implementações e factory |
| `core/` | Segurança, JWT, hash, rate limit, erros e logging |
| `schemas/` | Modelos Pydantic de entrada e saída |
| `observability/` | Request ID, logs estruturados e métricas |

---

## 7. Estrutura de pastas alvo

```
07 - criação_nexa/
├── docs/                      # SRS e levantamento
├── mvp_v1/                    # baseline didático
├── mvp_v1.1/                  # WebUI atual
│   └── docs/                  # este plano
└── backend/
    ├── app/
    │   ├── main.py            # cria a app, CORS, health, handlers
    │   ├── config.py          # settings via .env
    │   ├── api/
    │   │   └── v1/
    │   │       ├── auth.py
    │   │       ├── users.py
    │   │       ├── conversations.py
    │   │       ├── chat.py
    │   │       ├── admin.py
    │   │       └── health.py
    │   ├── core/
    │   │   ├── security.py    # Argon2 + JWT
    │   │   ├── rate_limit.py
    │   │   ├── errors.py      # Problem Details
    │   │   └── logging.py
    │   ├── db/
    │   │   ├── database.py
    │   │   ├── models.py
    │   │   └── seed.py        # primeiro admin (RN-03)
    │   ├── schemas/
    │   │   ├── auth.py
    │   │   ├── user.py
    │   │   ├── conversation.py
    │   │   ├── chat.py
    │   │   └── admin.py
    │   ├── services/
    │   │   ├── auth_service.py
    │   │   ├── user_service.py
    │   │   ├── conversation_service.py
    │   │   ├── chat_service.py
    │   │   └── admin_service.py
    │   └── ai/
    │       ├── base.py
    │       ├── ollama_provider.py
    │       ├── cloud_provider.py
    │       └── factory.py
    ├── alembic/
    │   └── versions/
    ├── tests/
    │   ├── unit/
    │   ├── integration/
    │   └── conftest.py
    ├── docker-compose.yml
    ├── Dockerfile
    ├── requirements.txt
    ├── .env.example
    └── README.md
```

A WebUI ganha, na fase de integração, os arquivos `js/api.js`, `js/auth.js` e `js/session.js`, mantendo o restante da estrutura.

---

## 8. Fases de implementação

As estimativas são relativas (dias de desenvolvimento de uma pessoa) e assumem familiaridade com Python, FastAPI e SQL. Elas não incluem espera por infraestrutura.

| Fase | Entrega | Estimativa | Depende de |
|---|---|---|---|
| 0 | Fundação do backend, ambiente e CI | 3 dias | — |
| 1 | WebUI local | **Concluída** | — |
| 2 | Autenticação, perfil e banco | 5 dias | Fase 0 |
| 3 | Camada de IA e endpoint de chat | 4 dias | Fase 0 |
| 4 | Conversas e mensagens persistidas | 4 dias | Fases 2 e 3 |
| 5 | Integração da WebUI com a API | 6 dias | Fases 2, 3 e 4 |
| 6 | Administração, auditoria e observabilidade | 5 dias | Fase 4 |
| 7 | Qualidade, Docker e deploy | 5 dias | Fases 2 a 6 |
| 8 | Evoluções (nuvem, RAG, voz) | contínuo | Fase 7 |

**Total estimado até a v1.0:** 32 dias úteis de desenvolvimento, aproximadamente 6 a 7 semanas em meio período.

### Fase 0 — Fundação (3 dias)

**Objetivo:** ter um esqueleto executável, configurável e testável.

- [ ] Criar `backend/` com `app/main.py`, `config.py` e `/health`.
- [ ] Configurar `pydantic-settings` e `.env.example` com todas as variáveis da seção 12.
- [ ] Configurar SQLAlchemy assíncrono e sessão por requisição.
- [ ] Subir MySQL via `docker-compose` (API + banco).
- [ ] Configurar Alembic e a primeira migration vazia.
- [ ] Configurar Ruff, Black e mypy; pipeline de lint.
- [ ] Configurar pytest e teste de fumaça do `/health`.
- [ ] Definir middleware de `X-Request-ID` e formato de erro.

**Critério de saída:** `docker compose up` sobe API e MySQL; `/health` responde `200`; lint e testes rodam no CI.

### Fase 1 — WebUI local (concluída)

**Objetivo:** validar a experiência de chat antes de investir no backend.

- [x] Interface de chat responsiva com tema claro/escuro.
- [x] Streaming com parar, regenerar e tentar novamente.
- [x] Markdown seguro, código copiável e tabelas.
- [x] Histórico em `localStorage`, busca, renomear e excluir.
- [x] Seleção de modelo e status do Ollama.
- [x] Tratamento de erros e validação E2E.

**Critério de saída:** atentido — chat funcional de ponta a ponta com Ollama local.

### Fase 2 — Autenticação, perfil e banco (5 dias)

**Objetivo:** usuários reais com sessão segura.

- [ ] Modelos `users` e `refresh_tokens` + migration.
- [ ] Hash Argon2id e política de senha (8+ caracteres, letra e número).
- [ ] `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.
- [ ] Access token (30 min) e refresh token (7 dias) com hash no banco.
- [ ] Dependência `get_current_user` validando `sub`, `role`, `exp` e status ativo.
- [ ] `GET/PATCH/DELETE /users/me` e `POST /users/me/password`.
- [ ] Seed do primeiro admin via `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
- [ ] Limite de tentativas de login e mensagens de erro genéricas.
- [ ] Testes de cadastro duplicado, login inválido, usuário inativo e refresh revogado.

**Critério de saída:** CA-01, CA-02 e CA-11 atendidos; tokens inválidos ou de usuário desativado são rejeitados.

### Fase 3 — Camada de IA e chat (4 dias)

**Objetivo:** endpoint de chat com streaming e provedor abstraído.

- [ ] `ai/base.py` com `generate` e `stream`.
- [ ] `OllamaProvider` usando `/api/chat` (linhas JSON — NDJSON).
- [ ] `CloudProvider` como esqueleto documentado.
- [ ] `factory.py` escolhendo por `AI_PROVIDER`.
- [ ] `POST /api/v1/chat` com validação de `messages`, limites e último `role = user`.
- [ ] Modo `stream=false` (JSON completo) e `stream=true` (SSE com JSON em `data:`).
- [ ] Eventos `done` e `error`; tradução de falhas para `502`/`504`.
- [ ] Cancelamento ao desconectar o cliente (RF-CHAT-08).
- [ ] Rate limit por usuário com `429` e `Retry-After`.
- [ ] Testes com provedor fake, Ollama indisponível e timeout.

**Critério de saída:** CA-03, CA-04, CA-08, CA-09 e CA-13 atendidos.

### Fase 4 — Conversas e mensagens persistidas (4 dias)

**Objetivo:** histórico confiável por usuário.

- [ ] Modelos `conversations` e `messages` + migration com cascatas e índices.
- [ ] CRUD de conversas com paginação, busca por título e verificação de propriedade.
- [ ] Listagem de mensagens em ordem cronológica.
- [ ] Persistência no chat somente quando `conversation_id` for informado.
- [ ] Gravação atômica da pergunta e da resposta ao final da geração.
- [ ] Título provisório automático (primeiros 50 caracteres).
- [ ] Marcação de resposta incompleta em cancelamentos.
- [ ] Testes de isolamento entre usuários (`404` para recurso alheio).

**Critério de saída:** CA-05, CA-06 e CA-07 atendidos.

### Fase 5 — Integração da WebUI com a API (6 dias)

**Objetivo:** substituir o acesso direto ao Ollama pelo backend, com login e histórico do servidor.

- [ ] Criar `js/api.js` com base URL, tratamento de erros e `Authorization: Bearer`.
- [ ] Criar `js/session.js` para access token em memória e refresh automático.
- [ ] Telas de login e cadastro (rotas ou seções na SPA).
- [ ] Guardar o refresh token com segurança; nunca em log ou URL.
- [ ] Adaptar `ollama.js` → chamada à API com parser SSE (`event:`, `data:`).
- [ ] Carregar conversas e mensagens do servidor ao iniciar.
- [ ] Enviar sempre o contexto completo e o `conversation_id` ativo.
- [ ] Exibir estado de sessão expirada e renovar sem perder a conversa.
- [ ] Manter o modo local como opção de desenvolvimento (`config.mode = "local" | "api"`).
- [ ] Revisar textos, estados de carregamento e acessibilidade após a integração.
- [ ] Testes E2E: cadastro, login, conversa, recarregar, logout.

**Critério de saída:** a WebUI funciona sem conhecer o Ollama; todo tráfego de IA passa pela API.

### Fase 6 — Administração e observabilidade (5 dias)

**Objetivo:** operação e governança do sistema.

- [ ] Guarda de `role = admin` em `/admin/*`.
- [ ] Listagem, consulta, edição, ativação e exclusão de usuários.
- [ ] Redefinição de senha pelo admin.
- [ ] Proteção do último administrador ativo.
- [ ] `GET /admin/stats` e `GET /admin/ai/status`.
- [ ] Tabela `audit_logs` e registro das ações sensíveis.
- [ ] Interface administrativa mínima na WebUI (lista, filtros, ações).
- [ ] Logs JSON com `request_id`, rota, status e latência.
- [ ] Métricas de chat: provedor, modelo, duração e tokens quando disponíveis.

**Critério de saída:** CA-10 e CA-12 atendidos; ações administrativas auditadas.

### Fase 7 — Qualidade, Docker e deploy (5 dias)

**Objetivo:** colocar a v1.0 em produção com confiança.

- [ ] Cobertura ≥ 80% em serviços e rotas.
- [ ] Testes de contrato da API e de streaming.
- [ ] Teste de carga com 50 streams simultâneos (RNF-DES-04).
- [ ] `Dockerfile` multi-stage e `docker-compose` de desenvolvimento.
- [ ] Migrations aplicadas e revertidas em banco vazio (CA-15).
- [ ] HTTPS, CORS restrito e cabeçalhos de segurança.
- [ ] Backup e restauração do MySQL documentados.
- [ ] Graceful shutdown e timeouts do provedor.
- [ ] Pipeline CI: lint, tipagem, testes, build.
- [ ] Deploy em ambiente de homologação e checklist de go-live.

**Critério de saída:** CA-14, CA-15 e CA-16 atendidos; deploy reproduzível.

### Fase 8 — Evoluções (contínuo)

- [ ] `CloudProvider` real (OpenAI, Anthropic ou Gemini) ativado por `.env`.
- [ ] Importação das conversas locais do `mvp_v1.1` para a conta do usuário.
- [ ] Exportação de conversas em Markdown/JSON.
- [ ] Voz no WebUI (Web Speech API) como no documento de ideia.
- [ ] RAG com upload de documentos.
- [ ] Compartilhamento de conversas e lixeira.
- [ ] Cotas diárias/mensais e painel de custos.

---

## 9. Backlog detalhado por módulo

### 9.1 Autenticação e perfil

| Item | Requisitos | Fase |
|---|---|---|
| Cadastro com e-mail único e normalizado | RF-AUT-01 a 03 | 2 |
| Login com JWT e mensagem genérica | RF-AUT-04 a 06, 10 | 2 |
| Refresh e logout com revogação | RF-AUT-08, 09 | 2 |
| Consultar e editar o próprio perfil | RF-PER-01, 02, 05 | 2 |
| Trocar senha e excluir conta | RF-PER-03, 04 | 2 |
| Bloqueio temporário por tentativas | RNF-SEG-06 | 2 |

### 9.2 Chat

| Item | Requisitos | Fase |
|---|---|---|
| Endpoint com JSON completo e SSE | RF-CHAT-01 a 03 | 3 |
| Validação de mensagens e limites | RF-CHAT-04 | 3 |
| Uso exclusivo de `AIProvider` | RF-CHAT-05 | 3 |
| Persistência opcional por `conversation_id` | RF-CHAT-06, 07 | 4 |
| Cancelamento e resposta parcial | RF-CHAT-08 | 3/4 |
| Rate limit com `Retry-After` | RF-CHAT-09 | 3 |
| Erros de provedor traduzidos | RF-CHAT-10 | 3 |
| `system_prompt` opcional | RF-CHAT-11 | 3 |
| Título automático | RF-CHAT-12 | 4 |

### 9.3 Conversas

| Item | Requisitos | Fase |
|---|---|---|
| Criar, listar, consultar e renomear | RF-CONV-01 a 04 | 4 |
| Excluir com cascata | RF-CONV-05 | 4 |
| Listar mensagens com paginação | RF-CONV-06 | 4 |
| Isolamento por usuário | RF-CONV-07 | 4 |
| Busca por título e exclusão em massa | RF-CONV-08, 09 | 4 |

### 9.4 Administração e sistema

| Item | Requisitos | Fase |
|---|---|---|
| CRUD e ativação de usuários | RF-ADM-02 a 06 | 6 |
| Proteção do último admin | RF-ADM-07 | 6 |
| Redefinição de senha | RF-ADM-08 | 6 |
| Estatísticas e status da IA | RF-ADM-09, 10 | 6 |
| Auditoria | RF-ADM-11 | 6 |
| Health checks e OpenAPI | RF-SIS-01 a 04 | 0/7 |

---

## 10. Modelo de dados

Baseado no SRS, seção 3.3. Todas as datas em UTC e charset `utf8mb4`.

### 10.1 `users`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | BIGINT PK | Auto incremento |
| `nome` | VARCHAR(120) | Obrigatório |
| `email` | VARCHAR(255) | Único, normalizado em minúsculas |
| `senha_hash` | VARCHAR(255) | Argon2id ou bcrypt |
| `role` | ENUM(`user`,`admin`) | Padrão `user` |
| `ativo` | BOOLEAN | Padrão `true` |
| `criado_em` / `atualizado_em` | DATETIME | UTC |

Índices: `email` único; `role` e `ativo` para filtros administrativos.

### 10.2 `conversations`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | BIGINT PK | — |
| `user_id` | BIGINT FK → `users.id` | `ON DELETE CASCADE`, indexado |
| `titulo` | VARCHAR(200) | Padrão "Nova conversa" |
| `criado_em` / `atualizado_em` | DATETIME | `atualizado_em` indexado para ordenação |

### 10.3 `messages`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | BIGINT PK | — |
| `conversation_id` | BIGINT FK → `conversations.id` | `ON DELETE CASCADE`, indexado |
| `role` | ENUM(`user`,`assistant`) | Mensagens de sistema não são persistidas |
| `conteudo` | MEDIUMTEXT | Texto completo |
| `incompleta` | BOOLEAN | Resposta interrompida |
| `criado_em` | DATETIME | Indexado com `conversation_id` |

### 10.4 `refresh_tokens`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | BIGINT PK | — |
| `user_id` | BIGINT FK → `users.id` | Cascata |
| `token_hash` | VARCHAR(255) | Único; nunca armazenar o token puro |
| `expira_em` | DATETIME | — |
| `revogado` | BOOLEAN | Logout e rotação |
| `criado_em` | DATETIME | — |

### 10.5 `audit_logs`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | BIGINT PK | — |
| `actor_id` | BIGINT | Admin que executou |
| `acao` | VARCHAR(80) | Ex.: `user.disabled` |
| `alvo_tipo` / `alvo_id` | VARCHAR(40) / BIGINT | Recurso afetado |
| `detalhes` | JSON | Sem dados sensíveis |
| `criado_em` | DATETIME | Indexado |

### 10.6 Regras de integridade

- Excluir usuário remove conversas, mensagens e refresh tokens em cascata.
- Excluir conversa remove mensagens em cascata.
- Sempre deve existir ao menos um admin ativo (validado em serviço, não só no banco).
- `senha_hash` nunca aparece em schemas de resposta, logs ou auditoria.

---

## 11. Contratos da API

Prefixo `/api/v1`. Autenticação via `Authorization: Bearer <access_token>`.

### 11.1 Endpoints

| Método | Rota | Acesso | Fase |
|---|---|---|---|
| POST | `/auth/register` | Público | 2 |
| POST | `/auth/login` | Público | 2 |
| POST | `/auth/refresh` | Público | 2 |
| POST | `/auth/logout` | Usuário | 2 |
| GET | `/users/me` | Usuário | 2 |
| PATCH | `/users/me` | Usuário | 2 |
| POST | `/users/me/password` | Usuário | 2 |
| DELETE | `/users/me` | Usuário | 2 |
| POST | `/chat` | Usuário | 3 |
| POST | `/conversations` | Usuário | 4 |
| GET | `/conversations` | Usuário | 4 |
| GET | `/conversations/{id}` | Usuário | 4 |
| PATCH | `/conversations/{id}` | Usuário | 4 |
| DELETE | `/conversations/{id}` | Usuário | 4 |
| DELETE | `/conversations` | Usuário | 4 |
| GET | `/conversations/{id}/messages` | Usuário | 4 |
| GET | `/admin/users` | Admin | 6 |
| POST | `/admin/users` | Admin | 6 |
| GET | `/admin/users/{id}` | Admin | 6 |
| PATCH | `/admin/users/{id}` | Admin | 6 |
| POST | `/admin/users/{id}/reset-password` | Admin | 6 |
| DELETE | `/admin/users/{id}` | Admin | 6 |
| GET | `/admin/stats` | Admin | 6 |
| GET | `/admin/ai/status` | Admin | 6 |
| GET | `/admin/audit-logs` | Admin | 6 |
| GET | `/health` | Público | 0 |
| GET | `/health/ready` | Público | 7 |
| GET | `/docs`, `/redoc` | Público | 0 |

### 11.2 Chat — requisição

```json
{
  "messages": [
    {"role": "user", "content": "Olá!"},
    {"role": "assistant", "content": "Olá! Como posso ajudar?"},
    {"role": "user", "content": "Explique o que é SSE."}
  ],
  "conversation_id": 42,
  "stream": true
}
```

Regras: `messages` não vazio; `role` em `system|user|assistant`; último item deve ser `user`; respeitar `MAX_MESSAGES_PER_REQUEST` e `MAX_MESSAGE_CHARS`.

### 11.3 Chat — resposta completa

```json
{
  "message": {"role": "assistant", "content": "SSE é ..."},
  "conversation_id": 42,
  "provider": "ollama",
  "model": "llama3.1"
}
```

### 11.4 Chat — streaming SSE

```
data: {"content": "SSE é "}

data: {"content": "um mecanismo ..."}

event: done
data: {"conversation_id": 42, "message_id": 311}
```

Em falha após o início do fluxo:

```
event: error
data: {"code": "ai_provider_unavailable", "detail": "O provedor de IA não respondeu."}
```

### 11.5 Formato de erro

Inspirado na RFC 9457:

```json
{
  "type": "about:blank",
  "title": "Conflito",
  "status": 409,
  "code": "email_already_registered",
  "detail": "Já existe um usuário com este e-mail.",
  "request_id": "b1f4c7e2-..."
}
```

---

## 12. Configuração e ambientes

### 12.1 Variáveis de ambiente

| Variável | Obrigatória | Exemplo | Uso |
|---|---|---|---|
| `APP_ENV` | Não | `development` | Comportamento de logs e docs |
| `DATABASE_URL` | Sim | `mysql+pymysql://user:pass@mysql:3306/nexa` | Conexão MySQL |
| `JWT_SECRET` | Sim | valor aleatório forte | Assinatura dos tokens |
| `JWT_ALGORITHM` | Não | `HS256` | Algoritmo |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Não | `30` | Validade do access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Não | `7` | Validade do refresh token |
| `AI_PROVIDER` | Sim | `ollama` | `ollama` ou `cloud` |
| `OLLAMA_URL` | Sim (local) | `http://ollama:11434` | Endpoint do Ollama |
| `OLLAMA_MODEL` | Sim (local) | `llama3.1` | Modelo padrão |
| `CLOUD_API_KEY` | Não | — | Chave do provedor de nuvem |
| `CLOUD_MODEL` | Não | — | Modelo de nuvem |
| `CORS_ORIGINS` | Sim | `http://localhost:5173` | Origens permitidas |
| `RATE_LIMIT_CHAT_PER_MIN` | Não | `20` | Limite de chat por usuário |
| `MAX_MESSAGES_PER_REQUEST` | Não | `100` | Contexto máximo |
| `MAX_MESSAGE_CHARS` | Não | `8000` | Tamanho por mensagem |
| `ADMIN_EMAIL` | Sim (seed) | `admin@nexa.local` | Primeiro administrador |
| `ADMIN_PASSWORD` | Sim (seed) | senha temporária forte | Senha inicial do admin |
| `LOG_LEVEL` | Não | `INFO` | Verbosidade dos logs |

### 12.2 Ambientes

| Ambiente | IA | Banco | Frontend | Observação |
|---|---|---|---|---|
| Desenvolvimento local | Ollama na máquina | MySQL em Docker | WebUI em `http://localhost:5173` | CORS liberado para localhost |
| Homologação | Ollama em container/GPU ou nuvem | MySQL gerenciado | Build estático | Dados fictícios |
| Produção | Nuvem (recomendado) ou GPU dedicada | MySQL gerenciado | HTTPS | Chaves em cofre de segredos |

---

## 13. Segurança e privacidade

### 13.1 Backend

- [ ] Senhas com Argon2id (fallback bcrypt) e salt individual.
- [ ] Access token curto; refresh token armazenado apenas como hash.
- [ ] Rotação e revogação de refresh tokens no logout.
- [ ] Verificação do status `ativo` do usuário a cada requisição autenticada.
- [ ] Rate limit no login e no chat, com `429` e `Retry-After`.
- [ ] CORS restrito por ambiente.
- [ ] Pydantic com `extra = "forbid"` nos corpos sensíveis.
- [ ] Acesso ao banco somente por ORM/consultas parametrizadas.
- [ ] Limite de corpo de requisição (1 MB) e de mensagem (8.000 caracteres).
- [ ] Cabeçalhos `X-Content-Type-Options`, `X-Frame-Options` e HSTS em produção.
- [ ] `senha_hash`, tokens e chaves nunca em respostas ou logs.
- [ ] Verificação de propriedade em toda conversa/mensagem (resposta `404`).
- [ ] Conteúdo gerado pela IA tratado como dado não confiável: não executar, não interpretar como instrução.
- [ ] Logs sem conteúdo integral das mensagens, salvo modo de depuração explícito.
- [ ] Dados em UTC, charset `utf8mb4` e exclusão em cascata.

### 13.2 Frontend

- [ ] Token de acesso mantido em memória, não em `localStorage`.
- [ ] Refresh token preferencialmente em cookie `HttpOnly; Secure; SameSite=Strict`; se o cliente for externo, seguir o contrato do SRS.
- [ ] Nenhuma chave de IA no navegador.
- [ ] Markdown com escape-first (já implementado) e links apenas `http`, `https`, `mailto` e âncoras.
- [ ] Mensagens de erro sem detalhes internos do provedor.
- [ ] Botão de sair limpando a sessão e o cache em memória.

### 13.3 LGPD

- [ ] Documentar base legal, retenção e finalidade dos dados.
- [ ] Permitir exclusão da conta e dos dados associados.
- [ ] Exportação de dados do usuário (evolução).
- [ ] Não enviar conteúdo a provedores externos sem informar o usuário.
- [ ] Registrar incidentes e contatos de privacidade.

---

## 14. Estratégia de testes e qualidade

### 14.1 Pirâmide

| Nível | Ferramenta | Escopo |
|---|---|---|
| Unitário | pytest | Segurança, validações, serviços e providers com fake |
| Integração | pytest + TestClient + MySQL de teste | Rotas, banco, migrations e streaming |
| Contrato | pytest + snapshot do OpenAPI | Compatibilidade dos endpoints |
| E2E | Playwright | Login, chat, streaming, histórico e admin |
| Carga | k6 ou Locust | 50 streams simultâneos e latência de endpoints sem IA |

### 14.2 Metas

- Cobertura ≥ 80% em `services/` e `api/`.
- Nenhum segredo no repositório (verificação no CI).
- Lint e tipagem sem erros (`ruff`, `black --check`, `mypy`).
- Migrations aplicam e revertem em banco vazio.
- Testes de regressão para os critérios de aceitação da seção 17.
- Teste específico de XSS no renderer Markdown da WebUI.

### 14.3 Pipeline de CI

1. Instalar dependências com versões fixadas.
2. Rodar lint e tipagem.
3. Subir MySQL de teste e aplicar migrations.
4. Rodar testes com cobertura.
5. Validar build do frontend estático (se houver bundler).
6. Publicar artefato ou imagem Docker.

---

## 15. Deploy e operação

### 15.1 Desenvolvimento

```bash
cd backend
cp .env.example .env
docker compose up --build
```

Serviços: `api` (FastAPI + Uvicorn), `mysql`, opcionalmente `ollama` com volume de modelos.

### 15.2 Produção

- API atrás de proxy reverso (Caddy/Nginx) com TLS.
- MySQL gerenciado ou com backup automatizado diário.
- Migrations executadas como etapa de release, antes de subir a nova versão.
- Health checks de liveness e readiness configurados no orquestrador.
- Logs centralizados e alertas para `5xx`, latência e falhas do provedor.
- Segredos em cofre (não em imagem Docker nem no repositório).
- Encerramento gracioso para não cortar streams em andamento.

### 15.3 Custo e hardware

Modelos locais de 1B a 8B rodam em CPU com 16 GB de RAM, porém devagar. Para produção, GPU dedicada costuma custar mais que uma API de nuvem. Recomendação: desenvolver com Ollama local e avaliar nuvem na v1.0.

---

## 16. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Latência alta do modelo local | Experiência ruim | Escolher modelo leve, medir cedo, permitir nuvem por configuração |
| Custo de GPU em produção | Orçamento | Comparar com API de nuvem antes do go-live |
| CORS entre WebUI e Ollama | Bloqueio no MVP local | Servir por HTTP e ajustar `OLLAMA_ORIGINS` |
| Limite do `localStorage` | Perda de histórico local | Limitar conversas, avisar o usuário e migrar para o servidor |
| Migração de histórico local para a API | Complexidade | Opcional na fase 8; não bloqueia a v1.0 |
| Vazamento de chave de IA | Segurança | Chaves somente no backend e em cofre |
| XSS via resposta da IA | Segurança | Renderer escape-first já validado; testes contínuos |
| Rate limit em múltiplas instâncias | Abuso | Redis como backend do limitador |
| Streaming interrompido | Dados parciais | Marcar `incompleta` e persistir o que foi recebido |
| Escopo crescer além do SRS | Atraso | Fases e critérios de saída; mudanças registradas |
| Migrations irreversíveis | Falha de deploy | Revisão e teste de downgrade no CI |

---

## 17. Cronograma resumido

| Semana | Foco | Entregável verificável |
|---|---|---|
| 1 | Fase 0 + início da Fase 2 | API, banco e health no Docker |
| 2 | Fase 2 | Cadastro, login, refresh e perfil |
| 3 | Fase 3 | Chat JSON + SSE com rate limit |
| 4 | Fase 4 | Conversas e mensagens persistidas |
| 5 | Fase 5 | WebUI integrada com login e histórico do servidor |
| 6 | Fase 6 | Administração, auditoria e logs |
| 7 | Fase 7 | Testes, carga, deploy de homologação |
| 8+ | Fase 8 | Nuvem, importação, voz e RAG |

Datas exatas devem ser ajustadas conforme disponibilidade. O cronograma pressupõe uma pessoa em meio período.

---

## 18. Critérios de aceitação

### 18.1 Produto e API

| ID | Critério |
|---|---|
| CA-01 | Visitante consegue cadastrar, entrar e acessar `/users/me` |
| CA-02 | Senhas aparecem somente como hash, nunca em respostas ou logs |
| CA-03 | `POST /chat` com `stream=true` entrega a resposta incrementalmente e termina com `done` |
| CA-04 | `POST /chat` com `stream=false` retorna a resposta completa em JSON |
| CA-05 | Com `conversation_id`, pergunta e resposta aparecem em `/conversations/{id}/messages` |
| CA-06 | Sem `conversation_id`, nada é persistido |
| CA-07 | Usuário não acessa conversas de outro (`404`) |
| CA-08 | Trocar `AI_PROVIDER` não exige mudança em `api/chat.py` |
| CA-09 | Com o Ollama parado, o chat retorna `502`/`504` e o restante continua funcionando |
| CA-10 | Usuário comum recebe `403` em `/admin/*` |
| CA-11 | Usuário desativado perde o acesso imediatamente |
| CA-12 | O último administrador ativo não pode ser removido ou rebaixado |
| CA-13 | O limite de chat retorna `429` com `Retry-After` |
| CA-14 | OpenAPI lista todos os endpoints com exemplos |
| CA-15 | Migrations aplicam e revertem em banco vazio |
| CA-16 | Cobertura ≥ 80% e pipeline de lint/tipagem sem falhas |

### 18.2 WebUI

| ID | Critério |
|---|---|
| WEB-01 | Streaming visível em tempo real, com parar funcionando |
| WEB-02 | Conversas e mensagens sobrevivem à recarga (local ou servidor, conforme o modo) |
| WEB-03 | Markdown e código renderizam sem executar HTML |
| WEB-04 | Troca de modelo e de tema persistem |
| WEB-05 | Ollama/API offline exibe aviso amigável e não quebra a interface |
| WEB-06 | Layout utilizável em desktop, tablet e mobile |
| WEB-07 | Nenhum erro no console nos fluxos principais |

---

## 19. Definição de pronto (DoD)

Uma tarefa só é considerada concluída quando:

- [ ] O comportamento está implementado e coberto por teste automatizado quando aplicável.
- [ ] Lint, tipagem e testes passam localmente e no CI.
- [ ] Erros e estados de carregamento foram tratados na interface.
- [ ] A documentação (OpenAPI, README ou este plano) foi atualizada.
- [ ] Nenhum segredo, token ou dado sensível foi adicionado ao repositório.
- [ ] Migrations (quando houver) são reversíveis.
- [ ] Acessibilidade básica foi verificada (foco, teclado, contraste, rótulos).
- [ ] O critério de saída da fase correspondente foi validado.

---

## 20. Próximos passos imediatos

1. **Criar `backend/`** com FastAPI, `/health`, configuração e Docker Compose.
2. **Subir MySQL** e aplicar a primeira migration com `users` e `refresh_tokens`.
3. **Implementar autenticação** (cadastro, login, refresh e logout) com testes.
4. **Implementar `AIProvider` + `OllamaProvider`** e o `/chat` em JSON e SSE.
5. **Persistir conversas e mensagens** com isolamento por usuário.
6. **Integrar a WebUI** à API, adicionando login e o modo `api`.
7. **Implementar administração e auditoria**.
8. **Fechar qualidade**: cobertura, carga, Docker e homologação.

Sugestão de primeira entrega demonstrável: passos 1 a 4, com um chat autenticado e streaming saindo da API.

---

## 21. Rastreabilidade

| Módulo | Requisitos | Endpoints | Fase |
|---|---|---|---|
| Autenticação | RF-AUT-01 a 10 | `/auth/*` | 2 |
| Perfil | RF-PER-01 a 05 | `/users/me*` | 2 |
| Chat | RF-CHAT-01 a 12 | `/chat` | 3 e 4 |
| Conversas | RF-CONV-01 a 09 | `/conversations*` | 4 |
| Administração | RF-ADM-01 a 12 | `/admin/*` | 6 |
| Sistema | RF-SIS-01 a 04 | `/health*`, `/docs`, `/redoc` | 0 e 7 |
| WebUI | WEB-01 a 07 | Consome a API | 1 e 5 |

---

## 22. Referências

- [`SRS-API-Chat-IA.md`](../../docs/SRS-API-Chat-IA.md) — requisitos completos da API.
- [`levantamento-chat-ia-web.md`](../../docs/levantamento-chat-ia-web.md) — decisões iniciais e stack.
- [`ideia_web_jarvis.md`](../../docs/ideia_web_jarvis.md) — visão de assistente por voz.
- [`README.md`](../README.md) — como executar a WebUI atual.
- Documentação oficial de FastAPI, SQLAlchemy, Alembic, Ollama e RFC 9457.

---

*Este plano deve ser revisado ao final de cada fase. Mudanças de escopo precisam ser registradas com data, motivo e impacto no cronograma.*


