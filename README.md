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
- [ThreatAssessor Integration](#threatassessor-integration)
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

### Threat Model Ingest (ThreatAssessor)
Upload a Mermaid architecture diagram (`.mmd`) and let [ThreatAssessor](https://github.com/BerdTan/ThreatAssessor) map the attack surface before testing begins.

**How it works:**
1. Select a Singapore Government **SSP profile** (Low Risk Cloud, Medium Risk Cloud, High Risk Cloud, On-Premises, Generative AI, Digital Services, or Sandbox) and a run mode (Fast or Full)
2. Upload your `.mmd` architecture diagram — CIPHER proxies it to ThreatAssessor's `/api/v1/analyze` endpoint
3. ThreatAssessor returns structured predictions: MITRE ATT&CK technique IDs, mitigations, SSP control references, confidence scores, and attack paths
4. Predictions come through the same **deduplication dialog** as all other tools — you review each one before it is stored
5. Approved predictions are stored as **Observations** (source: `threatassessor`, status: `raw`) — not promoted Findings. The pentester tests each predicted path and promotes or archives each individually

**Coverage score:** The Closing View shows a coverage bar: confirmed findings ÷ total TA predictions. Green ≥ 70 %, amber 40–69 %, red < 40 %. Each predicted observation is listed as Confirmed / Not Tested / Archived with its MITRE ID annotation.

**AI enhancement:** When TA predictions are present, the executive summary and purple team analyses automatically include:
- MITRE ATT&CK chain (technique IDs resolved to names)
- SSP compliance gaps (unaddressed L0 mandatory controls)
- Coverage delta (predicted vs confirmed)
- MoE orchestrator context for red-team: blindspots, contradictions, confidence cascade, Red Team roadmap

**Requirements:** ThreatAssessor running at `THREATASSESSOR_URL` with a valid `THREATASSESSOR_API_KEY`. See [ThreatAssessor Integration](#threatassessor-integration) for setup.

### Finding Management
Full CRUD over confirmed findings with severity (`critical` / `high` / `medium` / `low` / `info`), CVSS score, host/port, evidence, remediation notes, and CVE IDs. Chain related findings together to model attack paths — the chain is fed directly into the AI summary prompt.

Findings sourced from ThreatAssessor carry additional badges:
- **MITRE ATT&CK badges** (purple) — technique IDs (e.g. `T1566.001`)
- **SSP control badges** — colour-coded by level: red (L0 Cardinal — mandatory), amber (L1 Basic Hygiene — recommended), grey (L2 Best Practice)
- **TA confidence pill** — green ≥ 80 %, amber ≥ 60 %, red < 60 %
- **Attack path** shown in the expanded card view

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

When ThreatAssessor data is present, the prompt is automatically enriched with the MITRE attack chain, SSP compliance gaps, and coverage score. Each TA API call runs with a 5 s timeout and falls back silently — generation is never blocked by TA unavailability.

### Purple Team Analysis
Red team and blue team AI analysis accessible from the Report page.

- **Red team:** Gets MoE orchestrator context — confidence cascade, blindspots, contradictions, and the Red Team roadmap predicted by ThreatAssessor. Helps identify what the model considered high-risk but was not yet tested.
- **Blue team:** Gets SSP L0 unaddressed controls — the mandatory controls that have no confirmed finding associated, surfacing compliance gaps for the defensive brief.

### Report Export
Export the edited summary as a PDF directly from the browser.

### Closing View
Pre-deadline triage activated within 48 hours of the engagement end date.

When ThreatAssessor data is present, a **coverage section** appears at the top:
- **Coverage bar** shows confirmed ÷ total TA-predicted paths (green / amber / red)
- Three columns: **Confirmed** (promoted to finding), **Not Tested** (still raw), **Archived** (ruled out)
- Each entry shows the MITRE ID and attack path for quick reference

Below the coverage section, untriaged observations are grouped by similarity to confirmed findings as usual.

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
- ThreatAssessor (optional) — Python FastAPI service for threat modelling. See [ThreatAssessor Integration](#threatassessor-integration).

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
| `THREATASSESSOR_URL` | No | Base URL of ThreatAssessor (e.g. `http://localhost:8000`). Required to enable Threat Model tab. |
| `THREATASSESSOR_API_KEY` | No | API key for ThreatAssessor. Required to enable Threat Model tab. Server-side only — never exposed to the browser. |

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

## ThreatAssessor Integration

CIPHER integrates with [ThreatAssessor](https://github.com/BerdTan/ThreatAssessor) — an AI-powered threat modelling engine that maps attack surfaces from architecture diagrams.

### How the integration works

```
Architecture diagram (.mmd)
         │
         ▼
CIPHER /api/ingest/threatassessor
         │  (proxies to TA with 125 s timeout)
         ▼
ThreatAssessor /api/v1/analyze
         │
         ├── ground_truth.json  ← primary structured data
         └── 07_moe_orchestrator.json  ← MoE consensus (blindspots, confidence, roadmap)
         │
         ▼
Deduplication dialog (same as all other tools)
         │
         ▼
Observations stored with source="threatassessor"
  ├── mitreIds        (comma-separated: T1566.001, T1190, …)
  ├── mitreMitigations (comma-separated: M1015, M1049, …)
  ├── sspControls     (comma-separated: RA-L0-C1, AC-L1-C2, …)
  ├── taConfidence    (0.0–1.0)
  └── attackPath      (human-readable chain)
         │
         ▼ pentester tests during engagement
         │
         ▼
Promote → Finding  (inherits all TA fields)
Archive → ruled out
Leave   → Not Tested (counted in coverage gap)
```

### SSP Profiles

The Singapore Government [Instruction Manual 8 (IM8)](https://www.mha.gov.sg/) defines security requirements for government systems. CIPHER maps TA predictions to IM8 controls via seven SSP profiles:

| Profile key | Description |
|---|---|
| `low_risk_cloud` | Low Risk Cloud |
| `medium_risk_cloud` | Medium Risk Cloud |
| `high_risk_cloud` | High Risk Cloud |
| `on_premises` | On-Premises |
| `generative_ai` | Generative AI |
| `digital_services` | Digital Services |
| `sandbox` | Sandbox |

Controls are classified at three levels:

| Level | Meaning |
|---|---|
| **L0** | Cardinal — mandatory, cannot defer without executive sign-off |
| **L1** | Basic Hygiene — strongly recommended |
| **L2** | Best Practice — risk-accepted deferral possible |

### Setup

1. Clone and start ThreatAssessor:
   ```bash
   git clone https://github.com/BerdTan/ThreatAssessor
   cd ThreatAssessor
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

2. In CIPHER's `.env`:
   ```
   THREATASSESSOR_URL=http://localhost:8000
   THREATASSESSOR_API_KEY=your_key_here
   ```

3. Run `npx prisma db push` to apply the schema additions (new fields on Engagement, Finding, and Observation).

4. Restart CIPHER. The **Threat Model** tab appears in Ingest when both env vars are set.

### Verifying field names

ThreatAssessor's `ground_truth.json` field names should be verified against a live instance before production use. Look for `// TODO-FIELDNAME` comments in [src/lib/parsers/threatassessor.ts](src/lib/parsers/threatassessor.ts) — these mark inferred field names that must be confirmed by running:

```bash
curl -s -X POST http://localhost:8000/api/v1/analyze \
  -H "TM-API-KEY: $THREATASSESSOR_API_KEY" \
  -F "architecture_file=@path/to/web_app.mmd" \
  | python3 -m json.tool
```

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
│   │   │       ├── ingest/                 # Tool import (Security Tools + Threat Model tabs)
│   │   │       ├── report/                 # Report + PDF export + Purple Team
│   │   │       ├── whiteboard/             # Freeform canvas
│   │   │       ├── forum/                  # AI chat + Notes editor
│   │   │       └── closing/                # Pre-deadline triage + TA coverage score
│   │   ├── whiteboard/                     # Engagement picker → whiteboard
│   │   ├── forum/                          # Engagement picker → forum
│   │   └── library/                        # Cross-engagement finding search
│   ├── api/
│   │   ├── auth/                           # register + [...nextauth]
│   │   ├── engagements/                    # CRUD + forum-notes
│   │   ├── observations/                   # CRUD
│   │   ├── findings/                       # CRUD + chain links
│   │   ├── ingest/
│   │   │   ├── burp/                       # Burp Suite XML
│   │   │   ├── nmap/                       # nmap XML
│   │   │   ├── nuclei/                     # Nuclei JSONL
│   │   │   ├── nessus/                     # Nessus .nessus
│   │   │   ├── metasploit/                 # Metasploit XML
│   │   │   └── threatassessor/             # ThreatAssessor .mmd proxy
│   │   │       └── configured/             # GET — returns { configured: boolean }
│   │   ├── upload/                         # Image upload for forum notes
│   │   └── ai/
│   │       ├── draft-summary/              # Executive summary generation (async, TA-aware)
│   │       ├── purple-team/                # Purple team streaming (TA-aware)
│   │       └── forum/                      # Streaming forum AI chat
│   ├── login/
│   └── register/
├── components/
│   ├── ui/                                 # shadcn/ui primitives
│   ├── capture/                            # Observation feed + promote dialog
│   ├── findings/                           # Finding cards (MITRE/SSP/confidence badges), chain map, library search
│   ├── ingest/                             # Dropzone + deduplication dialog + Threat Model tab
│   ├── report/                             # Summary editor + PDF export
│   ├── closing/                            # Pre-closing triage view + TA coverage bar
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
│   │       ├── executive-summary.ts        # Async prompt builder (MITRE chain, SSP gaps, coverage delta)
│   │       └── purple-team.ts              # Async prompt builder (MoE context red / SSP gaps blue)
│   ├── parsers/
│   │   ├── burp.ts
│   │   ├── nmap.ts
│   │   ├── nuclei.ts
│   │   ├── nessus.ts
│   │   ├── metasploit.ts
│   │   └── threatassessor.ts               # ThreatAssessor ground_truth + MoE orchestrator parser
│   ├── agents/
│   │   └── tools.ts                        # Agentic tool definitions (promote, create finding, etc.)
│   ├── dedup/
│   │   └── findings.ts                     # Cosine similarity + alias dedup
│   ├── theme.ts                            # Theme presets, CSS var application, image hue extraction
│   ├── db.ts                               # Prisma client singleton
│   └── utils.ts                            # cn() helper
├── types/
│   └── index.ts                            # Shared TypeScript types (SspProfile, TA fields, IngestSource)
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
| `sspProfile` | String? | ThreatAssessor SSP profile used for this engagement |
| `architectureName` | String? | Name of the architecture diagram uploaded to ThreatAssessor |
| `threatModelRunAt` | DateTime? | When the last ThreatAssessor run completed |

### Observation
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `content` | String | Raw note text |
| `source` | String | `manual` \| `burp` \| `nmap` \| `nuclei` \| `nessus` \| `metasploit` \| `threatassessor` |
| `host` | String? | Target host |
| `status` | String | `raw` \| `promoted` \| `archived` |
| `findingId` | String? | Set when promoted to a finding |
| `mitreIds` | String? | Comma-separated MITRE ATT&CK technique IDs (TA observations only) |
| `mitreMitigations` | String? | Comma-separated MITRE mitigation IDs (TA observations only) |
| `sspControls` | String? | Comma-separated SSP control references (TA observations only) |
| `taConfidence` | Float? | ThreatAssessor prediction confidence 0.0–1.0 (TA observations only) |
| `attackPath` | String? | Human-readable attack path (TA observations only) |

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
| `mitreIds` | String? | Inherited from TA observation on promotion |
| `mitreMitigations` | String? | Inherited from TA observation on promotion |
| `sspControls` | String? | Inherited from TA observation on promotion |
| `taConfidence` | Float? | Inherited from TA observation on promotion |
| `attackPath` | String? | Inherited from TA observation on promotion |

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
| POST | `/api/findings` | Create finding (auto-inherits TA fields if `observationIds` provided) |
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
| POST | `/api/ingest/threatassessor` | Proxy `.mmd` to ThreatAssessor, parse predictions |
| GET | `/api/ingest/threatassessor/configured` | Returns `{ configured: boolean }` — used by UI to show/hide the Threat Model tab |

All ingest endpoints return `{ findings: ParsedFinding[], parseWarnings: string[] }`.

`/api/ingest/threatassessor` accepts `multipart/form-data`:
- `file` — `.mmd` Mermaid diagram (max 10 MB)
- `engagementId` — CUID of the target engagement
- `sspProfile` — one of the seven SSP profile keys
- `mode` — `fast` or `full`

### Upload
| Method | Path | Description |
|---|---|---|
| POST | `/api/upload` | Upload an image (JPEG/PNG/GIF/WebP/SVG, max 10 MB). Returns `{ url: string }`. |

### AI
| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/draft-summary` | Generate AI executive summary (non-streaming, TA-enriched) |
| POST | `/api/ai/purple-team` | Streaming purple team analysis (red/blue, TA-enriched) |
| POST | `/api/ai/forum` | Streaming AI forum chat with engagement context |

**`/api/ai/draft-summary`** body: `{ engagementId: string, findingChain?: { from, to, explanation }[] }`  
Returns `{ text: string }`. Returns 503 if no AI provider is configured. Appends MITRE chain, SSP compliance gaps, and coverage delta when ThreatAssessor data is present.

**`/api/ai/purple-team`** body: `{ engagementId: string, perspective: "red" | "blue", findingChain?: { from, to, explanation }[] }`  
Returns a streaming text response. Red perspective includes MoE orchestrator context (blindspots, confidence cascade, Red Team roadmap). Blue perspective includes unaddressed SSP L0 controls.

**`/api/ai/forum`** body: `{ engagementId: string, messages: { role, content }[], contextItems: ContextItem[] }`  
Returns a streaming text response. The system prompt is built server-side with selected observations/findings injected as context.

---

## Data & Privacy

- **Database:** SQLite at `prisma/data/cipher.db` — local only, never leaves your machine
- **Uploaded images:** `public/uploads/` — stored on disk, gitignored
- **No cloud sync:** everything stays on disk unless you deploy to a remote host
- **Dev server:** bound to `127.0.0.1` — not exposed on the local network
- **ThreatAssessor keys:** `THREATASSESSOR_URL` and `THREATASSESSOR_API_KEY` are server-side only — never prefixed with `NEXT_PUBLIC_`, never returned in any API response, never logged

---

## Collaborators

- [Coderabbit-byte](https://github.com/CodeRabbit-byte)
- [BerdTan](https://github.com/BerdTan) — ThreatAssessor integration
