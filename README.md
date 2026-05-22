# Case Settlement Now — QA Scorecard & KPI Dashboard

A real-time dashboard for monitoring agent performance, QA scores, and lead follow-up KPIs for Case Settlement Now (MVA legal lead acquisition).

---

## Architecture Overview

```
GHL (Go High Level) → n8n Cloud → Supabase → Vercel (Next.js Dashboard)
                    ↕
                   Vapi (AI calls)
```

### Components

| Layer | Tool | Purpose |
|-------|------|---------|
| CRM | GoHighLevel (GHL) | Lead management, contact records, call logging, SMS/email automations |
| Workflow Engine | n8n Cloud (`casesettlement.app.n8n.cloud`) | All automation logic, API orchestration |
| AI Calls | Vapi | Outbound AI voice agent for initial lead contact |
| Database | Supabase (PostgreSQL) | Stores QA scores, contact attempt KPIs, management alerts |
| Dashboard | Next.js on Vercel | Read-only UI for managers to review agent performance |

---

## n8n Workflows

### 1. QA Agent (`ylIPoHGlEACR4QPU`)
**Purpose:** Scores human agent calls using AI (OpenAI GPT-4)

**Schedule:** Daily at 5:00 AM UTC (+ manual backfill webhook at `/webhook/qa-backfill`)

**Flow:**
1. Fetch all GHL conversations from the last N days (`backfillDays` in staticData, default=1)
2. Filter conversations with answered calls > 30 seconds
3. For each valid call: fetch transcript from GHL API
4. Check transcript is non-empty (note: GHL no longer sends `mediaChannel` field — transcript presence is the only check)
5. Process transcript: infer speaker labels via turn-taking heuristic (0.4s gap = new turn, first speaker = Agent) when `mediaChannel` is absent
6. Send transcript to OpenAI LLM with QA rubric prompt
7. Parse LLM response → write to `qa_scores` table
8. If management alert triggered → write to `management_alerts` table → send Slack notification

**Key nodes:**
- `Filter Valid Calls` — applies date cutoff, duration filter, dedup check
- `Dedup Check` — skips calls already scored (checks `message_id` in Supabase)
- `Process Transcript` — speaker inference + voicemail detection
- `LLM Chain - QA Analysis` — OpenAI GPT-4 scoring
- `Parse Response` — maps LLM JSON to Supabase columns
- `Write QA Scores` — POST to Supabase `qa_scores`
- `Notify — Management Alert` — Slack webhook (URL must be configured)

**Static data (global):**
- `backfillDays` (default: 1) — how many days back to look for calls
- `validCalls` — temporary accumulator, cleared after each run
- `usersMap` — maps GHL userId → agent display name (11 agents)

---

### 2. Contact Attempt Tracker (`ZWchzW7oveLKvWKf`)
**Purpose:** Tracks whether each new lead received the required follow-up calls (2 morning + 2 afternoon + 2 evening)

**Schedule:** 3x daily (Mon–Fri in CDT):
- 4:30 PM CDT (21:30 UTC) — morning window check
- 9:30 PM CDT (02:30 UTC next day) — afternoon window check  
- 1:30 AM CDT (06:30 UTC) — evening/close of day

**Flow:**
1. Fetch new contacts from GHL created in the last tracking window
2. For each contact: fetch their conversation messages
3. Count outbound calls in morning (8–11am CDT), afternoon (11am–4pm CDT), evening (4–8pm CDT) buckets
4. Determine status: ANSWERED / COMPLETE / FAIL / IN_PROGRESS
5. Write to `contact_attempts` table

**Timezone handling:** DST-aware via `Intl.DateTimeFormat` for `America/Chicago` (fixed 2026-05-22; was hardcoded UTC-5)

---

### 3. MVA SMS Bot (`DFJtLfAXmv6TYDq0`)
**Purpose:** Automated SMS follow-up for MVA leads

**Time-gate:** Configured in GHL directly (quiet hours enforced per Texas law)

---

### 4. MVA Email Bot (`fJbzEtzWVwyBJTY9`)
**Purpose:** Automated email follow-up for MVA leads

---

### 5. Time Gate — Lead Entry (`OXobIXq0FAOetS4v`)
**Purpose:** Enforces legal quiet hours before adding leads to outreach workflows

**Webhook:** `POST https://casesettlement.app.n8n.cloud/webhook/cs-lead-timegate`

**Flow:**
1. Receive GHL lead payload (triggered when lead tagged MVA Lead)
2. Detect contact's state → map to timezone (hardcoded CDT offsets, 11 US states covered)
3. Check if current time is within legal window:
   - Mon–Sat: 9am–9pm local time
   - Sunday: 12pm–9pm local time
4. ✅ In hours → add contact to GHL workflow `849b88b7-331f-45c4-a119-95cf20b13ad4`
5. ⏳ Out of hours → Wait node (calculates exact minutes to next open window) → then add to GHL workflow

**GHL payload expected fields:** `body.contact_id`, `body.state` (2-letter US state code)

---

## Supabase Schema

**Project ref:** `kgndqzrluavpnsomckzy`

### `qa_scores` table
| Column | Type | Description |
|--------|------|-------------|
| id | int8 | PK |
| message_id | text | GHL message ID (used for dedup) |
| conversation_id | text | GHL conversation ID |
| contact_id | text | GHL contact ID |
| contact_name | text | Lead full name |
| phone | text | Lead phone |
| call_direction | text | inbound / outbound |
| date | date | Date of call |
| duration_min | float | Call duration in minutes |
| overall_score | int | 0–100 aggregate QA score |
| followed_qualification_script | int | 0–100 |
| asked_all_qualification_questions | int | 0–100 |
| call_flow_control | int | 0–100 |
| objection_handling | int | 0–100 |
| proper_dq_qualification_decision | int | 0–100 |
| booking_attempt | int | 0–100 |
| lead_qualified | bool | LLM determination |
| appointment_booked | bool | LLM determination |
| voicemail_flag | bool | True if no real contact made |
| bad_attitude_flag | bool | Agent attitude issue detected |
| management_alert | bool | Requires management review |
| agent_name | text | Agent display name (from usersMap) |
| summary | text | LLM call summary |
| top_3_priorities | text | LLM improvement suggestions |

**Note:** Individual criteria scores (followed_qualification_script etc.) are 0–100 scale, NOT 0–10. The dashboard displays them correctly as `/100`.

### `contact_attempts` table
| Column | Type | Description |
|--------|------|-------------|
| id | int8 | PK |
| contact_id | text | GHL contact ID |
| contact_name | text | Lead name |
| kpi_date | date | Date of tracking |
| morning_calls | int | Calls 8–11am CDT |
| afternoon_calls | int | Calls 11am–4pm CDT |
| evening_calls | int | Calls 4–8pm CDT |
| contacted | bool | True if lead answered |
| status | text | ANSWERED / COMPLETE / FAIL / IN_PROGRESS |
| kpi_reason | text | Human-readable status explanation |

### `management_alerts` table
| Column | Type | Description |
|--------|------|-------------|
| id | int8 | PK |
| date | date | Call date |
| overall_score | int | QA score that triggered alert |
| bad_attitude_evidence | text | JSON array of evidence |
| script_violations | text | Timestamped violations |
| summary | text | Alert summary |
| qa_score_id | int8 | FK to qa_scores |

---

## GHL Configuration

**Sub-account:** Case Settlement Now  
**Location ID:** `OEvyZgDZMvPWYEYrBTxR`  
**Timezone:** `America/Chicago` (CDT/CST)

**Custom fields used:**
- `MVA Lead Status` (field ID: `ixhwkyedcOpTe6zgmuA5`) — lead qualification status

**Agents (usersMap):**
- Ahmad Engram, Anurag Raju, Ayla Noor, Clarissa Marucot, Crystal Chamba
- Gian Fabella, Guillermo C, Jonathan Weaver, Stephanie Pastora, Support Case Settlement

---

## Dashboard (Vercel)

**URL:** Auto-deployed from `gumana8701/ghl-qa-agent-kpis`  
**Framework:** Next.js 14 (App Router), Tailwind CSS  
**Data source:** Supabase (read-only anon key)

**Sections:**
1. **Avg QA Score** — aggregate score for selected date range
2. **Stat Cards** — Qualified Leads, Appointments Booked, Bad Attitude flags (click to expand)
3. **Agent QA Performance** — per-agent cards with avg score, qualified, booked, flag counts; click agent → see their calls; click call → see scorecard
4. **Call Attempt KPI** — table of leads with morning/afternoon/evening attempt counts and status

**Date filters:** Today, Yesterday, 7 days, 30 days, 90 days, All time, Custom range

---

## Known Issues & History

| Date | Issue | Fix |
|------|-------|-----|
| 2026-04-25 | GHL stopped including `mediaChannel` in transcript segments → all calls flagged as voicemail | Removed `mediaChannel` requirement; check transcript presence only |
| 2026-05-19 | Contact Attempt Tracker crashed on contacts with no conversation | Added `continueOnFail=true` + error guard |
| 2026-05-22 | Speaker labels missing → LLM marked all calls as voicemail | Turn-taking heuristic (0.4s gap = new speaker, first = Agent) |
| 2026-05-22 | Contact Attempt Tracker hardcoded UTC-5 offset (breaks in Nov DST) | Replaced with `Intl.DateTimeFormat` for `America/Chicago` |
| 2026-05-22 | `agent_name` always null in qa_scores | Added agent_name to Parse Response output |
| 2026-05-22 | Criteria bars always at 100% in dashboard | Fixed CRITERIA max from 10 → 100 (LLM scores are 0–100, not 0–10) |

---

## Data Gap

QA scores are missing for **2026-03-25 → 2026-05-21** due to the mediaChannel bug (all calls were logged as voicemail, score=0). A manual backfill is in progress to retroactively score calls from this period.
