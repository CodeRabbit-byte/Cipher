# CIPHER

A capture-first engagement workspace for freelance pentesters and small security consultancies. Designed to stay out of your way while you work — quick observation capture, smart tool ingest, AI-assisted reporting, and a rich forum for detailing findings, all stored locally on your machine.

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
- [Data & Privacy](#data--privacy)
- [Collaborators](#collaborators)

---

## Features

### Observation Capture
Quick-capture raw notes as you test. Press `Ctrl+K` to focus the input from anywhere in the capture view. Each observation is stored as-is — no forced structure. When you're ready, promote observations to confirmed findings or archive them. The **Closing View** activates within 48 hours of an engagement deadline and groups untriaged observations by similarity to your confirmed findings, so nothing slips through.

### Tool Ingest
Import findings directly from your tools:

| Tool | Format | How to export |
|---|---|---|
| Burp Suite | XML | Scanner → Issues → Save selected items |
| nmap | XML | `nmap -oX output.xml <target>` |
| Nuclei | JSONL | `nuclei -o output.jsonl -json <target>` |
| Nessus | `.nessus` | Export → Nessus format |
| Metasploit | XML | `db_export -f xml /path/to/export.xml` |

Every import goes through a **deduplication pass** — incoming findings are compared to your existing ones using cosine similarity and a vulnerability alias dictionary (e.g. "SQL injection" → "sqli"). Potential duplicates are shown side-by-side and you choose: merge, keep both, or mark as distinct. Nothing is automatic.

### Finding Management
Full CRUD over confirmed findings with severity (`critical` / `high` / `medium` / `low` / `info`), CVSS score, host/port, evidence, remediation notes, and CVE IDs. Chain related findings together to model attack paths — the chain is fed directly into the AI summary prompt.

### Finding Library
Cross-engagement search over every confirmed finding you've ever captured. Filter by severity, CVE, host pattern, or keyword. Use any finding as a template to pre-fill a new finding form.

### Whiteboard
A per-engagement freeform canvas for planning attack paths, mapping scope, or sketching out chains before findings are confirmed. Accessible from the sidebar under **Whiteboard** (engagement picker) or directly from any engagement overview.

### Generating Forum
A split-panel workspace for deepening your analysis of any engagement.

**Left panel — Context sidebar:**  
Lists all observations (with status badges) and findings (with severity badges) for the engagement. Click any item to toggle it into AI context — highlighted with a blue left border. Selected count shown at the bottom.

**Right panel — two tabs:**

- **AI Chat** — Streaming AI assistant with awareness of your selected context items. Asks about attack chains, gaps in coverage, risk narratives, or anything else. Supports quick-prompt buttons when the chat is empty. Context chips above the input show exactly what's in scope, each removable with ×.
- **Notes** — Full rich-text editor (Tiptap) with a formatting toolbar: Undo/Redo, H1/H2/H3, Bold, Italic, Underline, Strikethrough, Bullet list, Ordered list, Blockquote, Inline code, Code block, Image upload, and Horizontal rule. **Auto-saves** 1.5 s after the last keystroke with a "Saved" indicator. Images are uploaded via `POST /api/upload` and stored in `public/uploads/`. Notes persist across sessions (stored per-engagement in the database).

### AI Executive Summaries
Generates a prose executive summary fed by your client brief, confirmed findings, finding chains, and a user-defined house style. Streams into a Tiptap rich-text editor for inline editing before export. Supports multiple AI providers — or disable entirely and write manually.

### Report Export
Export the edited summary as a PDF directly from the browser.

### Theme Customisation
Change the app's colour scheme from the **Appearance** button in the sidebar footer.

- **7 built-in presets:** Default (blue), Crimson, Ocean, Forest, Violet, Ember, Rose
- **Image extraction:** Upload any image and the app samples the dominant hue from it and applies it as the theme — subtle tinting on surfaces only, similar to WhatsApp's wallpaper tinting
- **Light / Dark mode toggle** — persists across sessions, flash-free (inline script in `<head>` applies the stored mode before first paint)

### Engagement Lifecycle
Track engagements through `active` → `closing` → `complete`. View a per-engagement findings distribution chart. The closing workflow flags when you're approaching deadline.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) + @tailwindcss/typography |
| Database | SQLite via Prisma ORM |
| Auth | NextAuth.js v5 (credentials + JWT) |
| State | Zustand + TanStack Query |
| AI | Vercel AI SDK v6 (multi-provider, streaming) |
| Rich Text | Tiptap (ProseMirror) — StarterKit + Image + Underline |
| PDF | @react-pdf/renderer |
| Validation | Zod |

---

## Prerequisites

- Node.js 18+
- No other global dependencies required

---

## Setup

```bash
git clone https://github.com/CodeRabbit-byte/Cipher.git
cd Cipher
cp .env.example .env
```

Edit `.env` — at minimum set `NEXTAUTH_SECRET`. Add an AI key to enable forum chat and executive summary generation (see [AI Provider Setup](#ai-provider-setup)).

```bash
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register an account to get started.

> The dev server binds to `127.0.0.1` only — it is not accessible on the network.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (localhost only) |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | Yes | Random secret for JWT signing. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Full URL of your instance (e.g. `http://localhost:3000`) |
| `DATABASE_URL` | Yes | SQLite path — default: `file:./prisma/data/cipher.db` |
| `AI_PROVIDER` | No | Active AI provider: `anthropic` \| `openai` \| `gemini` \| `mistral` \| `groq` |
| `ANTHROPIC_API_KEY` | No | Required if `AI_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | No | Required if `AI_PROVIDER=openai` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Required if `AI_PROVIDER=gemini` |
| `MISTRAL_API_KEY` | No | Required if `AI_PROVIDER=mistral` |
| `GROQ_API_KEY` | No | Required if `AI_PROVIDER=groq` |

Leaving all AI keys blank disables the AI forum chat and executive summary features. All other features work without it.

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
│   ├── (app)/                              # Authenticated app shell
│   │   ├── dashboard/                      # Home dashboard
│   │   ├── engagements/
│   │   │   ├── new/                        # Create engagement
│   │   │   └── [id]/
│   │   │       ├── page.tsx                # Engagement overview + nav cards
│   │   │       ├── capture/                # Observation entry
│   │   │       ├── findings/               # Finding editor
│   │   │       ├── ingest/                 # Tool import
│   │   │       ├── report/                 # Report + PDF export
│   │   │       ├── whiteboard/             # Freeform canvas
│   │   │       ├── forum/                  # AI chat + Notes editor
│   │   │       └── closing/                # Pre-deadline triage
│   │   ├── whiteboard/                     # Engagement picker → whiteboard
│   │   ├── forum/                          # Engagement picker → forum
│   │   └── library/                        # Cross-engagement finding search
│   ├── api/
│   │   ├── auth/                           # register + [...nextauth]
│   │   ├── engagements/                    # CRUD + forum-notes
│   │   ├── observations/                   # CRUD
│   │   ├── findings/                       # CRUD + chain links
│   │   ├── ingest/                         # burp | nmap | nuclei | nessus | metasploit
│   │   ├── upload/                         # Image upload for forum notes
│   │   └── ai/
│   │       ├── draft-summary/              # Executive summary generation
│   │       └── forum/                      # Streaming forum AI chat
│   ├── login/
│   └── register/
├── components/
│   ├── ui/                                 # shadcn/ui primitives
│   ├── capture/                            # Observation feed + promote dialog
│   ├── findings/                           # Finding cards, chain map, library search
│   ├── ingest/                             # Dropzone + deduplication dialog
│   ├── report/                             # Summary editor + PDF export
│   ├── closing/                            # Pre-closing triage view
│   ├── whiteboard/                         # Canvas component
│   ├── forum/
│   │   ├── ForumPage.tsx                   # Split-panel layout + tab switcher
│   │   └── ForumNotes.tsx                  # Tiptap rich-text notes editor
│   └── theme/
│       ├── ThemeCustomizer.tsx             # Appearance dialog (presets + image upload)
│       └── ThemeProvider.tsx               # Applies stored theme on mount
├── lib/
│   ├── ai/
│   │   ├── provider.ts                     # Multi-provider LLM abstraction
│   │   └── prompts/
│   │       └── executive-summary.ts        # Prompt builder
│   ├── parsers/
│   │   ├── burp.ts
│   │   ├── nmap.ts
│   │   ├── nuclei.ts
│   │   ├── nessus.ts
│   │   └── metasploit.ts
│   ├── dedup/
│   │   └── findings.ts                     # Cosine similarity + alias dedup
│   ├── theme.ts                            # Theme presets, CSS var application, image hue extraction
│   ├── db.ts                               # Prisma client singleton
│   └── utils.ts                            # cn() helper
├── types/
│   └── index.ts                            # Shared TypeScript types
└── auth.ts                                 # NextAuth config
prisma/
├── schema.prisma                           # Database schema
└── data/
    ├── cipher.db                           # SQLite database (gitignored)
public/
└── uploads/                                # Forum note images (gitignored)
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
| `houseStyle` | String? | House style guide fed into AI summary prompt |

### Engagement
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `name` | String | Engagement label |
| `clientName` | String | Client organisation |
| `clientBrief` | String? | Context/background for AI prompts |
| `scope` | String? | Detailed scope definition |
| `startDate` | DateTime | Defaults to creation date |
| `endDate` | DateTime? | Deadline — triggers closing workflow when <48 h away |
| `status` | String | `active` \| `closing` \| `complete` |
| `forumNotes` | String? | Tiptap JSON — persisted rich-text notes from the forum Notes tab |

### Observation
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `content` | String | Raw note text |
| `source` | String | `manual` \| `burp` \| `nmap` \| `nuclei` \| `nessus` \| `metasploit` |
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
| `remediationNote` | String? | Fix recommendation |
| `cveIds` | String? | Comma-separated CVE IDs |
| `source` | String | Origin: `manual` or tool name |
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
| GET | `/api/engagements/[id]/forum-notes` | Get rich-text notes for engagement |
| POST | `/api/engagements/[id]/forum-notes` | Save rich-text notes (Tiptap JSON) |

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
| POST | `/api/ingest/metasploit` | Parse Metasploit `db_export -f xml` |

All ingest endpoints return `{ findings: ParsedFinding[], parseWarnings: string[] }`.

### Upload
| Method | Path | Description |
|---|---|---|
| POST | `/api/upload` | Upload an image (JPEG/PNG/GIF/WebP/SVG, max 10 MB). Returns `{ url: string }`. |

### AI
| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/draft-summary` | Generate AI executive summary (non-streaming) |
| POST | `/api/ai/forum` | Streaming AI forum chat with engagement context |

**`/api/ai/draft-summary`** body: `{ engagementId: string, findingChain?: { from, to, explanation }[] }`  
Returns `{ text: string }`. Returns 503 if no AI provider is configured.

**`/api/ai/forum`** body: `{ engagementId: string, messages: { role, content }[], contextItems: ContextItem[] }`  
Returns a streaming text response. The system prompt is built server-side with selected observations/findings injected as context.

---

## Data & Privacy

- **Database:** SQLite at `prisma/data/cipher.db` — local only, never leaves your machine
- **Uploaded images:** `public/uploads/` — stored on disk, gitignored
- **No cloud sync:** everything stays on disk unless you deploy to a remote host
- **Dev server:** bound to `127.0.0.1` — not exposed on the local network

---

## Collaborators

- [Coderabbit-byte](https://github.com/CodeRabbit-byte)
