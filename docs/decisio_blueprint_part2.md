# Decisio — Blueprint Part 2

---

## 4. SYSTEM MODULES

### Module Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     USER (Browser)                              │
└────────┬───────────────────────────────────────────┬───────────┘
         │ upload transcript                         │ view data
         ▼                                           ▲
┌────────────────┐                          ┌────────────────────┐
│ M1: Transcript │                          │ M9: Dashboard &    │
│    Ingestion   │                          │    Query Layer      │
└───────┬────────┘                          └────────▲───────────┘
        │ meeting_id + raw text                      │ aggregated data
        ▼                                            │
┌────────────────────────────────────────────────────┤
│ M2: Parsing Pipeline (Orchestrator)                │
│                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │M3:       │ │M4:       │ │M7:       │          │
│  │Decision  │ │Action    │ │Blocker   │          │
│  │Extraction│ │Extraction│ │Detection │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│       │            │             │                 │
│       │       ┌────┴────┐       │                 │
│       │       │M5:Owner │       │                 │
│       │       │Detection│       │                 │
│       │       └────┬────┘       │                 │
│       │       ┌────┴────┐       │                 │
│       │       │M6:Date  │       │                 │
│       │       │Parsing  │       │                 │
│       │       └─────────┘       │                 │
│       └────────────┬────────────┘                 │
│                    ▼                               │
│            ┌──────────────┐                       │
│            │   Database   │───────────────────────┘
│            └──────┬───────┘
│                   │ open items from past meetings
│                   ▼
│           ┌──────────────┐
│           │M8: Cross-    │
│           │Meeting Memory│
│           └──────────────┘
└────────────────────────────────────────────────────┘
```

---

### Module 1: Transcript Ingestion

**Purpose:** Accept transcript input, validate it, create a meeting record, and hand off to processing.

| | |
|---|---|
| **Input** | Meeting title (string), meeting date (date), project ID (optional UUID), transcript text (string or .txt file) |
| **Output** | `meeting_id` (UUID), stored transcript record, processing trigger |

**Step-by-step logic:**

```
1. User submits form: { title, date, project_id?, transcript_text }
2. Validate:
   - title: non-empty, max 300 chars
   - date: valid date, not in future
   - transcript_text: non-empty, 100–50,000 chars
   - If file upload: read .txt/.md file → extract text content
3. Create `meeting` record:
   - status = "processing"
   - user_id from auth session
4. Create `transcript` record:
   - raw_text = transcript content
   - char_count = text.length
   - source = "pasted" | "file_upload"
5. Return meeting_id to frontend immediately
6. Trigger M2 (async — don't block the response)
```

**API endpoint:**
```
POST /api/meetings
Body: { title, date, projectId?, transcript }
Response: { meetingId, status: "processing" }
```

**Dependencies:** Auth (user session), database, M2 trigger

---

### Module 2: Parsing Pipeline (Orchestrator)

**Purpose:** Take a meeting transcript, call the LLM once, validate the response, and route extracted items to storage.

| | |
|---|---|
| **Input** | `meeting_id` + raw transcript text |
| **Output** | Structured records saved to DB: decisions, action_items, blockers, unresolved_items |

**Step-by-step logic:**

```
1. Fetch transcript text from DB using meeting_id
2. Fetch meeting date (needed for relative date resolution)
3. Build the extraction prompt:
   - System prompt: role + rules + output schema
   - User prompt: meeting_date + transcript text
4. Call LLM API:
   - Model: gpt-4o-mini
   - response_format: { type: "json_object" }
   - Temperature: 0.1 (low — we want consistency)
   - Max tokens: 4000
5. Parse JSON response
6. Validate response schema:
   - Has keys: decisions[], action_items[], blockers[], unresolved_items[], participants_detected[]
   - Each decision has: text, confidence, is_final
   - Each action has: task, owner, priority
   - If invalid → retry ONCE with stricter prompt
   - If still invalid → set meeting status = "failed", log error, stop
7. For each decision → run M5 (owner detection) → save to `decisions` table
8. For each action_item → run M5 + M6 (date parsing) → save to `action_items` table
9. For each blocker → link to action_item if match found → save to `blockers` table
10. Save unresolved_items to `decisions` table with status = "unresolved"
11. Update meeting.participant_names from participants_detected
12. Update meeting.status = "processed"
13. Trigger M8 (cross-meeting memory) if user has past meetings
```

**Key design decision:** One LLM call extracts everything. Not five separate calls. This is faster, cheaper, and avoids inconsistencies between extraction passes.

**The prompt (production-ready starter):**

```javascript
const systemPrompt = `You are a meeting analysis engine. Extract structured execution data from meeting transcripts.

Return ONLY valid JSON matching this exact schema:
{
  "decisions": [{
    "text": "What was decided",
    "context": "1-2 sentences of surrounding discussion",
    "confidence": "high | medium | low",
    "participants": ["Name1"],
    "is_final": true | false
  }],
  "action_items": [{
    "task": "What needs to be done",
    "owner": "Person name or 'unassigned'",
    "deadline": "YYYY-MM-DD or null",
    "priority": "high | medium | low",
    "linked_decision": "Text of related decision or null"
  }],
  "blockers": [{
    "description": "What is blocked and why",
    "blocked_owner": "Who is stuck",
    "blocking_entity": "Who/what is causing it",
    "related_task": "Which task is affected or null"
  }],
  "unresolved_items": [{
    "topic": "What was discussed but not decided",
    "reason": "Why it remains open"
  }],
  "participants_detected": ["Name1", "Name2"]
}

RULES:
- DECISION = the group explicitly agreed on a course of action. Not opinions. Not questions.
- ACTION ITEM = someone was assigned a task or volunteered. Not vague intentions like "we should."
- BLOCKER = someone explicitly cannot proceed due to a dependency.
- Convert relative dates using meeting date: {meeting_date}. "Next Friday" = calculate from meeting date.
- If unsure about confidence, use "medium".
- Return empty arrays if nothing found for a category. Do NOT invent items.`;

const userPrompt = `Meeting date: ${meetingDate}\n\nTranscript:\n"""\n${transcriptText}\n"""`;
```

**Dependencies:** LLM API key (OpenAI), database, M5, M6, M8

---

### Module 3: Decision Extraction

**Purpose:** Identify statements where the group agreed on a direction, choice, or policy.

| | |
|---|---|
| **Input** | Raw transcript (processed within M2's LLM call) |
| **Output** | Array of `{ text, context, confidence, participants, is_final }` |

**What counts as a decision:**
- ✅ "We'll go with Postgres" (explicit choice)
- ✅ "Let's push the launch to April 15" (agreed direction)
- ✅ "From now on, all PRs need 2 reviewers" (policy)
- ❌ "I think we should use Postgres" (opinion, not agreement)
- ❌ "Should we push the launch?" (question, not decision)
- ❌ "We discussed the database options" (discussion, not decision)

**Post-LLM processing:**
```
1. Receive decisions[] from LLM response
2. Deduplicate: if two decisions have >80% text similarity → keep the more detailed one
3. For each decision:
   - Normalize participant names via M5
   - Set status = "active" (default)
   - If is_final = false → set status = "tentative"
4. Save to `decisions` table with meeting_id FK
```

**Dependencies:** Part of M2's LLM call. M5 for owner normalization.

---

### Module 4: Action Item Extraction

**Purpose:** Detect tasks that were assigned or volunteered during the meeting.

| | |
|---|---|
| **Input** | Raw transcript (processed within M2's LLM call) |
| **Output** | Array of `{ task, owner, deadline, priority, linked_decision }` |

**What counts as an action item:**
- ✅ "Ravi will set up the GraphQL server by Friday" (clear assignment)
- ✅ "I'll handle the migration" (self-assignment)
- ✅ "Can someone update the docs?" → owner = "unassigned"
- ❌ "We should probably update the docs" (vague intention — no owner)
- ❌ "The docs need updating" (observation, not assignment)

**Post-LLM processing:**
```
1. Receive action_items[] from LLM response
2. For each action item:
   - Run M5: normalize owner name
   - Run M6: parse deadline string → ISO date or null
   - Link to decision: if linked_decision text matches a decision.text → set decision_id FK
   - Set status = "open" (default)
   - Set stale_count = 0
3. Flag items where owner = "unassigned" for dashboard highlight
4. Save to `action_items` table
```

**Dependencies:** M2 (prompt), M5 (owner), M6 (deadline)

---

### Module 5: Owner Detection

**Purpose:** Normalize participant names across a meeting and across the user's history.

| | |
|---|---|
| **Input** | Name strings from LLM output (e.g., "Ravi", "Ravi S.", "ravi sharma") |
| **Output** | Canonical name string, matched to existing participant records if possible |

**Step-by-step logic:**
```
1. Receive a name string from M3/M4/M7
2. Normalize: trim whitespace, title-case
3. Fetch existing participant names for this user from past meetings
4. Fuzzy match:
   - Exact match → use existing canonical name
   - Partial match (first name matches, e.g., "Ravi" vs "Ravi Sharma") → use the more complete name
   - No match → store as new canonical name
5. Return canonical name
```

**Implementation note:** For MVP, this is a simple string-matching function — not an LLM call. Use basic rules:
```javascript
function normalizeOwner(name, existingNames) {
  const normalized = name.trim().replace(/\s+/g, ' ');
  const titleCased = normalized.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  // Check for partial matches against existing names
  const match = existingNames.find(existing =>
    existing.toLowerCase().startsWith(titleCased.split(' ')[0].toLowerCase())
  );

  return match || titleCased;
}
```

**Dependencies:** Historical participant data from DB

---

### Module 6: Deadline Parsing

**Purpose:** Convert natural-language date references into ISO dates.

| | |
|---|---|
| **Input** | Deadline string from LLM (e.g., "2026-04-10", "next Friday", "end of sprint") |
| **Output** | ISO date string (`"2026-04-10"`) or `null` |

**Step-by-step logic:**
```
1. Receive deadline string from M4 output
2. If LLM already returned YYYY-MM-DD format → validate and use directly
3. If natural language:
   - Use chrono-node library to parse relative to meeting date
   - "next Friday" → chrono.parseDate("next Friday", meetingDate) → ISO string
   - "end of month" → last day of meeting's month
4. If unparseable (e.g., "soon", "ASAP", "TBD") → return null
5. Attach parsed date to action item
```

**Library:** `chrono-node` (npm install chrono-node) — lightweight, well-maintained, handles most English date expressions.

**Dependencies:** Meeting date from M1, action item data from M4

---

### Module 7: Blocker Detection

**Purpose:** Identify obstacles that are preventing work from progressing.

| | |
|---|---|
| **Input** | Raw transcript (processed within M2's LLM call) |
| **Output** | Array of `{ description, blocked_owner, blocking_entity, related_task }` |

**What counts as a blocker:**
- ✅ "I'm blocked on DevOps approval" (explicit block)
- ✅ "Can't start testing until the staging environment is up" (dependency block)
- ✅ "Waiting for legal to review the contract" (external block)
- ❌ "It would be nice to have DevOps help" (request, not a block)
- ❌ "We're a bit behind schedule" (status update, not a block)

**Post-LLM processing:**
```
1. Receive blockers[] from LLM response
2. For each blocker:
   - Link to action item: text-match related_task against action_items[].task
     - If match found → set action_item_id FK
     - Also update that action_item's status to "blocked"
   - Set status = "active"
   - Set detected_at = now()
3. Save to `blockers` table
```

**Dependencies:** M2 (prompt), M4 (for linking to action items)

---

### Module 8: Cross-Meeting Memory

**Purpose:** When a new meeting is processed, detect references to past open items and update their status.

| | |
|---|---|
| **Input** | Newly extracted items from current meeting + all open items from past meetings (same user, optionally same project) |
| **Output** | Updated statuses on past items, `followup` records linking old items to new meeting |

**This is Decisio's differentiating feature.** This is what separates it from every summarizer.

**Step-by-step logic:**
```
1. After M2 completes for a new meeting:
2. Fetch from DB:
   - All action_items where status IN ("open", "in_progress", "blocked") for this user
   - All decisions where status IN ("active", "tentative") for this user
   - All blockers where status = "active" for this user
3. Build a comparison prompt for the LLM:

   System: "You are comparing a new meeting's content against existing open items.
   For each open item, determine if the new meeting resolves, updates, or references it."

   Input:
   - new_transcript: full text of new meeting
   - open_items: JSON array of { id, type, text, owner }

   Expected output:
   {
     "matches": [
       {
         "item_id": "a_act1",
         "item_type": "action_item",
         "resolution": "resolved" | "updated" | "still_open" | "escalated",
         "evidence": "Quote from transcript that references this item",
         "notes": "What changed"
       }
     ]
   }

4. For each match:
   - "resolved": update action_item.status = "done" or blocker.status = "resolved"
   - "updated": update relevant fields (new deadline, new owner, etc.)
   - "still_open": increment action_item.stale_count += 1
   - "escalated": set priority = "high", flag for dashboard

5. Create `followup` record for each match:
   - source_meeting_id = original meeting
   - target_meeting_id = new meeting
   - item_type, item_id, resolution, notes

6. Flag items with stale_count >= 3 as "chronically unresolved" on dashboard
```

**Cost consideration:** This is a second LLM call per meeting upload. For MVP with low volume, this is fine. Cost: ~$0.001–0.01 per meeting. Optimize later by batching or caching.

**Dependencies:** All previous modules, historical data in DB, LLM API

---

### Module 9: Dashboard & Query Layer

**Purpose:** Present all extracted and tracked data through API endpoints and visual UI.

| | |
|---|---|
| **Input** | Aggregated data from all DB tables |
| **Output** | REST API responses consumed by frontend views |

**API Endpoints:**

```
Auth:
  POST   /api/auth/signup          — create account
  POST   /api/auth/login           — login
  POST   /api/auth/logout          — logout
  GET    /api/auth/me              — current user

Meetings:
  GET    /api/meetings             — list all (paginated, sorted by date desc)
  GET    /api/meetings/:id         — single meeting + all extracted data
  POST   /api/meetings             — create + trigger processing
  GET    /api/meetings/:id/status  — poll processing status

Actions:
  GET    /api/actions              — all actions (filterable: ?status=open&owner=Ravi&overdue=true)
  PATCH  /api/actions/:id          — update status, owner, deadline

Decisions:
  GET    /api/decisions            — all decisions (filterable: ?status=active&confidence=high)

Blockers:
  GET    /api/blockers             — all blockers (filterable: ?status=active)
  PATCH  /api/blockers/:id         — resolve blocker

Dashboard:
  GET    /api/dashboard/summary    — aggregate stats for dashboard cards
  GET    /api/dashboard/attention  — items needing attention (overdue, blocked, stale)

Projects:
  GET    /api/projects             — list projects
  POST   /api/projects             — create project
```

**Frontend views:**

| View | Route | Content |
|---|---|---|
| Dashboard | `/` | Stat cards + "needs attention" list + recent meetings |
| Meeting List | `/meetings` | All meetings, sortable by date |
| Meeting Detail | `/meetings/[id]` | Transcript + extracted data (tabbed) |
| New Meeting | `/meetings/new` | Upload form |
| Action Board | `/actions` | Filterable table of all action items |
| Decision Log | `/decisions` | Chronological decision list |
| Blocker Tracker | `/blockers` | Active blockers with age and links |
| Project View | `/projects/[id]` | All meetings/items for one project |

**Dependencies:** All data modules, frontend framework, auth middleware

---

## 5. USER FLOW (END-TO-END)

### Flow Diagram

```
USER ACTION                 SYSTEM RESPONSE                    MODULE
──────────                  ───────────────                    ──────

1. Open app              → Show login page                    Auth
       │
2. Sign up / Log in      → Validate credentials               Auth
       │                   Create session
       │                   Redirect to dashboard
       ▼
3. See dashboard         → Query DB for aggregated stats       M9
       │                   Display: 0 meetings, 0 items
       │                   Show prominent "Upload Meeting" CTA
       ▼
4. Click "New Meeting"   → Show upload form                    M9
       │
5. Fill form:            → Frontend validates inputs           M1
   - Title: "Sprint 14"
   - Date: April 2, 2026
   - Paste transcript
   - Click "Process"
       │
       ▼
6. Submit                → POST /api/meetings                  M1
                           Create meeting (status: processing)
                           Store transcript
                           Return meeting_id
                           Show loading screen with progress
       │
       ▼
7. Processing            → Build LLM prompt                    M2
   (2-8 seconds)           Call OpenAI API
                           Parse JSON response
                           Validate schema
                           ├── Save decisions                  M3
                           ├── Save actions (+ normalize       M4
                           │   owners, parse dates)            M5, M6
                           ├── Save blockers (+ link           M7
                           │   to actions)
                           └── Update meeting status
                               = "processed"
       │
       ▼
8. Cross-meeting check   → Fetch past open items               M8
   (if past meetings       Build comparison prompt
    exist)                 Call LLM
                           Update past item statuses
                           Create followup records
       │
       ▼
9. View results          → GET /api/meetings/:id               M9
                           Display split view:
                           LEFT: transcript
                           RIGHT: tabs
                            ├── Decisions (3 found)
                            ├── Actions (5 found)
                            ├── Blockers (1 found)
                            └── Cross-meeting links
       │
       ▼
10. Edit items           → User clicks status toggle            M9
    (optional)             PATCH /api/actions/:id
                           Mark action as "done"
                           Reassign owner
                           Change deadline
       │
       ▼
11. Browse dashboard     → GET /api/dashboard/summary           M9
                           See updated stats:
                           - 4 open actions
                           - 1 overdue
                           - 1 blocked
                           - 2 active blockers
       │
       ▼
12. Upload meeting #2    → Repeat steps 4-8                    M1-M8
                           Cross-meeting memory activates:
                           "Action from meeting #1 now resolved"
                           "Decision from meeting #1 revisited"
                           Stale items flagged
       │
       ▼
13. Ongoing use          → Daily dashboard checks               M9
                           Upload after each meeting
                           Watch items resolve over time
                           Catch items that keep slipping
```

### What The User Sees At Each Stage

**First visit (empty state):**
```
┌─────────────────────────────────────────────────┐
│  Welcome to Decisio                              │
│                                                  │
│  You have no meetings yet.                       │
│                                                  │
│  ┌──────────────────────────────┐               │
│  │  + Upload Your First Meeting │               │
│  └──────────────────────────────┘               │
│                                                  │
│  Paste a meeting transcript and Decisio will     │
│  extract decisions, action items, blockers,      │
│  and track them across meetings.                 │
└─────────────────────────────────────────────────┘
```

**After 3 meetings:**
```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD                                                   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 3        │ │ 7        │ │ 2        │ │ 1        │       │
│  │ Meetings │ │ Open     │ │ Overdue  │ │ Blocked  │       │
│  │          │ │ Actions  │ │ ⚠        │ │ 🔴       │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ⚠ NEEDS ATTENTION                                          │
│  ─────────────────                                           │
│  • "Set up staging env" — Ravi — Due Apr 1 — OVERDUE 1 DAY  │
│  • "Review security audit" — Unassigned — No deadline        │
│  • "API migration" — Blocked on DevOps approval (5 days)     │
│  • "Choose auth provider" — Unresolved across 3 meetings 🔄 │
│                                                              │
│  RECENT MEETINGS                                             │
│  ────────────────                                            │
│  Sprint 14 Standup — Apr 2 — 3 decisions, 4 actions          │
│  Design Review — Mar 30 — 1 decision, 2 actions              │
│  Sprint 13 Retro — Mar 28 — 2 decisions, 5 actions           │
└─────────────────────────────────────────────────────────────┘
```

**Meeting detail view:**
```
┌────────────────────────────┬────────────────────────────────┐
│  TRANSCRIPT                │  EXTRACTED DATA                │
│                            │                                │
│  Ravi: So I think we       │  [Decisions] [Actions] [Block] │
│  should go with GraphQL    │  ─────────────────────────────  │
│  for the mobile API.       │                                │
│                            │  DECISIONS                     │
│  Priya: Agreed. REST is    │  ✅ Switch to GraphQL for      │
│  getting too complex for   │     mobile API                 │
│  nested resources.         │     Confidence: HIGH           │
│                            │     Final: Yes                 │
│  Ravi: Okay, I'll set up   │     Participants: Ravi, Priya  │
│  the server by Friday.     │                                │
│                            │  ACTIONS                       │
│  Priya: I can update the   │  📋 Set up GraphQL server      │
│  docs after that.          │     Owner: Ravi                │
│                            │     Due: Apr 5                 │
│  Ravi: One issue — I need  │     Status: [Open ▼]           │
│  DevOps to approve the     │                                │
│  new endpoint first.       │  📋 Update API docs            │
│                            │     Owner: Priya               │
│  Aman: What about the      │     Due: Apr 7                 │
│  auth provider? We still   │     Status: [Open ▼]           │
│  haven't picked one.       │                                │
│                            │  BLOCKERS                      │
│  Ravi: Yeah, let's table   │  🔴 DevOps approval needed     │
│  that for now.             │     Blocking: Ravi             │
│                            │     Blocks: GraphQL setup      │
│                            │                                │
│                            │  UNRESOLVED                    │
│                            │  ❓ Auth provider not decided   │
│                            │     Reason: Tabled for later   │
└────────────────────────────┴────────────────────────────────┘
```

---

## 6. ARCHITECTURE SIMPLIFICATION STRATEGY

### What NOT To Build Early

| Temptation | Why It's a Trap | What To Do Instead |
|---|---|---|
| Separate backend server (Express/FastAPI) | Two repos, two deployments, CORS config, two sets of error handling. Zero benefit at MVP scale. | Use Next.js API routes. Everything in one repo. Extract later when you actually hit a scaling limit (you won't for months). |
| WebSocket for real-time processing updates | Complex server setup for a feature that runs 2–8 seconds. Not worth the infrastructure. | Poll `GET /api/meetings/:id/status` every 2 seconds during processing. Simple. Works. |
| Message queue for async processing | RabbitMQ/Redis queue adds deployment complexity and a new failure mode. You're processing one meeting at a time. | Call the LLM directly in the API route. Use a simple `async` function. If it takes 8 seconds, that's fine — show a loading screen. |
| Vector database for semantic search | Pinecone/Weaviate adds cost, complexity, and a new service to manage. You don't have enough data to need it. | Use Postgres full-text search (`tsvector`) for basic search. Or just use filters. Users will have <100 meetings for months. |
| LangChain or complex AI orchestration | Massive dependency, constant breaking changes, abstractions you'll fight against. You're making 1–2 API calls. | Use `fetch()` to call OpenAI directly. ~15 lines of code. You control everything. |
| User-configurable prompt editor | Engineering effort for a feature no MVP user needs. You'll over-abstract your code. | Hardcode prompts in your codebase. Tweak them by editing code. You're the only developer. |
| Microservices architecture | Each "module" does NOT need its own service. That's 9 services to deploy, monitor, and debug. | Modules are **functions in a single codebase**. A module is a file, not a service. |
| Docker containers | Adds Dockerfile, docker-compose, container registry. Vercel deploys serverless with zero config. | Deploy to Vercel directly from GitHub. One `git push` = deployed. |
| Comprehensive test suite on Day 1 | Writing tests before you know what your code looks like slows you down. The API shape will change 3 times. | Test manually for the first 7 days. Add tests on Day 11 once the API is stable. |
| User roles and permissions | "Admin", "Viewer", "Editor" — for a single-user MVP? No. | One user = full access to their own data. That's it. Add roles if you build team features. |

### The "Module = Function" Principle

Do NOT think of modules as separate services, packages, or deployable units. For this MVP:

```
src/
├── app/                      # Next.js pages and API routes
│   ├── page.tsx              # Dashboard
│   ├── meetings/
│   │   ├── page.tsx          # Meeting list
│   │   ├── new/page.tsx      # Upload form
│   │   └── [id]/page.tsx     # Meeting detail
│   ├── actions/page.tsx      # Action board
│   ├── decisions/page.tsx    # Decision log
│   ├── blockers/page.tsx     # Blocker tracker
│   └── api/
│       ├── meetings/
│       │   ├── route.ts      # GET (list) + POST (create)
│       │   └── [id]/
│       │       ├── route.ts  # GET (detail)
│       │       └── process/route.ts  # POST (trigger extraction)
│       ├── actions/
│       │   └── [id]/route.ts # PATCH (update)
│       ├── blockers/
│       │   └── [id]/route.ts # PATCH (resolve)
│       └── dashboard/
│           └── summary/route.ts  # GET (stats)
├── lib/
│   ├── extraction/
│   │   ├── pipeline.ts       # M2: orchestrator function
│   │   ├── prompt.ts         # The LLM prompt template
│   │   ├── crossMeeting.ts   # M8: cross-meeting comparison
│   │   └── dateParser.ts     # M6: deadline parsing
│   ├── utils/
│   │   ├── ownerNormalizer.ts # M5: name normalization
│   │   └── validators.ts     # Input validation helpers
│   ├── db.ts                 # Prisma client instance
│   └── openai.ts             # OpenAI client instance
├── components/               # Reusable UI components
│   ├── MeetingCard.tsx
│   ├── ActionTable.tsx
│   ├── DecisionCard.tsx
│   ├── BlockerAlert.tsx
│   ├── StatCard.tsx
│   └── StatusBadge.tsx
├── prisma/
│   └── schema.prisma         # Database schema
└── .env                      # API keys, DB URL
```

**Every "module" from Section 4 maps to 1–2 files in `lib/`.** That's it. No services. No containers. No message queues.

### Three Rules to Maintain Momentum

**Rule 1: Vertical slices, not horizontal layers.**

```
❌ Wrong order:
  Day 1: Build all database tables
  Day 2: Build all API routes
  Day 3: Build all frontend pages
  Day 4: Connect everything (nothing works, everything is broken)

✅ Right order:
  Day 1: Auth + database + deploy (bare minimum, end-to-end)
  Day 2: Meeting upload → store → display (one feature, fully working)
  Day 3: LLM extraction → display results (one feature, fully working)
  Day 4: Action items → filter → update (one feature, fully working)
```

Each day ends with something **you can click through and demo**.

**Rule 2: Timebox prompt engineering.**

You will be tempted to spend 3 days perfecting your LLM prompt. Don't.

```
Day 3: Write the prompt. Test with 2 transcripts. If it extracts
       roughly the right things → move on.
Day 11: Come back with 5 more transcripts. Improve edge cases.
        That's when prompt quality actually matters.
```

A prompt that works 80% well on Day 3 is worth more than a perfect prompt that delayed your dashboard by 3 days.

**Rule 3: Deploy on Day 1. Show someone on Day 7.**

```
Day 1 output: Live URL at decisio.vercel.app showing a login page.
              You feel momentum. You have something real.

Day 7 output: Working extraction + action board + dashboard.
              Show a friend. "Upload this text and see what happens."
              Their reaction tells you if you're building the right thing.
              Their confusion tells you what UX to fix.
```

Building alone for 14 days without external feedback guarantees you'll build the wrong thing beautifully.

### The Complexity Budget

Think of your MVP as having a fixed complexity budget. Every "smart" architectural choice spends from it:

| Choice | Complexity Cost | Value for MVP |
|---|---|---|
| Next.js + Prisma + Vercel | Low (well-documented, one repo) | High |
| One LLM call per meeting | Low | High |
| Postgres with Prisma migrations | Low | High |
| Separate Express backend | Medium | Zero |
| WebSocket real-time updates | Medium | Low |
| Vector DB for semantic search | High | Zero (for MVP) |
| Zoom bot integration | Very High | Zero (for MVP) |

**Spend complexity budget only on things users will directly see and use.** Everything else is infrastructure that makes you feel productive without shipping features.

---

*End of Part 2. Next: Data Model, Tech Stack, 14-Day Build Plan, and Positioning.*
