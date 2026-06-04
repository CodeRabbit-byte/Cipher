# CIPHER

A capture-first engagement workspace for freelance pentesters and small security consultancies. Designed to stay out of your way while you work — quick observation capture, smart tool ingest, and AI-assisted reporting, all stored locally on your machine.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [AI Provider Setup](#ai-provider-setup)
- [Project Structure](#project-structure)
- [Data Models](#data-models)
- [API Reference](#api-reference)
- [Collaborators](#collaborators)

---

## Features

### Observation Capture
Quick-capture raw notes as you test. Press `Ctrl+K` to focus the input from anywhere in the capture view. Each observation is stored as-is — no forced structure. When you're ready, promote observations to confirmed findings or archive them. The **Closing View** activates within 48 hours of an engagement deadline and groups untriaged observations by similarity to your confirmed findings, so nothing slips through.

### Tool Ingest
Import findings directly from your tools:

| Tool | Format |
|---|---|
| Burp Suite | XML export (Scanner issues) |
| nmap | XML (`-oX` flag) |
| Nuclei | JSONL (stdout redirect) |
| Nessus | `.nessus` export file |

Every import goes through a **deduplication pass** — incoming findings are compared to your existing ones using cosine similarity and a vulnerability alias dictionary (e.g. "SQL injection" → "sqli"). Potential duplicates are shown side-by-side and you choose: merge, keep both, or mark as distinct. Nothing is automatic.

### Finding Management
Full CRUD over confirmed findings with severity (`critical` / `high` / `medium` / `low` / `info`), CVSS score, host/port, evidence, remediation notes, and CVE IDs. Chain related findings together to model attack paths — the chain is fed directly into the AI summary prompt.

### Finding Library
Cross-engagement search over every confirmed finding you've ever captured. Filter by severity, CVE, host pattern, or keyword. Use any finding as a template to pre-fill a new finding form.

### AI Executive Summaries
Generates a prose executive summary fed by your client brief, confirmed findings, finding chains, and a user-defined house style. Streams into a **Tiptap** rich-text editor for inline editing before export. Supports multiple AI providers — or disable entirely and write manually.

### Report Export
Export the edited summary as a PDF directly from the browser.

### Engagement Lifecycle
Track engagements through `active` → `closing` → `complete`. View a per-engagement findings distribution chart. The closing workflow flags when you're approaching deadline.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Database | SQLite via Prisma ORM |
| Auth | NextAuth.js v5 (credentials + JWT) |
| State | Zustand + TanStack Query |
| AI | Vercel AI SDK (multi-provider) |
| Rich Text | Tiptap (ProseMirror) |
| PDF | @react-pdf/renderer |
| Validation | Zod |

---

## Prerequisites

- Node.js 18+
- No other global dependencies required

---

## Setup

```bash
git clone <repo>
cd cipher
cp .env.example .env
```

Edit `.env` — at minimum, set `NEXTAUTH_SECRET`. Add an AI key if you want the executive summary feature (see below).

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register an account to get started.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | Yes | Random secret for JWT signing. Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full URL of your instance (e.g. `http://localhost:3000`) |
| `DATABASE_URL` | Yes | SQLite path — default: `file:./data/cipher.db` |
| `AI_PROVIDER` | No | Active AI provider: `anthropic` \| `openai` \| `gemini` \| `mistral` \| `groq` |
| `ANTHROPIC_API_KEY` | No | Required if `AI_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | No | Required if `AI_PROVIDER=openai` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Required if `AI_PROVIDER=gemini` |
| `MISTRAL_API_KEY` | No | Required if `AI_PROVIDER=mistral` |
| `GROQ_API_KEY` | No | Required if `AI_PROVIDER=groq` |

Leaving all AI keys blank disables the executive summary feature. All other features work without it.

---

## AI Provider Setup

Set `AI_PROVIDER` in `.env` to one of the values below, then add the corresponding API key:

| Provider | Model | `AI_PROVIDER` value | Free tier |
|---|---|---|---|
| Anthropic | Claude Sonnet 4 | `anthropic` | No |
| OpenAI | GPT-4o | `openai` | No |
| Google | Gemini 1.5 Flash | `gemini` | Yes |
| Mistral | Mistral (latest) | `mistral` | No |
| Groq | Llama 3.3 | `groq` | Yes (rate-limited) |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                        # Authenticated app shell
│   │   ├── dashboard/                # Home dashboard
│   │   ├── engagements/
│   │   │   ├── new/                  # Create engagement
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Engagement overview
│   │   │       ├── capture/          # Observation entry
│   │   │       ├── findings/         # Finding editor
│   │   │       ├── ingest/           # Tool import
│   │   │       ├── report/           # Report + PDF export
│   │   │       └── closing/          # Pre-deadline triage
│   │   └── library/                  # Cross-engagement finding search
│   ├── api/
│   │   ├── auth/                     # register + [...nextauth]
│   │   ├── engagements/              # CRUD
│   │   ├── observations/             # CRUD
│   │   ├── findings/                 # CRUD + chain links
│   │   ├── ingest/                   # burp | nmap | nuclei | nessus
│   │   └── ai/draft-summary/         # AI executive summary generation
│   ├── login/
│   └── register/
├── components/
│   ├── ui/                           # shadcn/ui primitives
│   ├── capture/                      # Observation feed + promote dialog
│   ├── findings/                     # Finding cards, chain map, library search
│   ├── ingest/                       # Dropzone + deduplication dialog
│   ├── report/                       # Summary editor + PDF export
│   └── closing/                      # Pre-closing triage view
├── lib/
│   ├── ai/
│   │   ├── provider.ts               # Multi-provider LLM abstraction
│   │   └── prompts/
│   │       └── executive-summary.ts  # Prompt builder
│   ├── parsers/
│   │   ├── burp.ts
│   │   ├── nmap.ts
│   │   ├── nuclei.ts
│   │   └── nessus.ts
│   ├── dedup/
│   │   └── findings.ts               # Cosine similarity + alias dedup
│   ├── db.ts                         # Prisma client singleton
│   └── utils.ts                      # cn() helper
├── types/
│   └── index.ts                      # Shared TypeScript types
└── auth.ts                           # NextAuth config
prisma/
└── schema.prisma                     # Database schema
data/
├── cipher.db                         # SQLite database (gitignored)
└── uploads/                          # Evidence file storage (gitignored)
```

---

## Data Models

### User
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `email` | String | Unique |
| `password` | String | bcrypt hash |
| `name` | String? | Optional display name |
| `houseStyle` | String? | House style guide for AI summaries |

### Engagement
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `name` | String | Engagement label |
| `clientName` | String | Client organisation |
| `clientBrief` | String? | Context/background for AI prompts |
| `scope` | String? | Detailed scope definition |
| `startDate` | DateTime | Defaults to creation date |
| `endDate` | DateTime? | Deadline — triggers closing workflow when <48h away |
| `status` | String | `active` \| `closing` \| `complete` |

### Observation
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `content` | String | Raw note text (max 10,000 chars) |
| `source` | String | `manual` \| `burp` \| `nmap` \| `nuclei` \| `nessus` |
| `host` | String? | Target host |
| `status` | String | `raw` \| `promoted` \| `archived` |
| `findingId` | String? | Set when promoted to a finding |

### Finding
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `title` | String | Max 500 chars |
| `description` | String | Full write-up |
| `severity` | String | `critical` \| `high` \| `medium` \| `low` \| `info` |
| `cvss` | Float? | CVSS score (0–10) |
| `host` | String? | Affected host/IP |
| `port` | Int? | Affected port (1–65535) |
| `evidence` | String? | Max 5,000 chars |
| `remediationNote` | String? | Fix recommendation, max 5,000 chars |
| `cveIds` | String? | Comma-separated CVE IDs |
| `source` | String | Origin (manual or tool name) |
| `chainedWith` | Finding[] | Self-referencing many:many for attack chains |

---

## API Reference

All endpoints require an authenticated session except `/api/auth/*`.

### Engagements
| Method | Path | Description |
|---|---|---|
| GET | `/api/engagements` | List all engagements |
| POST | `/api/engagements` | Create engagement |
| GET | `/api/engagements/[id]` | Get engagement |
| PATCH | `/api/engagements/[id]` | Update engagement |
| DELETE | `/api/engagements/[id]` | Delete engagement |

### Observations
| Method | Path | Description |
|---|---|---|
| POST | `/api/observations` | Create observation |
| PATCH | `/api/observations/[id]` | Update status / link to finding |
| DELETE | `/api/observations/[id]` | Delete observation |

### Findings
| Method | Path | Description |
|---|---|---|
| GET | `/api/findings?engagementId=` | List findings (scoped or global library) |
| POST | `/api/findings` | Create finding |
| PATCH | `/api/findings/[id]` | Update finding / set chain links |
| DELETE | `/api/findings/[id]` | Delete finding |

### Ingest
| Method | Path | Description |
|---|---|---|
| POST | `/api/ingest/burp` | Parse Burp Suite XML |
| POST | `/api/ingest/nmap` | Parse nmap XML (`-oX` output) |
| POST | `/api/ingest/nuclei` | Parse Nuclei JSONL |
| POST | `/api/ingest/nessus` | Parse Nessus `.nessus` export |

All ingest endpoints return `{ findings: ParsedFinding[], parseWarnings: string[] }`.

### AI
| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/draft-summary` | Generate AI executive summary |

Request body: `{ engagementId: string, findingChain?: { from, to, explanation }[] }`
Returns `{ text: string }`. Returns 503 if no AI provider is configured.

---

## Data

- **Database:** SQLite at `data/cipher.db` — local only, never leaves your machine
- **Uploads:** `data/uploads/` — evidence files, gitignored
- **No cloud sync:** everything stays on disk

---

## Collaborators

- [Coderabbit-byte](https://github.com/CodeRabbit-byte)
