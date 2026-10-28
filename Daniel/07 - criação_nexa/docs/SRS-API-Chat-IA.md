# Especificação de Requisitos de Software (SRS)

## API do Chat de IA via Web

| Campo | Valor |
|---|---|
| **Projeto** | Chat de IA via Web: Backend (API) |
| **Documento** | SRS: Especificação de Requisitos de Software |
| **Versão** | 1.0 (rascunho) |
| **Data** | 26/10/2026 |
| **Padrões de referência** | IEEE Std 830-1998, ISO/IEC/IEEE 29148:2018 |
| **Documento de origem** | `levantamento-chat-ia-web.md` |

### Histórico de revisões

| Versão | Data | Descrição |
|---|---|---|
| 1.0 | 26/10/2026 | Primeira versão do SRS da API |

---

## Sumário

1. [Introdução](#1-introdução)
2. [Descrição geral](#2-descrição-geral)
3. [Requisitos específicos](#3-requisitos-específicos)
   - 3.1 [Interfaces externas](#31-interfaces-externas)
   - 3.2 [Requisitos funcionais](#32-requisitos-funcionais)
   - 3.3 [Requisitos de dados](#33-requisitos-de-dados)
   - 3.4 [Requisitos não funcionais](#34-requisitos-não-funcionais)
   - 3.5 [Regras de negócio](#35-regras-de-negócio)
   - 3.6 [Restrições de projeto](#36-restrições-de-projeto)
   - 3.7 [Catálogo de endpoints](#37-catálogo-de-endpoints)
   - 3.8 [Padrão de erros](#38-padrão-de-erros)
4. [Critérios de aceitação](#4-critérios-de-aceitação)
5. [Apêndices](#5-apêndices)

---

## 1. Introdução

### 1.1 Propósito

Este documento especifica os requisitos da **API de backend** de um sistema de chat de IA via web. Ele se destina a desenvolvedores, testadores e demais envolvidos no projeto, e serve de base para o projeto técnico, a implementação, os testes e a validação da API.

### 1.2 Escopo

O produto especificado é a **API REST** (em Python/FastAPI) que:

- cadastra e autentica usuários;
- gerencia o perfil do usuário;
- recebe perguntas e devolve respostas de um modelo de IA, com **streaming**;
- armazena e consulta o histórico de conversas e mensagens;
- oferece funções administrativas (gestão de usuários e monitoramento);
- abstrai o provedor de IA, de modo que a troca de **modelo local (Ollama)** para **nuvem** seja feita apenas por configuração.

**Fora do escopo deste documento:** o frontend React, a infraestrutura de hospedagem (VPS, Railway, Render etc.), a escolha e o treinamento dos modelos de IA, e o faturamento/cobrança de usuários.

### 1.3 Definições, siglas e abreviações

| Termo | Definição |
|---|---|
| **API** | Interface de programação de aplicações |
| **REST** | Estilo arquitetural para APIs sobre HTTP |
| **SRS** | Software Requirements Specification |
| **JWT** | JSON Web Token, token assinado usado para autenticação |
| **SSE** | Server-Sent Events, fluxo de eventos do servidor para o cliente sobre HTTP |
| **ORM** | Mapeamento objeto-relacional (SQLAlchemy) |
| **Provedor de IA** | Implementação concreta que fala com um modelo (Ollama ou nuvem) |
| **Strategy** | Padrão de projeto que permite trocar algoritmos/implementações via interface comum |
| **Token (IA)** | Unidade de texto processada pelo modelo; base de cobrança em nuvem |
| **Admin** | Usuário com papel administrativo |
| **RF / RNF / RN** | Requisito Funcional / Não Funcional / Regra de Negócio |

**Prioridades (MoSCoW):** **M** = Deve (Must), **S** = Deveria (Should), **C** = Poderia (Could).

### 1.4 Referências

- `levantamento-chat-ia-web.md`: documento de planejamento do projeto.
- IEEE Std 830-1998: *Recommended Practice for Software Requirements Specifications*.
- ISO/IEC/IEEE 29148:2018: *Requirements engineering*.
- RFC 7519 (JWT), RFC 6750 (Bearer Token), RFC 9457 (Problem Details for HTTP APIs).
- Documentação do FastAPI, SQLAlchemy, Alembic e Ollama.

### 1.5 Visão geral do documento

A seção 2 descreve o produto e seu contexto. A seção 3 traz os requisitos detalhados (interfaces, funcionais, dados, não funcionais, regras de negócio e catálogo de endpoints). A seção 4 define os critérios de aceitação e a seção 5 reúne apêndices.

---

## 2. Descrição geral

### 2.1 Perspectiva do produto

A API é o componente central do sistema e fica entre o frontend e os serviços de apoio:

```
[Frontend React] ⇄ [API Python (FastAPI)] ⇄ [MySQL]
                          │
                          └──⇄ [Provedor de IA: Local (Ollama) ou Nuvem (API)]
```

O frontend **nunca** se comunica diretamente com a IA. Somente a API o faz, o que garante: proteção da chave da API de nuvem, controle de login, limites de uso e histórico, e independência do frontend em relação ao modelo usado.

### 2.2 Funções do produto (resumo)

| Módulo | Funções principais |
|---|---|
| **Autenticação** | Cadastro, login, renovação de sessão, logout |
| **Perfil** | Consultar, editar, trocar senha e excluir a própria conta |
| **Chat** | Enviar mensagens e receber resposta completa ou em streaming |
| **Conversas** | Criar, listar, consultar, renomear e excluir conversas; listar mensagens |
| **Administração** | Gerir usuários, consultar estatísticas de uso e status do provedor de IA |
| **Sistema** | Verificação de saúde (health check) e documentação automática |

### 2.3 Classes de usuários e características

| Classe | Descrição | Permissões |
|---|---|---|
| **Visitante** | Não autenticado | Cadastro, login, health check, documentação |
| **Usuário** | Autenticado, papel `user` | Perfil próprio, chat, suas conversas e mensagens |
| **Administrador** | Autenticado, papel `admin` | Tudo do usuário + endpoints `/admin/*` |
| **Cliente de API (frontend)** | Aplicação React que consome a API em nome do usuário | Mesmas permissões do usuário autenticado |

### 2.4 Ambiente operacional

- **Linguagem/runtime:** Python 3.11 ou superior.
- **Framework:** FastAPI (ASGI, executado com Uvicorn).
- **Banco de dados:** MySQL 8.x, com SQLAlchemy (ORM) e Alembic (migrações).
- **IA local:** Ollama (padrão `http://localhost:11434`).
- **IA em nuvem (futuro):** provedor via SDK/HTTP (Anthropic, OpenAI, Google, entre outros).
- **Sistemas operacionais:** Linux (produção); Windows, macOS e Linux (desenvolvimento).

### 2.5 Restrições gerais

- Banco de dados obrigatoriamente **MySQL**.
- Backend obrigatoriamente em **Python/FastAPI**.
- Troca de provedor de IA **somente por variável de ambiente**, sem alteração de código nos endpoints.
- Modelos de IA **não possuem memória**: o contexto é enviado a cada requisição.
- Desempenho da IA local depende do hardware (CPU/GPU/VRAM) disponível.

### 2.6 Premissas e dependências

- O Ollama (ou provedor de nuvem) está instalado, acessível pela rede e com o modelo configurado já baixado.
- O frontend consome a API via HTTPS em produção.
- O frontend envia a **lista completa de mensagens** da conversa a cada requisição de chat (decisão do levantamento).
- O servidor MySQL está disponível e com as migrações aplicadas.
- Em produção, modelo local exige servidor com GPU, o que pode tornar a nuvem mais econômica.

---

## 3. Requisitos específicos

### 3.1 Interfaces externas

#### 3.1.1 Interface com o cliente (API HTTP)

| Aspecto | Especificação |
|---|---|
| Protocolo | HTTP/1.1 ou superior; HTTPS obrigatório em produção |
| Estilo | REST, JSON (`application/json`, UTF-8) |
| Streaming | SSE (`text/event-stream`) no endpoint de chat |
| Autenticação | Header `Authorization: Bearer <token>` |
| Prefixo e versão | `/api/v1` |
| Documentação | OpenAPI/Swagger em `/docs` e ReDoc em `/redoc` |
| Datas e horas | ISO 8601 em UTC (ex.: `2026-10-26T14:30:00Z`) |
| Paginação | Parâmetros `page` (padrão 1) e `page_size` (padrão 20, máx. 100) |

#### 3.1.2 Interface com o banco de dados

- Acesso via SQLAlchemy ao MySQL, com pool de conexões.
- Esquema versionado por Alembic.

#### 3.1.3 Interface com provedores de IA

- Toda comunicação com IA passa pela interface abstrata `AIProvider` (métodos `generate` e `stream`).
- **OllamaProvider:** `POST {OLLAMA_URL}/api/chat` (JSON; streaming por linhas JSON).
- **CloudProvider:** SDK/HTTP do provedor escolhido (implementação futura).
- Formato de mensagens padrão: `[{"role": "user" | "assistant" | "system", "content": "..."}]`.

#### 3.1.4 Interfaces de hardware

Não há interface direta de hardware. O desempenho da IA local depende de CPU (16 GB de RAM para modelos de 1B a 8B parâmetros) e, preferencialmente, de GPU.

#### 3.1.5 Configuração (variáveis de ambiente)

| Variável | Descrição | Exemplo |
|---|---|---|
| `AI_PROVIDER` | Provedor ativo (`ollama` ou `cloud`) | `ollama` |
| `OLLAMA_URL` | URL do servidor Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Modelo local | `llama3.1` |
| `CLOUD_API_KEY` | Chave do provedor de nuvem | (vazio até uso) |
| `CLOUD_MODEL` | Modelo de nuvem | (vazio até uso) |
| `DATABASE_URL` | String de conexão MySQL | `mysql+pymysql://user:pass@host/db` |
| `JWT_SECRET` | Segredo de assinatura do JWT | (valor aleatório forte) |
| `JWT_ALGORITHM` | Algoritmo de assinatura | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Validade do access token | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Validade do refresh token | `7` |
| `CORS_ORIGINS` | Origens permitidas | `http://localhost:5173` |
| `RATE_LIMIT_CHAT_PER_MIN` | Limite de requisições de chat por usuário | `20` |
| `MAX_MESSAGES_PER_REQUEST` | Máx. de mensagens no contexto | `100` |
| `MAX_MESSAGE_CHARS` | Máx. de caracteres por mensagem | `8000` |

---

### 3.2 Requisitos funcionais

#### 3.2.1 Autenticação (RF-AUT)

| ID | Requisito | Prior. |
|---|---|---|
| **RF-AUT-01** | A API deve permitir o **cadastro** de usuário informando `nome`, `email` e `senha`. | M |
| **RF-AUT-02** | O e-mail deve ser único (sem diferenciar maiúsculas/minúsculas) e ter formato válido; em caso de duplicidade, retornar `409 Conflict`. | M |
| **RF-AUT-03** | A senha deve ser armazenada somente como **hash** (`argon2` ou `bcrypt`), nunca em texto puro. | M |
| **RF-AUT-04** | A API deve permitir **login** com `email` e `senha`, retornando um **access token JWT** e seu tempo de expiração. | M |
| **RF-AUT-05** | Credenciais inválidas devem retornar `401 Unauthorized` com mensagem genérica, sem revelar se o e-mail existe. | M |
| **RF-AUT-06** | Usuários desativados (`ativo = false`) não devem conseguir fazer login (`403 Forbidden`). | M |
| **RF-AUT-07** | Todos os endpoints, exceto os públicos (cadastro, login, health, documentação), devem exigir token válido e não expirado. | M |
| **RF-AUT-08** | A API deve emitir **refresh token** e oferecer endpoint para renovar o access token sem novo login. | S |
| **RF-AUT-09** | A API deve oferecer **logout**, invalidando o refresh token do usuário (lista de revogação). | C |
| **RF-AUT-10** | O token JWT deve conter, no mínimo, `sub` (id do usuário), `role`, `iat` e `exp`. | M |

#### 3.2.2 Perfil do usuário (RF-PER)

| ID | Requisito | Prior. |
|---|---|---|
| **RF-PER-01** | A API deve permitir ao usuário **consultar seus próprios dados** (`id`, `nome`, `email`, `role`, `criado_em`), sem nunca expor `senha_hash`. | M |
| **RF-PER-02** | A API deve permitir **editar** `nome` e `email` do próprio perfil, respeitando a unicidade de e-mail. | M |
| **RF-PER-03** | A API deve permitir **trocar a senha**, exigindo a senha atual e uma nova senha válida. | M |
| **RF-PER-04** | A API deve permitir ao usuário **excluir a própria conta**, exigindo confirmação da senha; os dados associados (conversas e mensagens) devem ser removidos em cascata. | S |
| **RF-PER-05** | O usuário não pode alterar o próprio `role` nem o próprio status `ativo`. | M |

#### 3.2.3 Chat (RF-CHAT)

| ID | Requisito | Prior. |
|---|---|---|
| **RF-CHAT-01** | A API deve expor endpoint de chat que recebe a **lista completa de mensagens** (`messages`) da conversa e devolve a resposta do modelo de IA. | M |
| **RF-CHAT-02** | O endpoint deve suportar dois modos, controlados pelo campo `stream` (padrão `true`): **streaming via SSE** e **resposta completa em JSON**. | M |
| **RF-CHAT-03** | No modo streaming, a resposta deve ser enviada em eventos SSE incrementais (pedaços de texto), com evento final de conclusão e evento de erro quando aplicável (ver 3.7.4). | M |
| **RF-CHAT-04** | O endpoint chat deve validar a entrada: `messages` não vazio; cada item com `role` ∈ {`system`, `user`, `assistant`} e `content` não vazio; a última mensagem deve ter `role = user`; respeitar os limites `MAX_MESSAGES_PER_REQUEST` e `MAX_MESSAGE_CHARS`. | M |
| **RF-CHAT-05** | O endpoint de chat não deve conhecer o provedor concreto: deve usar apenas a interface `AIProvider`, obtida via *factory* a partir de `AI_PROVIDER`. | M |
| **RF-CHAT-06** | Se o campo opcional `conversation_id` for informado, a API deve verificar que a conversa pertence ao usuário autenticado e **persistir** a última mensagem do usuário e a resposta completa do assistente após a conclusão da geração. | M |
| **RF-CHAT-07** | Se `conversation_id` não for informado, a requisição deve ser tratada como **efêmera** (nada é persistido). | M |
| **RF-CHAT-08** | Se o cliente interromper a conexão durante o streaming, a API deve cancelar a requisição ao provedor de IA e liberar recursos. A resposta parcial pode ser persistida e marcada como incompleta. | S |
| **RF-CHAT-09** | A API deve aplicar **limite de uso** (rate limit) por usuário no endpoint de chat, retornando `429 Too Many Requests` com `Retry-After`. | M |
| **RF-CHAT-10** | Falhas do provedor de IA (indisponível, timeout, erro de modelo) devem ser tratadas e traduzidas para `502 Bad Gateway` ou `504 Gateway Timeout` (ou evento SSE de erro, se o streaming já iniciou). | M |
| **RF-CHAT-11** | A API deve permitir, opcionalmente, um parâmetro `system_prompt` (ou mensagem `system`) para orientar o comportamento do modelo, conforme política definida em RN-06. | C |
| **RF-CHAT-12** | Ao criar a primeira mensagem de uma conversa sem título, a API deve gerar um título provisório (ex.: primeiros 50 caracteres da pergunta). | S |

#### 3.2.4 Conversas e mensagens (RF-CONV)

| ID | Requisito | Prior. |
|---|---|---|
| **RF-CONV-01** | A API deve permitir **criar** uma conversa (com `titulo` opcional). | M |
| **RF-CONV-02** | A API deve **listar** as conversas do usuário autenticado, ordenadas da mais recente para a mais antiga, com paginação. | M |
| **RF-CONV-03** | A API deve **consultar** uma conversa específica do usuário. | M |
| **RF-CONV-04** | A API deve permitir **renomear** uma conversa (alterar `titulo`). | M |
| **RF-CONV-05** | A API deve permitir **excluir** uma conversa, removendo suas mensagens em cascata. | M |
| **RF-CONV-06** | A API deve **listar as mensagens** de uma conversa em ordem cronológica, com paginação. | M |
| **RF-CONV-07** | Um usuário não pode acessar, alterar ou excluir conversas de outro usuário; o acesso indevido deve retornar `404 Not Found` (para não revelar a existência do recurso). | M |
| **RF-CONV-08** | A listagem de conversas deve aceitar filtro de busca por título (`q`). | C |
| **RF-CONV-09** | A API deve permitir **excluir todas** as conversas do usuário de uma só vez. | C |

#### 3.2.5 Administração (RF-ADM)

| ID | Requisito | Prior. |
|---|---|---|
| **RF-ADM-01** | Todos os endpoints `/admin/*` devem ser acessíveis somente por usuários com `role = admin`; outros recebem `403 Forbidden`. | M |
| **RF-ADM-02** | A API deve permitir ao administrador **listar usuários** com paginação e filtros (`q` por nome/e-mail, `role`, `ativo`). | M |
| **RF-ADM-03** | A API deve permitir **consultar** os dados de um usuário específico. | M |
| **RF-ADM-04** | A API deve permitir **alterar** `nome`, `email`, `role` e `ativo` de qualquer usuário. | M |
| **RF-ADM-05** | A API deve permitir **ativar/desativar** um usuário; usuários desativados perdem acesso (tokens existentes devem ser rejeitados, ver RN-04). | M |
| **RF-ADM-06** | A API deve permitir **excluir** um usuário e seus dados em cascata. | S |
| **RF-ADM-07** | Um administrador não pode excluir nem remover o próprio papel de admin se for o **último administrador ativo** do sistema. | M |
| **RF-ADM-08** | A API deve permitir ao administrador **redefinir a senha** de um usuário (senha temporária ou nova senha informada). | S |
| **RF-ADM-09** | A API deve fornecer **estatísticas de uso**: total de usuários, usuários ativos, total de conversas, total de mensagens e mensagens por período. | S |
| **RF-ADM-10** | A API deve informar o **status do provedor de IA** ativo (nome, modelo configurado e disponibilidade), sem expor chaves ou segredos. | S |
| **RF-ADM-11** | Ações administrativas sensíveis (alteração de papel, desativação, exclusão, redefinição de senha) devem ser registradas em **log de auditoria**. | S |
| **RF-ADM-12** | A API deve permitir ao administrador **criar usuários** diretamente, definindo o papel. | C |

#### 3.2.6 Sistema (RF-SIS)

| ID | Requisito | Prior. |
|---|---|---|
| **RF-SIS-01** | A API deve expor `GET /health` (público) indicando se o serviço está no ar e se o banco responde. | M |
| **RF-SIS-02** | A API deve expor documentação interativa OpenAPI automática. | M |
| **RF-SIS-03** | A API deve incluir um identificador de requisição (`X-Request-ID`) em todas as respostas, para rastreabilidade. | S |
| **RF-SIS-04** | O health check deve poder incluir a disponibilidade do provedor de IA (`GET /health/ready`). | C |

---

### 3.3 Requisitos de dados

#### 3.3.1 Modelo lógico

Além das tabelas previstas no levantamento (`users`, `conversations`, `messages`), este SRS acrescenta as colunas `role`, `ativo` e `atualizado_em` em `users` (necessárias para administração) e as tabelas `refresh_tokens` e `audit_logs`.

**Tabela `users`**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | BIGINT | PK, auto incremento |
| `nome` | VARCHAR(120) | NOT NULL |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE |
| `senha_hash` | VARCHAR(255) | NOT NULL |
| `role` | ENUM(`user`,`admin`) | NOT NULL, padrão `user` |
| `ativo` | BOOLEAN | NOT NULL, padrão `true` |
| `criado_em` | DATETIME | NOT NULL, padrão agora (UTC) |
| `atualizado_em` | DATETIME | NOT NULL, atualizado a cada alteração |

**Tabela `conversations`**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | BIGINT | PK |
| `user_id` | BIGINT | FK → `users.id`, ON DELETE CASCADE, indexado |
| `titulo` | VARCHAR(200) | NOT NULL, padrão "Nova conversa" |
| `criado_em` | DATETIME | NOT NULL |
| `atualizado_em` | DATETIME | NOT NULL |

**Tabela `messages`**

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | BIGINT | PK |
| `conversation_id` | BIGINT | FK → `conversations.id`, ON DELETE CASCADE, indexado |
| `role` | ENUM(`user`,`assistant`) | NOT NULL |
| `conteudo` | MEDIUMTEXT | NOT NULL |
| `incompleta` | BOOLEAN | NOT NULL, padrão `false` (resposta interrompida) |
| `criado_em` | DATETIME | NOT NULL |

**Tabela `refresh_tokens`** (RF-AUT-08/09)

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | BIGINT | PK |
| `user_id` | BIGINT | FK → `users.id`, ON DELETE CASCADE |
| `token_hash` | VARCHAR(255) | NOT NULL, UNIQUE (armazenar apenas o hash) |
| `expira_em` | DATETIME | NOT NULL |
| `revogado` | BOOLEAN | NOT NULL, padrão `false` |
| `criado_em` | DATETIME | NOT NULL |

**Tabela `audit_logs`** (RF-ADM-11)

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | BIGINT | PK |
| `actor_id` | BIGINT | Admin que executou a ação |
| `acao` | VARCHAR(80) | NOT NULL |
| `alvo_tipo` / `alvo_id` | VARCHAR(40) / BIGINT | Recurso afetado |
| `detalhes` | JSON | Opcional (sem dados sensíveis) |
| `criado_em` | DATETIME | NOT NULL |

#### 3.3.2 Requisitos de dados

| ID | Requisito |
|---|---|
| **RD-01** | Todas as alterações de esquema devem ser feitas por **migrações Alembic** versionadas. |
| **RD-02** | A exclusão de usuário deve remover em cascata conversas e mensagens. |
| **RD-03** | Datas devem ser armazenadas em UTC. |
| **RD-04** | O campo `senha_hash` nunca deve ser retornado em nenhuma resposta nem escrito em logs. |
| **RD-05** | O e-mail deve ser normalizado (minúsculas, sem espaços nas pontas) antes de gravar e comparar. |
| **RD-06** | O banco deve usar charset `utf8mb4` para suportar emojis e todos os idiomas. |

---

### 3.4 Requisitos não funcionais

#### 3.4.1 Desempenho

| ID | Requisito |
|---|---|
| **RNF-DES-01** | Endpoints sem IA (auth, perfil, conversas, admin) devem responder em até **300 ms** no percentil 95, em condições normais de carga. |
| **RNF-DES-02** | O overhead da API sobre o provedor de IA no início do streaming deve ser inferior a **200 ms**; o tempo até o primeiro token depende do provedor/hardware. |
| **RNF-DES-03** | A API deve ser assíncrona (`async`) e não bloquear o *event loop* em chamadas de IA ou de rede. |
| **RNF-DES-04** | A API deve suportar no mínimo **50 conexões de streaming simultâneas** em um único nó, limitada pela capacidade do provedor de IA. |
| **RNF-DES-05** | Listagens devem usar paginação e índices em `user_id`, `conversation_id` e `criado_em`. |

#### 3.4.2 Segurança

| ID | Requisito |
|---|---|
| **RNF-SEG-01** | Senhas com hash **argon2** (preferencial) ou **bcrypt**, com *salt* individual. |
| **RNF-SEG-02** | Política de senha: mínimo de 8 caracteres, com ao menos uma letra e um número. |
| **RNF-SEG-03** | Access token com validade curta (padrão 30 min); refresh token com validade configurável e armazenado apenas como hash. |
| **RNF-SEG-04** | Em produção, todo o tráfego deve ocorrer sobre **HTTPS/TLS**. |
| **RNF-SEG-05** | **CORS** restrito às origens configuradas em `CORS_ORIGINS`. |
| **RNF-SEG-06** | Proteção contra força bruta: limite de tentativas de login por IP/e-mail, com bloqueio temporário e resposta `429`. |
| **RNF-SEG-07** | Acesso ao banco exclusivamente por ORM/consultas parametrizadas (prevenção de SQL Injection). |
| **RNF-SEG-08** | Validação rigorosa de entrada com Pydantic; rejeitar campos desconhecidos nos corpos sensíveis. |
| **RNF-SEG-09** | Segredos (`JWT_SECRET`, `CLOUD_API_KEY`, credenciais do banco) somente em variáveis de ambiente ou cofre de segredos; nunca no repositório. |
| **RNF-SEG-10** | A chave da API de nuvem nunca deve ser exposta ao cliente nem aparecer em logs ou respostas. |
| **RNF-SEG-11** | Autorização por recurso: verificação de propriedade em todo acesso a conversas e mensagens. |
| **RNF-SEG-12** | Limite de tamanho do corpo da requisição (padrão 1 MB) para evitar abuso. |
| **RNF-SEG-13** | Cabeçalhos de segurança básicos nas respostas (ex.: `X-Content-Type-Options: nosniff`). |
| **RNF-SEG-14** | O conteúdo gerado pela IA deve ser tratado como dado não confiável; a API não deve executá-lo nem interpretá-lo como instruções. |

#### 3.4.3 Confiabilidade e disponibilidade

| ID | Requisito |
|---|---|
| **RNF-CON-01** | Timeout configurável nas chamadas ao provedor de IA (padrão 120 s para resposta completa); no streaming, sem limite total, mas com detecção de inatividade (padrão 60 s sem dados). |
| **RNF-CON-02** | Falhas do provedor de IA não devem derrubar a API nem afetar endpoints que não dependem dela. |
| **RNF-CON-03** | Transações de banco devem garantir consistência (ex.: gravar mensagem do usuário e do assistente de forma atômica ao final da geração). |
| **RNF-CON-04** | Disponibilidade-alvo de **99%** mensal para a API (excluindo indisponibilidade do provedor de IA). |
| **RNF-CON-05** | Encerramento gracioso (*graceful shutdown*): permitir a conclusão de requisições em andamento antes de parar. |

#### 3.4.4 Manutenibilidade e extensibilidade

| ID | Requisito |
|---|---|
| **RNF-MAN-01** | Adoção do padrão **Strategy** para provedores de IA: interface `AIProvider` com `generate` e `stream`; implementações `OllamaProvider` e `CloudProvider`; escolha via `factory.py`. |
| **RNF-MAN-02** | Adicionar um novo provedor de IA deve exigir apenas: nova classe que implemente `AIProvider`, novo ramo na *factory* e novas variáveis no `.env`. |
| **RNF-MAN-03** | Estrutura modular do projeto: `api/` (rotas), `core/` (segurança), `db/` (modelos e sessão), `ai/` (provedores), `config.py` (configuração). |
| **RNF-MAN-04** | Cobertura mínima de testes automatizados de **80%** nas camadas de serviço e rotas. |
| **RNF-MAN-05** | Código aderente à PEP 8, com *linter* e formatador (ex.: Ruff/Black) e tipagem estática (mypy) no CI. |
| **RNF-MAN-06** | Dependências com versões fixadas em `requirements.txt`. |

#### 3.4.5 Portabilidade

| ID | Requisito |
|---|---|
| **RNF-POR-01** | A API deve poder ser executada em contêiner (Docker) e fornecer `Dockerfile` e `docker-compose` (API + MySQL) para desenvolvimento. |
| **RNF-POR-02** | Toda configuração deve vir de variáveis de ambiente (12-factor app). |

#### 3.4.6 Observabilidade

| ID | Requisito |
|---|---|
| **RNF-OBS-01** | Logs estruturados (JSON) com nível, data/hora, `request_id`, rota, status e latência. |
| **RNF-OBS-02** | Logs não devem conter senhas, tokens, chaves de API nem o conteúdo integral das mensagens (apenas metadados, salvo modo de depuração explícito). |
| **RNF-OBS-03** | Registro de métricas por requisição de chat: provedor, modelo, duração e, quando disponível, quantidade de tokens. |

#### 3.4.7 Usabilidade da API

| ID | Requisito |
|---|---|
| **RNF-USA-01** | Respostas de erro padronizadas e legíveis (ver 3.8). |
| **RNF-USA-02** | Nomes de recursos e campos consistentes; campos de domínio em português conforme o modelo de dados (`nome`, `titulo`, `conteudo`, `criado_em`). |
| **RNF-USA-03** | Documentação OpenAPI com descrição e exemplos para todos os endpoints. |

---

### 3.5 Regras de negócio

| ID | Regra |
|---|---|
| **RN-01** | O e-mail identifica unicamente o usuário. |
| **RN-02** | Todo usuário novo é criado com `role = user` e `ativo = true`; somente um administrador pode conceder o papel `admin`. |
| **RN-03** | O primeiro administrador é criado por *seed*/script de inicialização (variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD`), não por cadastro público. |
| **RN-04** | Usuário desativado ou excluído tem o acesso bloqueado imediatamente: a cada requisição autenticada a API verifica o status do usuário (ou consulta lista de revogação). |
| **RN-05** | Cada conversa pertence a exatamente um usuário; mensagens pertencem a uma única conversa. |
| **RN-06** | Mensagens com `role = system` enviadas pelo cliente são aceitas somente se a política da instalação permitir (configurável); caso contrário, são ignoradas ou rejeitadas com `422`. Um *system prompt* padrão do servidor pode ser prefixado ao contexto. |
| **RN-07** | O modelo de IA não possui memória; o contexto que o cliente envia é encaminhado integralmente ao provedor (após validação e limites). |
| **RN-08** | A persistência no chat ocorre somente quando `conversation_id` é informado (RF-CHAT-06/07). |
| **RN-09** | O histórico persistido é a fonte para consulta posterior (`GET /conversations/{id}/messages`); o cliente é responsável por reenviar o contexto desejado ao usar o chat. |
| **RN-10** | Deve existir ao menos um administrador ativo em todos os momentos (RF-ADM-07). |
| **RN-11** | Excluir um usuário ou conversa é uma operação **definitiva** (sem lixeira nesta versão). |
| **RN-12** | O limite de uso por usuário (RF-CHAT-09) é contado por janela deslizante de 1 minuto. |

---

### 3.6 Restrições de projeto

| ID | Restrição |
|---|---|
| **RP-01** | Linguagem Python; framework FastAPI. |
| **RP-02** | Persistência em MySQL com SQLAlchemy e Alembic. |
| **RP-03** | Autenticação baseada em JWT (`PyJWT` ou `python-jose`), com suporte nativo OAuth2 do FastAPI. |
| **RP-04** | Comunicação com Ollama via `httpx` ou biblioteca `ollama`. |
| **RP-05** | Streaming de respostas via SSE com `StreamingResponse`. |
| **RP-06** | Padrão Strategy obrigatório para provedores de IA (RNF-MAN-01). |
| **RP-07** | A troca de provedor de IA deve ocorrer **apenas** pela variável `AI_PROVIDER` (e variáveis correlatas). |

---

### 3.7 Catálogo de endpoints

Prefixo comum: `/api/v1`. **Auth:** 🔓 público · 🔐 usuário autenticado · 🛡️ somente admin.

#### 3.7.1 Autenticação

| Método | Rota | Auth | Descrição | Requisitos |
|---|---|---|---|---|
| POST | `/auth/register` | 🔓 | Cadastra usuário | RF-AUT-01 a 03 |
| POST | `/auth/login` | 🔓 | Autentica e retorna tokens | RF-AUT-04 a 06, 10 |
| POST | `/auth/refresh` | 🔓 | Renova o access token com refresh token | RF-AUT-08 |
| POST | `/auth/logout` | 🔐 | Revoga o refresh token | RF-AUT-09 |

#### 3.7.2 Perfil

| Método | Rota | Auth | Descrição | Requisitos |
|---|---|---|---|---|
| GET | `/users/me` | 🔐 | Dados do próprio perfil | RF-PER-01 |
| PATCH | `/users/me` | 🔐 | Edita nome/e-mail | RF-PER-02, 05 |
| POST | `/users/me/password` | 🔐 | Troca a senha | RF-PER-03 |
| DELETE | `/users/me` | 🔐 | Exclui a própria conta | RF-PER-04 |

#### 3.7.3 Conversas e mensagens

| Método | Rota | Auth | Descrição | Requisitos |
|---|---|---|---|---|
| POST | `/conversations` | 🔐 | Cria conversa | RF-CONV-01 |
| GET | `/conversations` | 🔐 | Lista conversas (paginação, filtro `q`) | RF-CONV-02, 08 |
| GET | `/conversations/{id}` | 🔐 | Consulta conversa | RF-CONV-03, 07 |
| PATCH | `/conversations/{id}` | 🔐 | Renomeia conversa | RF-CONV-04, 07 |
| DELETE | `/conversations/{id}` | 🔐 | Exclui conversa | RF-CONV-05, 07 |
| DELETE | `/conversations` | 🔐 | Exclui todas as conversas do usuário | RF-CONV-09 |
| GET | `/conversations/{id}/messages` | 🔐 | Lista mensagens | RF-CONV-06, 07 |

#### 3.7.4 Chat

| Método | Rota | Auth | Descrição | Requisitos |
|---|---|---|---|---|
| POST | `/chat` | 🔐 | Envia mensagens e recebe a resposta (JSON ou SSE) | RF-CHAT-01 a 12 |

**Corpo da requisição**

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

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `messages` | array | Sim | Lista completa do contexto; a última deve ser `role = user` |
| `conversation_id` | inteiro | Não | Se informado, persiste a pergunta e a resposta nessa conversa |
| `stream` | booleano | Não | `true` (padrão): SSE; `false`: JSON completo |

**Resposta com `stream = false` (`200 OK`)**

```json
{
  "message": {"role": "assistant", "content": "SSE é ..."},
  "conversation_id": 42,
  "provider": "ollama",
  "model": "llama3.1"
}
```

**Resposta com `stream = true` (`200 OK`, `text/event-stream`)**

Cada pedaço é enviado como JSON dentro de `data:`. Isso evita quebras de protocolo quando o texto contém novas linhas, uma melhoria em relação ao esboço do levantamento (`data: {chunk}`).

```
data: {"content": "SSE é "}

data: {"content": "um mecanismo ..."}

event: done
data: {"conversation_id": 42, "message_id": 311}

```

Em caso de falha após o início do fluxo:

```
event: error
data: {"code": "ai_provider_unavailable", "detail": "O provedor de IA não respondeu."}

```

#### 3.7.5 Administração

| Método | Rota | Auth | Descrição | Requisitos |
|---|---|---|---|---|
| GET | `/admin/users` | 🛡️ | Lista usuários (paginação, filtros) | RF-ADM-02 |
| POST | `/admin/users` | 🛡️ | Cria usuário com papel definido | RF-ADM-12 |
| GET | `/admin/users/{id}` | 🛡️ | Consulta usuário | RF-ADM-03 |
| PATCH | `/admin/users/{id}` | 🛡️ | Altera nome, e-mail, papel, status | RF-ADM-04, 05, 07 |
| POST | `/admin/users/{id}/reset-password` | 🛡️ | Redefine senha | RF-ADM-08 |
| DELETE | `/admin/users/{id}` | 🛡️ | Exclui usuário | RF-ADM-06, 07 |
| GET | `/admin/stats` | 🛡️ | Estatísticas de uso | RF-ADM-09 |
| GET | `/admin/ai/status` | 🛡️ | Status do provedor de IA | RF-ADM-10 |
| GET | `/admin/audit-logs` | 🛡️ | Consulta o log de auditoria | RF-ADM-11 |

#### 3.7.6 Sistema

| Método | Rota | Auth | Descrição | Requisitos |
|---|---|---|---|---|
| GET | `/health` | 🔓 | Saúde da API e do banco | RF-SIS-01 |
| GET | `/health/ready` | 🔓 | Prontidão (inclui provedor de IA) | RF-SIS-04 |
| GET | `/docs`, `/redoc` | 🔓 | Documentação OpenAPI | RF-SIS-02 |

> `/health` e `/docs` ficam fora do prefixo `/api/v1`.

---

### 3.8 Padrão de erros

Os erros seguem uma estrutura inspirada na RFC 9457 (Problem Details):

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

Para erros de validação (`422`), incluir o campo `errors` com a lista de campos inválidos e motivos.

| HTTP | Quando ocorre | Exemplo de `code` |
|---|---|---|
| 400 | Requisição malformada | `bad_request` |
| 401 | Token ausente/inválido/expirado; credenciais inválidas | `invalid_credentials`, `token_expired` |
| 403 | Sem permissão (não admin, usuário desativado) | `forbidden`, `user_inactive` |
| 404 | Recurso inexistente ou de outro usuário | `not_found` |
| 409 | Conflito (e-mail duplicado, último admin) | `email_already_registered`, `last_admin` |
| 413 | Corpo acima do limite | `payload_too_large` |
| 422 | Falha de validação | `validation_error` |
| 429 | Limite de uso excedido | `rate_limited` |
| 500 | Erro interno | `internal_error` |
| 502 | Erro retornado pelo provedor de IA | `ai_provider_error` |
| 504 | Timeout do provedor de IA | `ai_provider_timeout` |

---

## 4. Critérios de aceitação

A API será considerada aceita quando:

| ID | Critério |
|---|---|
| **CA-01** | Um visitante consegue se cadastrar, fazer login e acessar `/users/me` com o token recebido. |
| **CA-02** | Senhas aparecem apenas como hash no banco e nunca em respostas ou logs. |
| **CA-03** | `POST /chat` com `stream = true` entrega a resposta incrementalmente e finaliza com o evento `done`. |
| **CA-04** | `POST /chat` com `stream = false` retorna a resposta completa em JSON. |
| **CA-05** | Com `conversation_id`, a pergunta e a resposta ficam salvas e aparecem em `GET /conversations/{id}/messages`. |
| **CA-06** | Sem `conversation_id`, nenhuma mensagem é persistida. |
| **CA-07** | Um usuário não consegue ler, editar ou excluir conversas de outro (resposta `404`). |
| **CA-08** | Trocar `AI_PROVIDER` (`ollama` → `cloud`, após implementar o `CloudProvider`) não exige nenhuma alteração em `api/chat.py`. |
| **CA-09** | Com o Ollama parado, `POST /chat` retorna `502`/`504` (ou evento `error`), e os demais endpoints continuam funcionando. |
| **CA-10** | Usuário comum recebe `403` em qualquer `/admin/*`; admin gerencia usuários com sucesso. |
| **CA-11** | Usuário desativado pelo admin perde o acesso imediatamente. |
| **CA-12** | A API impede a exclusão/rebaixamento do último administrador ativo. |
| **CA-13** | O limite de uso do chat é aplicado e retorna `429` com `Retry-After`. |
| **CA-14** | A documentação OpenAPI lista todos os endpoints com exemplos. |
| **CA-15** | Todas as migrações Alembic aplicam e revertem sem erro em banco vazio. |
| **CA-16** | Cobertura de testes automatizados ≥ 80% e pipeline de lint/tipagem sem falhas. |

---

## 5. Apêndices

### 5.1 Itens fora do escopo (versão 1.0)

- Frontend React e seus requisitos.
- Cobrança, planos pagos e controle de custo por tokens.
- Verificação de e-mail e recuperação de senha por e-mail ("esqueci minha senha").
- Login social (Google, GitHub etc.) e autenticação multifator.
- Upload de arquivos/imagens e RAG (busca em documentos).
- Lixeira/restauração de conversas excluídas.
- Compartilhamento de conversas entre usuários.
- Implementação efetiva do `CloudProvider` (somente o contrato e o esqueleto estão no escopo).

### 5.2 Decisões e premissas adotadas neste SRS

| # | Decisão | Motivo |
|---|---|---|
| 1 | Escopo da API inclui cadastro, login, chat, histórico, perfil e administração. | Definido pelo solicitante. |
| 2 | O `/chat` recebe a **lista completa de mensagens** do cliente. | Definido pelo solicitante (conforme o levantamento). |
| 3 | A persistência no chat é opcional e controlada por `conversation_id`. | Compatibiliza o contexto enviado pelo cliente com o salvamento de histórico previsto no levantamento. |
| 4 | Eventos SSE carregam JSON em `data:`. | Evita problemas com quebras de linha no texto. |
| 5 | Inclusão de `role`, `ativo`, `atualizado_em` em `users`, e das tabelas `refresh_tokens` e `audit_logs`. | Necessárias para administração, sessões renováveis e auditoria. |
| 6 | Valores numéricos (limites, prazos, metas de desempenho) são padrões iniciais e configuráveis. | Devem ser validados com testes reais, sobretudo com IA local. |

### 5.3 Pontos em aberto

| # | Questão | Impacto |
|---|---|---|
| 1 | Qual o modelo e o hardware finais da IA local? | Define metas realistas de latência e concorrência (RNF-DES-02/04). |
| 2 | Cadastro público será aberto ou por convite/aprovação? | Afeta RF-AUT-01 e a carga de administração. |
| 3 | Mensagens `system` do cliente serão permitidas? | Define RN-06 e RF-CHAT-11. |
| 4 | Qual a política de retenção de dados e conformidade com a **LGPD** (exportação e exclusão de dados)? | Pode exigir novos endpoints e prazos de retenção. |
| 5 | Haverá limite diário/mensal de mensagens além do limite por minuto? | Pode exigir tabela de uso e novas regras de negócio. |

### 5.4 Resumo de rastreabilidade (módulo → endpoints)

| Módulo | Requisitos | Endpoints |
|---|---|---|
| Autenticação | RF-AUT-01 a 10 | `/auth/*` |
| Perfil | RF-PER-01 a 05 | `/users/me*` |
| Chat | RF-CHAT-01 a 12 | `/chat` |
| Conversas | RF-CONV-01 a 09 | `/conversations*` |
| Administração | RF-ADM-01 a 12 | `/admin/*` |
| Sistema | RF-SIS-01 a 04 | `/health*`, `/docs`, `/redoc` |
