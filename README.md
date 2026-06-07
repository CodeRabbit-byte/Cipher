# CIPHER

A capture-first engagement workspace for freelance pentesters and small security consultancies. Designed to stay out of your way while you work — quick observation capture, smart tool ingest, AI-assisted reporting, a rich forum for detailing findings, native threat modelling, and a full CVE database — all stored locally on your machine.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [AI Provider Setup](#ai-provider-setup)
- [ThreatAssessor Integration](#threatassessor-integration)
- [CVE Database](#cve-database)
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

### Threat Assessor
A native threat modelling engine built directly into CIPHER — no second server, no iframe. Upload a Mermaid architecture diagram (`.mmd`) and CIPHER runs [ThreatAssessor](https://github.com/BerdTan/ThreatAssessor) as a local Python subprocess to produce a structured threat assessment.

**How it works:**
1. Select a Singapore Government **SSP profile** and upload a `.mmd` architecture diagram
2. CIPHER spawns a Python subprocess calling `generate_ground_truth(use_llm=False)` — fully deterministic, no LLM or API key required
3. Results are saved to `vendor/threatassessor/report/<arch_name>/ground_truth.json` and displayed immediately
4. The report page shows: overall risk score, defensibility rating, RAPIDS assessment table, attack paths with MITRE ATT&CK badges, and present/missing controls
5. Past reports are listed and can be re-opened without re-running the analysis

**Native integration:** ThreatAssessor runs inside CIPHER's Python venv (`vendor/threatassessor/.venv/`). The first run (`npm run dev:full`) sets up the venv and installs dependencies automatically. Subsequent runs use `npm run dev` as normal.

**Forum integration:** All ThreatAssessor reports appear as a **Threat Model** section in the AI Forum sidebar. Attack paths, RAPIDS assessment, and controls gap are each selectable as context items — injected into the AI prompt alongside observations and findings.

### Threat Model Ingest (ThreatAssessor via Ingest tab)
Upload a `.mmd` diagram through the Ingest tab to have ThreatAssessor's predictions flow into the deduplication workflow:

1. Select SSP profile and run mode (Fast or Full), upload `.mmd`
2. CIPHER proxies to ThreatAssessor's `/api/v1/analyze` endpoint
3. Predictions come through the same deduplication dialog as all other tools
4. Approved predictions are stored as **Observations** (source: `threatassessor`, status: `raw`)
5. The pentester tests each predicted path and promotes or archives individually

**Coverage score:** The Closing View shows confirmed ÷ total TA-predicted paths (green ≥ 70%, amber 40–69%, red < 40%).

**AI enhancement:** Executive summaries and purple team analyses automatically include MITRE chain, SSP compliance gaps, coverage delta, and MoE orchestrator context when TA predictions are present.

### Finding Management
Full CRUD over confirmed findings with severity (`critical` / `high` / `medium` / `low` / `info`), CVSS score, host/port, evidence, remediation notes, and CVE IDs. Chain related findings together to model attack paths — the chain is fed directly into the AI summary prompt.

Findings sourced from ThreatAssessor carry additional badges:
- **MITRE ATT&CK badges** (purple) — technique IDs (e.g. `T1566.001`)
- **SSP control badges** — colour-coded by level: red (L0 Cardinal — mandatory), amber (L1 Basic Hygiene — recommended), grey (L2 Best Practice)
- **TA confidence pill** — green ≥ 80%, amber ≥ 60%, red < 60%
- **Attack path** shown in the expanded card view

### Finding Library
Cross-engagement search over every confirmed finding you've ever captured. Two tabs:

**Findings tab** — Filter by severity, CVE, host pattern, or keyword. CVE IDs on each finding are displayed as clickable orange badges — clicking one fetches the full CVE record from NVD inline below the row (CVSS score, severity, vector string, CWE IDs, description, references) without leaving the page. Use any finding as a template to pre-fill a new finding form.

**CVE Database tab** — Full NVD-powered CVE search directly in the library. Enter a CVE ID (e.g. `CVE-2021-44228`) for exact lookup, or keywords (e.g. `log4j`, `apache rce`) for broader search. Each result card shows: CVSS score + severity colour-coded by criticality, vuln status, published/modified dates, CVSS vector string, CWE IDs, full description, and up to 5 references. Results are cached in-session — repeated searches return instantly. Covers 355 000+ CVEs from 1999 to present via the NVD 2.0 API.

### Whiteboard
A per-engagement freeform canvas for planning attack paths, mapping scope, or sketching out chains before findings are confirmed.

### Generating Forum
A split-panel workspace for deepening your analysis of any engagement.

**Left panel — Context sidebar** (four sections, all collapsible):
- **Observations** — all engagement observations with status badges
- **Findings** — all engagement findings with severity badges
- **Threat Model** — items from any ThreatAssessor reports: summary, RAPIDS assessment, individual attack paths, and controls gap. Purple `TM` badge in context chips.
- **CVE Database** — search NVD inline from the sidebar. Selected CVEs get an orange `CVE` badge in context chips.

Click any item to toggle it into AI context. All selected items are injected into the AI system prompt with type-aware formatting.

**Right panel — two tabs:**

- **AI Chat** — Streaming AI assistant that renders responses as full **Markdown**: headers, tables, fenced code blocks, bold, blockquotes — all styled. The AI is instructed to:
  - Cite CVEs with full CVE ID, CVSS v3.1 score + vector, and affected component/version
  - Reference MITRE ATT&CK techniques with tactic context (e.g. `T1190 [Initial Access — Exploit Public-Facing Application]`)
  - Ground every remediation in authoritative sources: NIST SP 800-53 Rev5 control IDs, CIS Controls v8 safeguards, OWASP categories, vendor hardening guides, SANS courses
  - Label findings `[THEORETICAL]` vs `[CONFIRMED]` and never fabricate CVE numbers
  - Use CVSS v3.1 methodology with justified scores

- **Notes** — Full rich-text editor (Tiptap) with auto-save and image upload.

### AI Executive Summaries
Generates a prose executive summary fed by your client brief, confirmed findings, finding chains, and a user-defined house style. Streams into a Tiptap rich-text editor for inline editing before export.

When ThreatAssessor data is present, the prompt is automatically enriched with the MITRE attack chain, SSP compliance gaps, and coverage score.

### Purple Team Analysis
Red team and blue team AI analysis from the Report page.

- **Red team:** Gets MoE orchestrator context — confidence cascade, blindspots, contradictions, and the Red Team roadmap predicted by ThreatAssessor
- **Blue team:** Gets SSP L0 unaddressed controls — mandatory controls with no confirmed finding, surfacing compliance gaps

### Report Export
Export the edited summary as a PDF directly from the browser.

### Closing View
Pre-deadline triage activated within 48 hours of the engagement end date. When ThreatAssessor data is present, a coverage section shows confirmed ÷ total TA-predicted paths with three columns: Confirmed, Not Tested, Archived.

### Theme Customisation
- **7 built-in presets:** Default (blue), Crimson, Ocean, Forest, Violet, Ember, Rose
- **Image extraction:** Upload any image and the app samples the dominant hue and applies it as the theme
- **Light / Dark mode toggle** — flash-free, persists across sessions

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
| Markdown | react-markdown + remark-gfm (forum AI responses) |
| PDF | @react-pdf/renderer |
| Validation | Zod |
| Threat Modelling | ThreatAssessor (Python subprocess via vendor/) |
| CVE Data | NVD 2.0 API (355 000+ CVEs, 1999–present) |

---

## Prerequisites

- Node.js 18+
- Python 3.9+ (only required if using the native Threat Assessor page)
- No other global dependencies required

---

## Setup

```bash
git clone https://github.com/CodeRabbit-byte/Cipher.git
cd Cipher
cp .env.example .env
```

Edit `.env` — at minimum set `NEXTAUTH_SECRET`. Add an AI key to enable forum chat and executive summary generation.

```bash
npm install
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register an account.

> The dev server binds to `127.0.0.1` only — not accessible on the network.

### First-time ThreatAssessor setup (native Threat Assessor page only)

Run once to create the Python venv and install dependencies:

```bash
npm run dev:full
```

This creates `vendor/threatassessor/.venv/`, installs Python requirements, then starts CIPHER. After the first run, use `npm run dev` as normal — the venv persists.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (localhost only) |
| `npm run dev:full` | First-time setup: create Python venv + install TA deps + start CIPHER |
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
| `THREATASSESSOR_URL` | No | Base URL of ThreatAssessor API (e.g. `http://localhost:8000`). Required for Ingest tab integration only. |
| `THREATASSESSOR_API_KEY` | No | API key for ThreatAssessor API. Required for Ingest tab integration only. |
| `NVD_API_KEY` | No | NIST NVD API key — free at [nvd.nist.gov/developers/request-an-api-key](https://nvd.nist.gov/developers/request-an-api-key). Without key: 5 req/30s. With key: 50 req/30s. |

Leaving all AI keys blank disables AI forum chat and executive summary generation. CVE search, ThreatAssessor analysis, and all other features work without it.

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

CIPHER includes [ThreatAssessor](https://github.com/BerdTan/ThreatAssessor) at `vendor/threatassessor/` and runs it as a **native Python subprocess** — no separate server, no second port, no iframe.

### Native Threat Assessor page (`/threatassessor`)

Analysis runs fully deterministically (`use_llm=False`) — no LLM or API key required.

```
.mmd file uploaded in browser
        │
        ▼
POST /api/threatassessor/analyze
        │
        ▼
Python subprocess: ta_analyze.py
  → generate_ground_truth(use_llm=False)
  → saves vendor/threatassessor/report/<arch>/ground_truth.json
  → prints JSON to stdout
        │
        ▼
Report displayed natively in CIPHER:
  ├── Risk score + defensibility rating
  ├── RAPIDS assessment table
  ├── Attack paths with MITRE ATT&CK badges
  └── Present / missing controls
```

**First-time setup:**
```bash
npm run dev:full   # creates .venv, installs requirements, starts CIPHER
```

**Subsequent runs:**
```bash
npm run dev        # .venv already exists, no setup needed
```

### Ingest tab integration (API-based, optional)

For the Ingest tab's Threat Model sub-tab, CIPHER can also proxy `.mmd` files to a running ThreatAssessor API server:

```bash
git clone https://github.com/BerdTan/ThreatAssessor
cd ThreatAssessor
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Set in `.env`:
```
THREATASSESSOR_URL=http://localhost:8000
THREATASSESSOR_API_KEY=your_key_here
```

The Threat Model tab in Ingest appears automatically when both vars are set.

### SSP Profiles

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

---

## CVE Database

CIPHER integrates with the **NIST National Vulnerability Database (NVD) 2.0 API** to provide access to 355 000+ CVEs from 1999 to present.

### Where it appears

- **Finding Library → CVE Database tab** — search by CVE ID or keyword, view full enriched cards inline
- **Finding Library → Findings tab** — CVE IDs on findings are clickable badges that expand NVD data inline
- **AI Forum sidebar → CVE Database section** — search and add CVEs as context items for AI analysis

### Getting an API key (optional)

The NVD API is free and works without a key, but is rate-limited to 5 requests per 30 seconds. A free API key raises this to 50 requests per 30 seconds:

1. Visit [nvd.nist.gov/developers/request-an-api-key](https://nvd.nist.gov/developers/request-an-api-key)
2. Enter your email — the key is sent immediately
3. Add to `.env`: `NVD_API_KEY=your_key_here`

### Data sources

| Source | URL |
|---|---|
| NVD 2.0 API (used by CIPHER) | [nvd.nist.gov/developers/vulnerabilities](https://nvd.nist.gov/developers/vulnerabilities) |
| Official CVE list (full JSON corpus) | [github.com/CVEProject/cvelistV5](https://github.com/CVEProject/cvelistV5) |
| NVD CVE database (CSV/JSON) | [github.com/password123456/nvd-cve-database](https://github.com/password123456/nvd-cve-database) |
| Python NVD wrapper | [github.com/vehemont/nvdlib](https://github.com/vehemont/nvdlib) |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                              # Authenticated app shell
│   │   ├── dashboard/                      # Home dashboard
│   │   ├── threatassessor/                 # Native Threat Assessor page
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
│   │   └── library/                        # Cross-engagement finding search + CVE database
│   ├── api/
│   │   ├── auth/                           # register + [...nextauth]
│   │   ├── engagements/                    # CRUD + forum-notes
│   │   ├── observations/                   # CRUD
│   │   ├── findings/                       # CRUD + chain links
│   │   ├── cve/                            # NVD 2.0 API proxy (CVE search)
│   │   ├── ingest/
│   │   │   ├── burp/ nmap/ nuclei/ nessus/ metasploit/
│   │   │   └── threatassessor/             # Proxy .mmd to TA API + parse predictions
│   │   │       └── configured/             # GET { configured: boolean }
│   │   ├── threatassessor/
│   │   │   ├── analyze/                    # POST — run Python subprocess analysis
│   │   │   └── reports/                    # GET list + GET [name] ground_truth.json
│   │   ├── upload/                         # Image upload for forum notes
│   │   └── ai/
│   │       ├── draft-summary/              # Executive summary generation
│   │       ├── purple-team/                # Purple team streaming
│   │       └── forum/                      # Streaming forum AI chat (markdown output)
│   ├── login/
│   └── register/
├── components/
│   ├── ui/                                 # shadcn/ui primitives
│   ├── capture/                            # Observation feed + promote dialog
│   ├── findings/
│   │   ├── FindingCard.tsx                 # MITRE/SSP/confidence badges
│   │   ├── LibrarySearch.tsx               # Library tabs: Findings + CVE Database
│   │   ├── FindingChainMap.tsx
│   │   ├── FindingsList.tsx
│   │   └── SeverityBadge.tsx
│   ├── ingest/                             # Dropzone + deduplication dialog + Threat Model tab
│   ├── report/                             # Summary editor + PDF export
│   ├── closing/                            # Pre-closing triage view + TA coverage bar
│   ├── whiteboard/
│   ├── forum/
│   │   ├── ForumPage.tsx                   # Split-panel: Obs/Findings/ThreatModel/CVE sidebar + markdown AI chat
│   │   └── ForumNotes.tsx                  # Tiptap rich-text notes editor
│   └── theme/
├── lib/
│   ├── ai/
│   │   ├── provider.ts
│   │   └── prompts/
│   │       ├── executive-summary.ts
│   │       └── purple-team.ts
│   ├── cve.ts                              # NVD 2.0 API client (CVSS extraction, type-safe)
│   ├── parsers/
│   │   ├── burp.ts / nmap.ts / nuclei.ts / nessus.ts / metasploit.ts
│   │   └── threatassessor.ts
│   ├── agents/
│   ├── dedup/
│   ├── theme.ts
│   ├── db.ts
│   └── utils.ts
scripts/
├── start-ta.js                             # First-time setup: venv + pip install + start CIPHER
└── ta_analyze.py                           # Python helper: calls generate_ground_truth(use_llm=False)
vendor/
└── threatassessor/                         # ThreatAssessor source (gitignored: .venv/, report/, .env)
prisma/
├── schema.prisma
└── data/cipher.db                          # SQLite (gitignored)
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
| `forumNotes` | String? | Tiptap JSON — persisted rich-text notes |
| `sspProfile` | String? | ThreatAssessor SSP profile used |
| `architectureName` | String? | Architecture diagram name (links to TA report) |
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
| `mitreIds` | String? | Comma-separated MITRE ATT&CK IDs (TA only) |
| `mitreMitigations` | String? | Comma-separated MITRE mitigation IDs (TA only) |
| `sspControls` | String? | Comma-separated SSP control references (TA only) |
| `taConfidence` | Float? | ThreatAssessor confidence 0.0–1.0 (TA only) |
| `attackPath` | String? | Human-readable attack path (TA only) |

### Finding
| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `title` | String | |
| `description` | String | Full write-up |
| `severity` | String | `critical` \| `high` \| `medium` \| `low` \| `info` |
| `cvss` | Float? | CVSS score (0–10) |
| `host` | String? | Affected host/IP |
| `port` | Int? | Affected port |
| `evidence` | String? | |
| `remediationNote` | String? | |
| `cveIds` | String? | Comma-separated CVE IDs — clickable in library with NVD enrichment |
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
| GET | `/api/engagements/[id]/forum-notes` | Get rich-text notes |
| POST | `/api/engagements/[id]/forum-notes` | Save rich-text notes |

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

### CVE
| Method | Path | Description |
|---|---|---|
| GET | `/api/cve?q=CVE-2021-44228` | Exact CVE ID lookup via NVD 2.0 API |
| GET | `/api/cve?q=log4j` | Keyword search — returns up to 15 results |

Returns `{ cves: CveItem[], total: number }`. Each `CveItem` includes: id, description, published, lastModified, vulnStatus, cvssScore, cvssSeverity, cvssVector, cvssVersion, cweIds, references.

### ThreatAssessor (native)
| Method | Path | Description |
|---|---|---|
| POST | `/api/threatassessor/analyze` | Run deterministic analysis on uploaded `.mmd` file |
| GET | `/api/threatassessor/reports` | List all saved reports |
| GET | `/api/threatassessor/reports/[name]` | Get `ground_truth.json` for a named architecture |

`POST /api/threatassessor/analyze` accepts `multipart/form-data`:
- `architecture_file` — `.mmd` Mermaid diagram
- `ssp_profile` — SSP profile key (default: `medium_risk_cloud`)

Returns `{ success: true, data: GroundTruth, architectureName: string }`.

### Ingest
| Method | Path | Description |
|---|---|---|
| POST | `/api/ingest/burp` | Parse Burp Suite XML |
| POST | `/api/ingest/nmap` | Parse nmap XML |
| POST | `/api/ingest/nuclei` | Parse Nuclei JSONL |
| POST | `/api/ingest/nessus` | Parse Nessus `.nessus` |
| POST | `/api/ingest/metasploit` | Parse Metasploit XML |
| POST | `/api/ingest/threatassessor` | Proxy `.mmd` to ThreatAssessor API, parse predictions |
| GET | `/api/ingest/threatassessor/configured` | Returns `{ configured: boolean }` |

### Upload
| Method | Path | Description |
|---|---|---|
| POST | `/api/upload` | Upload image (JPEG/PNG/GIF/WebP/SVG, max 10 MB). Returns `{ url }`. |

### AI
| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/draft-summary` | Generate executive summary (non-streaming, TA-enriched) |
| POST | `/api/ai/purple-team` | Streaming purple team analysis (red/blue, TA-enriched) |
| POST | `/api/ai/forum` | Streaming AI forum chat — returns Markdown, context-aware |

**`/api/ai/forum`** body: `{ engagementId, messages, contextItems: ContextItem[] }`

`ContextItem.type` is one of: `"observation"` | `"finding"` | `"threatmodel"` | `"cve"`

The AI is instructed to output structured Markdown with proper CVE citations (CVSS v3.1, vector, affected versions), MITRE ATT&CK references with tactic context, and remediations grounded in NIST SP 800-53, CIS Controls v8, OWASP, and SANS.

---

## Data & Privacy

- **Database:** SQLite at `prisma/data/cipher.db` — local only, never leaves your machine
- **Uploaded images:** `public/uploads/` — stored on disk, gitignored
- **ThreatAssessor reports:** `vendor/threatassessor/report/` — local only, gitignored
- **No cloud sync:** everything stays on disk unless you deploy to a remote host
- **Dev server:** bound to `127.0.0.1` — not exposed on the local network
- **API keys:** all keys are server-side only — never prefixed with `NEXT_PUBLIC_`, never returned in any API response

---

## Collaborators

- [Coderabbit-byte](https://github.com/CodeRabbit-byte)
- [BerdTan](https://github.com/BerdTan) — ThreatAssessor integration
