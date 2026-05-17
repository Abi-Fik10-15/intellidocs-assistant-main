# DocuMind (IntelliDocs Assistant)

AI-powered document Q&A: upload PDFs, TXT, or Markdown, then chat with grounded answers and citations. Built with **Next.js 15**, **Express**, **PostgreSQL + pgvector**, and a **provider-agnostic LLM gateway** (OpenAI, Claude, Gemini).

---

## Features

- **Document upload & ingestion** — chunking, embedding, and vector indexing
- **Semantic search** — pgvector similarity over document chunks
- **Agentic chat** — tool calling (`search_documents`, `summarize_document`, `extract_entities`)
- **Citations** — answers link back to document name and chunk
- **Multi-provider LLM** — switch via `LLM_PROVIDER` without changing app code
- **Responsive UI** — closable, resizable sidebar; mobile-friendly layout
- **Optional n8n** — webhooks on ingest and chat completion

---

## Architecture

### System overview

DocuMind is a **three-tier** application: a Next.js client, an Express API, and PostgreSQL with vector search. LLM vendors are accessed only through an internal **gateway + provider** layer so chat and embeddings can switch providers via configuration.

```mermaid
flowchart TB
  subgraph client [Client Tier — Port 3000]
    Browser[Browser]
    Next[Next.js App Router]
    Store[Zustand Store]
    Browser --> Next
    Next --> Store
  end

  subgraph api [API Tier — Port 4000]
    Routes[Express Routes]
    Controllers[Controllers]
    Services[Domain Services]
    LLM[LLM Gateway + Factory]
    Routes --> Controllers
    Controllers --> Services
    Services --> LLM
  end

  subgraph persistence [Persistence Tier]
    PG[(PostgreSQL 16)]
    Vec[pgvector extension]
    Disk[File uploads]
    PG --- Vec
  end

  subgraph external [External Services]
    OAI[OpenAI API]
    ANT[Anthropic API]
    GEM[Google Gemini API]
    N8N[n8n webhooks optional]
  end

  Next -->|HTTP rewrite /api/*| Routes
  Services --> PG
  Services --> Disk
  LLM --> OAI
  LLM --> ANT
  LLM --> GEM
  Services -.-> N8N
```

### Document ingestion flow

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant API as Express API
  participant Ing as Ingestion Service
  participant Emb as Embedding Service
  participant DB as PostgreSQL

  U->>FE: Upload PDF / TXT / MD
  FE->>API: POST /api/upload
  API->>DB: Insert document pending
  API-->>FE: document id + status
  API->>Ing: ingestDocument async
  Ing->>Ing: Extract text, chunk
  Ing->>Emb: embedTexts batches
  Emb->>DB: Store chunks + vectors
  Ing->>DB: status = ready
  FE->>API: Poll GET /api/documents/:id
  API-->>FE: status ready
```

### Chat / RAG flow

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant API as Express API
  participant Agent as Agent Service
  participant Ret as Retrieval Service
  participant GW as LLM Gateway
  participant DB as PostgreSQL

  U->>FE: Send message
  FE->>API: POST /api/chat
  Agent->>Ret: Semantic search query
  Ret->>Emb: Query embedding
  Ret->>DB: pgvector similarity top-K
  Ret-->>Agent: Context + citations
  Agent->>GW: generateResponse + tools
  GW-->>Agent: Answer or tool_calls
  opt Tool execution
    Agent->>Agent: search / summarize / entities
    Agent->>GW: Follow-up generation
  end
  Agent->>DB: Save messages
  API-->>FE: answer + citations
```

### Backend layering

| Layer | Responsibility | Key paths |
|-------|----------------|-----------|
| **Routes** | HTTP mapping, validation middleware | `backend/src/routes/` |
| **Controllers** | Request/response, status codes | `backend/src/controllers/` |
| **Services** | Business logic, orchestration | `backend/src/services/` |
| **Repositories** | SQL / pgvector queries | `backend/src/repositories/` |
| **LLM module** | Provider abstraction | `backend/src/services/llm/` |

### Data model (simplified)

```mermaid
erDiagram
  documents ||--o{ chunks : contains
  conversations ||--o{ messages : contains

  documents {
    uuid id PK
    string name
    string status
    string file_path
    vector embedding_on_chunks
  }

  chunks {
    uuid id PK
    uuid document_id FK
    text content
    int chunk_index
    vector embedding
  }

  conversations {
    uuid id PK
    string title
  }

  messages {
    uuid id PK
    uuid conversation_id FK
    string role
    text content
    jsonb citations
  }
```

Vectors live on **chunks** (1536 dimensions by default). Semantic search compares the query embedding to chunk embeddings with cosine distance (`<=>`).

---

## Design decisions

### Why separate frontend and backend?

- **Clear boundaries** — UI concerns (layout, streaming display, sidebar state) stay in Next.js; data and AI logic stay in Express.
- **Independent scaling** — API and workers can be deployed without rebuilding the static/SSR frontend.
- **API-first** — The same REST API can serve the web app, mobile clients, or automation (n8n) later.

The frontend talks to the API through **Next.js rewrites** (`/api/*` → `localhost:4000`), so the browser uses same-origin requests and avoids CORS setup in development.

### Why PostgreSQL + pgvector (not a dedicated vector DB)?

- **Single database** for documents, chunks, conversations, and vectors — simpler ops for a course/side project.
- **pgvector** is mature enough for moderate corpus sizes and top-K retrieval.
- **Transactional consistency** — deleting a document removes chunks and files in one logical flow.

Trade-off: at very large scale, a dedicated vector store (Pinecone, Qdrant) may outperform pgvector; the repository layer could be swapped without changing the agent.

### LLM gateway and provider pattern

**Problem:** OpenAI, Claude, and Gemini have different SDKs, message formats, and tool-calling shapes.

**Solution:**

1. Define `ILLMProvider` with `generateResponse`, `createEmbedding`, `callTools`.
2. Implement one adapter per vendor under `services/llm/providers/`.
3. Register providers in `factory.ts` keyed by `LLM_PROVIDER`.
4. Expose a single `LLMGateway` for logging, timeouts, quota fallback, and normalized errors.

**Benefit:** Switching `LLM_PROVIDER=gemini` in `.env` requires **no changes** to `agent.service.ts` or controllers.

`EMBEDDING_PROVIDER` is separate so chat and embeddings can use different vendors (e.g. Gemini chat + Gemini embeddings, or mock embeddings for local dev).

### Agent with tools vs. single-shot RAG

**Initial retrieval** injects top-K chunks into the prompt. The **agent** can additionally call:

| Tool | When to use |
|------|-------------|
| `search_documents` | Open-ended questions, comparisons, quotes |
| `summarize_document` | Full-document summary by name or `latest` |
| `extract_entities` | Structured extraction from one file |

Tool arguments accept **UUID or filename**; a resolver maps names to documents so the model is not required to expose IDs to users.

### Chunking strategy

- Token-based chunks with **overlap** (`CHUNK_SIZE_TOKENS`, `CHUNK_OVERLAP_TOKENS`) to preserve context across boundaries.
- One embedding per chunk; retrieval returns the best matching chunks, not whole files.

### Frontend state (Zustand)

- **Client-only** chat UI — conversations and document list live in memory with optional sidebar width persisted to `localStorage`.
- **Server is source of truth** for documents and chat persistence; `AppBootstrap` reloads documents on mount.
- Keeps components simple without Redux boilerplate for this app size.

### UI / UX choices

- **Resizable sidebar** — long PDF filenames wrap instead of truncating; width persisted locally.
- **Mobile drawer** — sidebar overlays on small screens; always visible on desktop.
- **Quick-action cards** — prompts use real uploaded filenames, disabled until at least one document is `ready`.
- **Typing effect** on answers — simulates streaming while the API returns a full response (gateway is streaming-ready for future SSE).

### Optional n8n integration

Webhooks fire on document ingest and chat completion so external workflows (notifications, CRM, logging) can run without coupling logic into the core app.

### What we intentionally did not do (yet)

- **SSE streaming** from LLM to browser (architecture supports it; UI uses simulated token display).
- **Auth / multi-tenancy** — single-user local deployment assumed.
- **OAuth for LLM keys** — keys are server-side env vars only.

---

## Tech stack

| Layer | Technologies |
|--------|----------------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand |
| **Backend** | Node.js, Express, TypeScript, Zod |
| **Database** | PostgreSQL 16, pgvector |
| **AI** | OpenAI SDK, Anthropic SDK, Google GenAI |
| **Infra** | Docker Compose (frontend, backend, Postgres, n8n) |

---

## Project structure

```
intellidocs-assistant-main/
├── app/                    # Next.js App Router (layout, page, globals)
├── components/             # UI (chat, sidebar, upload, settings)
├── lib/                    # API client, utilities
├── store/                  # Zustand chat/document state
├── hooks/                  # Media query, persisted sidebar
├── backend/
│   ├── src/
│   │   ├── app.ts          # Express app
│   │   ├── server.ts       # Entry point
│   │   ├── config/         # Environment (Zod)
│   │   ├── controllers/    # HTTP handlers
│   │   ├── services/
│   │   │   ├── llm/        # Gateway, factory, providers
│   │   │   ├── agent/      # Chat + tools
│   │   │   ├── embeddings/
│   │   │   ├── ingestion/
│   │   │   └── retrieval/
│   │   ├── repositories/   # DB access
│   │   └── db/             # Schema + migrations
│   ├── docker-compose.yml
│   └── .env.example
├── next.config.ts          # API rewrites → backend :4000
└── package.json
```

---

## Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| **Node.js** | 20 LTS or newer |
| **npm** | 9+ |
| **Docker Desktop** | Recommended for Postgres + optional full stack |
| **LLM API key** | At least one: [OpenAI](https://platform.openai.com/), [Anthropic](https://console.anthropic.com/), or [Google AI](https://ai.google.dev/) |

**Ports used locally:**

| Port | Service |
|------|---------|
| 3000 | Next.js frontend |
| 4000 | Express API |
| 5432 | PostgreSQL |
| 5678 | n8n (optional) |

---

## Setup

### Step 1 — Clone and install dependencies

```bash
cd intellidocs-assistant-main

# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

### Step 2 — Start PostgreSQL

From `backend/`:

```bash
docker compose up postgres -d
```

Wait until healthy (`docker compose ps`). Default credentials match `.env.example`:

`postgresql://postgres:postgres@localhost:5432/intellidocs`

Apply schema:

```bash
cd backend
npm run db:migrate
```

### Step 3 — Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`. Example configurations:

**OpenAI (chat + embeddings):**

```env
LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

**Gemini (common when OpenAI quota is limited):**

```env
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
```

**Local dev without embedding API calls:**

```env
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=mock
GEMINI_API_KEY=...
```

> After changing `EMBEDDING_PROVIDER`, **re-upload** documents so vectors are regenerated with the same provider.

### Step 4 — Start the backend

```bash
cd backend
npm run dev
```

Verify:

```bash
curl http://localhost:4000/api/health
```

Expected: JSON with `"success": true`.

### Step 5 — Start the frontend

In a **second terminal**, from the project root:

```bash
npm run dev
```

Or, if Next.js cache errors appear (`Cannot find module './611.js'`):

```bash
npm run dev:clean
```

Open **http://localhost:3000**.

### Step 6 — Smoke test

1. Upload a small PDF or `.txt` file in the sidebar.
2. Wait until status shows **ready** (green).
3. Click **Summarize my latest PDF** or type a question.
4. Confirm the answer includes content from your file.

### Setup with Docker (full stack — one command)

From the **project root** (not `backend/`):

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — add GEMINI_API_KEY and/or OPENAI_API_KEY, set LLM_PROVIDER
docker compose up --build
```

| Service | URL |
|---------|-----|
| **App (frontend)** | http://localhost:3000 |
| API | http://localhost:4000 |
| PostgreSQL | localhost:5432 |
| n8n | http://localhost:5678 |

Services started: `postgres` → `backend` (migrates DB on boot) → `frontend` → `n8n-workflow`.

You can also run from `backend/` (same stack):

```bash
cd backend
cp .env.example .env
docker compose up --build
```

Stop everything: `docker compose down` (add `-v` to remove volumes).

### Windows notes

- If port 3000 is stuck: `Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- Use `npm run dev:clean` after large frontend refactors to avoid stale `.next` chunks.
- Next.js `experimental.devtoolSegmentExplorer: false` is set in `next.config.ts` to reduce dev errors on Windows.

---

## Environment variables

Copy `backend/.env.example` to `backend/.env`.

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `LLM_PROVIDER` | `openai` \| `claude` \| `gemini` — chat model provider |
| `EMBEDDING_PROVIDER` | `openai` \| `gemini` \| `mock` — vector embeddings (`mock` = local dev, no API) |
| `OPENAI_API_KEY` | Required when using OpenAI for chat and/or embeddings |
| `ANTHROPIC_API_KEY` | Required when `LLM_PROVIDER=claude` |
| `GEMINI_API_KEY` | Required when `LLM_PROVIDER=gemini` or `EMBEDDING_PROVIDER=gemini` |
| `LLM_REQUEST_TIMEOUT_MS` | LLM call timeout (default `120000`) |
| `RETRIEVAL_TOP_K` | Chunks returned per search (default `5`) |
| `UPLOAD_DIR` | Uploaded file storage path |
| `N8N_WEBHOOK_URL` | Optional automation webhook |

**Tip:** If OpenAI chat hits quota, use `LLM_PROVIDER=gemini` with a valid `GEMINI_API_KEY`. Keep embedding and chat providers aligned when re-indexing documents.

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/upload` | Upload document (multipart `file`) |
| `GET` | `/api/documents` | List documents |
| `GET` | `/api/documents/:id` | Document status |
| `DELETE` | `/api/documents/:id` | Delete document + chunks + file |
| `POST` | `/api/documents/:id/reingest` | Re-process document |
| `POST` | `/api/chat` | Chat (`message`, optional `conversationId`, `documentIds`) |
| `GET` | `/api/conversations` | List conversations |
| `GET` | `/api/conversations/:id` | Conversation with messages |

---

## LLM gateway

Business logic talks only to **`LLMGateway`** — not vendor SDKs directly.

```
backend/src/services/llm/
├── providers/          # openai, claude, gemini adapters
├── gateway.ts          # Logging, timeouts, errors
├── factory.ts          # Reads LLM_PROVIDER from env
└── index.ts
```

Switch providers by changing `.env`:

```env
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini
```

Restart the backend after changes.

---

## Usage

1. Upload a **PDF**, **TXT**, or **Markdown** file in the sidebar.
2. Wait until status is **ready** (ingestion + embedding).
3. Ask a question or use a quick-action card (summarize, compare, quotes, brief).
4. Review answers and **citations** in the chat.

---

## Scripts

### Frontend (project root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run dev:clean` | Clear `.next` cache, then dev |
| `npm run build` | Production build |
| `npm run start` | Run production server |

### Backend (`backend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled API |
| `npm run db:migrate` | Apply `schema.sql` |

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| `Cannot find module './611.js'` | Run `npm run dev:clean` in the frontend root |
| `429` quota errors | Change provider in `.env`, enable billing, or use `EMBEDDING_PROVIDER=mock` for local dev |
| Chat before documents ready | Wait for sidebar status **ready** |
| Empty / wrong search results | Re-upload after changing `EMBEDDING_PROVIDER` (vectors must match) |
| Port 3000 in use | Stop `npm run dev` or run `FRONTEND_PORT=3002 docker compose up --build` and open http://localhost:3002 |
| Docker frontend won't start (port bind) | Same as above — only one process can use port 3000 |
| Backend connection failed | Ensure API is on port 4000 and Postgres is running |

---

## Security notes

- Do **not** commit `backend/.env` or API keys.
- Rotate keys if they were exposed in logs or chat.
- Use strong Postgres credentials in production.

---

## License

Private / educational use unless otherwise specified by the repository owner.
