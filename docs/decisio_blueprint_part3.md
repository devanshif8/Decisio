# Decisio — Blueprint Part 3

---

## 7. DATA MODEL (ENGINEER-LEVEL)

### Entity Relationship Diagram

```
                        ┌──────────┐
                        │  users   │
                        └────┬─────┘
                             │ 1:N
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
          ┌──────────┐ ┌──────────┐ ┌──────────┐
          │ projects │ │ meetings │ │ (auth)   │
          └────┬─────┘ └────┬─────┘ └──────────┘
               │            │
               │ 1:N        │ 1:1          1:N
               │       ┌────┴──────┐───────────────┐
               │       │           │               │
               │       ▼           ▼               ▼
               │  ┌────────────┐  ┌──────────┐  ┌──────────┐
               │  │ transcripts│  │decisions │  │ blockers │
               │  └────────────┘  └────┬─────┘  └────┬─────┘
               │                       │              │
               │                       │ 1:N (opt)    │ N:1 (opt)
               │                       ▼              │
               │               ┌──────────────┐      │
               └──────────────▶│ action_items  │◀─────┘
                               └──────┬───────┘
                                      │
                                      │ referenced in
                                      ▼
                               ┌──────────────┐
                               │  followups   │
                               └──────────────┘
```

---

### Table: `users`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK, default `gen_random_uuid()` | |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL, indexed | Login identifier |
| `name` | `VARCHAR(100)` | NOT NULL | Display name |
| `password_hash` | `VARCHAR(255)` | NOT NULL | bcrypt, 12 rounds |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | Auto-update via trigger |

**Example record:**
```json
{
  "id": "c7a3f1e2-9b4d-4e8a-b2c1-d5f6a7b8c9d0",
  "email": "ravi@startup.io",
  "name": "Ravi Sharma",
  "password_hash": "$2b$12$LJ3...",
  "created_at": "2026-03-15T10:00:00Z",
  "updated_at": "2026-03-15T10:00:00Z"
}
```

**Prisma schema:**
```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  name         String
  passwordHash String    @map("password_hash")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  projects     Project[]
  meetings     Meeting[]

  @@map("users")
}
```

---

### Table: `projects`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL, indexed | |
| `name` | `VARCHAR(200)` | NOT NULL | e.g., "Q2 Product Launch" |
| `description` | `TEXT` | NULLABLE | Optional context |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

**Example record:**
```json
{
  "id": "p_1a2b3c4d",
  "user_id": "c7a3f1e2-...",
  "name": "Decisio MVP",
  "description": "Building the MVP in 14 days",
  "created_at": "2026-03-20T08:00:00Z"
}
```

**Prisma schema:**
```prisma
model Project {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  name        String
  description String?
  createdAt   DateTime  @default(now()) @map("created_at")

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  meetings    Meeting[]

  @@index([userId])
  @@map("projects")
}
```

---

### Table: `meetings`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users, NOT NULL, indexed | |
| `project_id` | `UUID` | FK → projects, NULLABLE | Optional grouping |
| `title` | `VARCHAR(300)` | NOT NULL | "Sprint 14 Planning" |
| `meeting_date` | `DATE` | NOT NULL | When the meeting happened |
| `status` | `ENUM` | NOT NULL, default `'uploaded'` | `uploaded`, `processing`, `processed`, `failed` |
| `participant_names` | `TEXT[]` | NULLABLE | Array of detected names |
| `error_message` | `TEXT` | NULLABLE | If status = failed |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

**Example record:**
```json
{
  "id": "m_5e6f7a8b",
  "user_id": "c7a3f1e2-...",
  "project_id": "p_1a2b3c4d",
  "title": "Sprint 14 Planning",
  "meeting_date": "2026-04-01",
  "status": "processed",
  "participant_names": ["Ravi", "Priya", "Aman"],
  "error_message": null,
  "created_at": "2026-04-01T15:30:00Z"
}
```

**Prisma schema:**
```prisma
enum MeetingStatus {
  uploaded
  processing
  processed
  failed
}

model Meeting {
  id               String        @id @default(uuid())
  userId           String        @map("user_id")
  projectId        String?       @map("project_id")
  title            String
  meetingDate      DateTime      @map("meeting_date") @db.Date
  status           MeetingStatus @default(uploaded)
  participantNames String[]      @map("participant_names")
  errorMessage     String?       @map("error_message")
  createdAt        DateTime      @default(now()) @map("created_at")

  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  project          Project?      @relation(fields: [projectId], references: [id], onDelete: SetNull)
  transcript       Transcript?
  decisions        Decision[]
  actionItems      ActionItem[]
  blockers         Blocker[]

  @@index([userId])
  @@index([projectId])
  @@index([status])
  @@map("meetings")
}
```

---

### Table: `transcripts`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `meeting_id` | `UUID` | FK → meetings, UNIQUE (1:1) | |
| `raw_text` | `TEXT` | NOT NULL | Full transcript content |
| `char_count` | `INTEGER` | NOT NULL | For validation/analytics |
| `source` | `ENUM` | NOT NULL | `pasted`, `file_upload` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

**Example record:**
```json
{
  "id": "t_9a8b7c6d",
  "meeting_id": "m_5e6f7a8b",
  "raw_text": "Ravi: So I think we should go with GraphQL for the mobile API...",
  "char_count": 4230,
  "source": "pasted",
  "created_at": "2026-04-01T15:30:00Z"
}
```

**Prisma schema:**
```prisma
enum TranscriptSource {
  pasted
  file_upload
}

model Transcript {
  id         String           @id @default(uuid())
  meetingId  String           @unique @map("meeting_id")
  rawText    String           @map("raw_text")
  charCount  Int              @map("char_count")
  source     TranscriptSource
  createdAt  DateTime         @default(now()) @map("created_at")

  meeting    Meeting          @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  @@map("transcripts")
}
```

---

### Table: `decisions`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `meeting_id` | `UUID` | FK → meetings, NOT NULL, indexed | Source meeting |
| `text` | `TEXT` | NOT NULL | The decision statement |
| `context` | `TEXT` | NULLABLE | Surrounding discussion |
| `confidence` | `ENUM` | NOT NULL | `high`, `medium`, `low` |
| `is_final` | `BOOLEAN` | NOT NULL, default `true` | Conclusive or tentative |
| `status` | `ENUM` | NOT NULL, default `'active'` | `active`, `tentative`, `revisited`, `superseded`, `reversed` |
| `participants` | `TEXT[]` | NULLABLE | Names involved in the decision |
| `linked_prior_id` | `UUID` | FK → decisions, NULLABLE | Points to earlier decision if revisited |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

**Example record:**
```json
{
  "id": "d_abc123",
  "meeting_id": "m_5e6f7a8b",
  "text": "We will use PostgreSQL instead of MongoDB for the user service.",
  "context": "Team discussed scaling needs. Ravi argued relational fits better for our query patterns.",
  "confidence": "high",
  "is_final": true,
  "status": "active",
  "participants": ["Ravi", "Priya"],
  "linked_prior_id": null,
  "created_at": "2026-04-01T15:31:00Z"
}
```

**Prisma schema:**
```prisma
enum Confidence {
  high
  medium
  low
}

enum DecisionStatus {
  active
  tentative
  revisited
  superseded
  reversed
}

model Decision {
  id             String         @id @default(uuid())
  meetingId      String         @map("meeting_id")
  text           String
  context        String?
  confidence     Confidence
  isFinal        Boolean        @default(true) @map("is_final")
  status         DecisionStatus @default(active)
  participants   String[]
  linkedPriorId  String?        @map("linked_prior_id")
  createdAt      DateTime       @default(now()) @map("created_at")

  meeting        Meeting        @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  linkedPrior    Decision?      @relation("DecisionChain", fields: [linkedPriorId], references: [id])
  linkedNext     Decision[]     @relation("DecisionChain")
  actionItems    ActionItem[]

  @@index([meetingId])
  @@index([status])
  @@map("decisions")
}
```

---

### Table: `action_items`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `meeting_id` | `UUID` | FK → meetings, NOT NULL, indexed | Where it was assigned |
| `decision_id` | `UUID` | FK → decisions, NULLABLE | If action comes from a decision |
| `task` | `TEXT` | NOT NULL | What to do |
| `owner` | `VARCHAR(100)` | NOT NULL, default `'unassigned'` | |
| `deadline` | `DATE` | NULLABLE | |
| `priority` | `ENUM` | NOT NULL, default `'medium'` | `high`, `medium`, `low` |
| `status` | `ENUM` | NOT NULL, default `'open'` | `open`, `in_progress`, `blocked`, `done` |
| `stale_count` | `INTEGER` | NOT NULL, default `0` | Times mentioned without resolution |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

**Example record:**
```json
{
  "id": "a_def456",
  "meeting_id": "m_5e6f7a8b",
  "decision_id": "d_abc123",
  "task": "Set up PostgreSQL instance on Railway and migrate user schema",
  "owner": "Ravi",
  "deadline": "2026-04-05",
  "priority": "high",
  "status": "open",
  "stale_count": 0,
  "created_at": "2026-04-01T15:31:00Z",
  "updated_at": "2026-04-01T15:31:00Z"
}
```

**Prisma schema:**
```prisma
enum Priority {
  high
  medium
  low
}

enum ActionStatus {
  open
  in_progress
  blocked
  done
}

model ActionItem {
  id          String       @id @default(uuid())
  meetingId   String       @map("meeting_id")
  decisionId  String?      @map("decision_id")
  task        String
  owner       String       @default("unassigned")
  deadline    DateTime?    @db.Date
  priority    Priority     @default(medium)
  status      ActionStatus @default(open)
  staleCount  Int          @default(0) @map("stale_count")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  meeting     Meeting      @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  decision    Decision?    @relation(fields: [decisionId], references: [id], onDelete: SetNull)
  blockers    Blocker[]

  @@index([meetingId])
  @@index([status])
  @@index([owner])
  @@index([deadline])
  @@map("action_items")
}
```

---

### Table: `blockers`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `meeting_id` | `UUID` | FK → meetings, NOT NULL | Where it was first detected |
| `action_item_id` | `UUID` | FK → action_items, NULLABLE | What it's blocking |
| `description` | `TEXT` | NOT NULL | |
| `blocked_owner` | `VARCHAR(100)` | NOT NULL | Who is stuck |
| `blocking_entity` | `VARCHAR(200)` | NOT NULL | Who/what is causing it |
| `status` | `ENUM` | NOT NULL, default `'active'` | `active`, `resolved` |
| `detected_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |
| `resolved_at` | `TIMESTAMPTZ` | NULLABLE | When it was resolved |

**Example record:**
```json
{
  "id": "b_ghi789",
  "meeting_id": "m_5e6f7a8b",
  "action_item_id": "a_def456",
  "description": "Waiting for DevOps to approve Railway production tier",
  "blocked_owner": "Ravi",
  "blocking_entity": "DevOps team",
  "status": "active",
  "detected_at": "2026-04-01T15:31:00Z",
  "resolved_at": null
}
```

**Prisma schema:**
```prisma
enum BlockerStatus {
  active
  resolved
}

model Blocker {
  id              String        @id @default(uuid())
  meetingId       String        @map("meeting_id")
  actionItemId    String?       @map("action_item_id")
  description     String
  blockedOwner    String        @map("blocked_owner")
  blockingEntity  String        @map("blocking_entity")
  status          BlockerStatus @default(active)
  detectedAt      DateTime      @default(now()) @map("detected_at")
  resolvedAt      DateTime?     @map("resolved_at")

  meeting         Meeting       @relation(fields: [meetingId], references: [id], onDelete: Cascade)
  actionItem      ActionItem?   @relation(fields: [actionItemId], references: [id], onDelete: SetNull)

  @@index([meetingId])
  @@index([status])
  @@map("blockers")
}
```

---

### Table: `followups`

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `source_meeting_id` | `UUID` | FK → meetings, NOT NULL | Where the item was originally created |
| `target_meeting_id` | `UUID` | FK → meetings, NOT NULL | Where it was referenced again |
| `item_type` | `ENUM` | NOT NULL | `decision`, `action_item`, `blocker` |
| `item_id` | `UUID` | NOT NULL | FK to specific item (logical, not enforced) |
| `resolution` | `ENUM` | NOT NULL | `resolved`, `updated`, `still_open`, `escalated` |
| `notes` | `TEXT` | NULLABLE | LLM-generated context |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default `NOW()` | |

**Example record:**
```json
{
  "id": "f_jkl012",
  "source_meeting_id": "m_5e6f7a8b",
  "target_meeting_id": "m_next123",
  "item_type": "action_item",
  "item_id": "a_def456",
  "resolution": "resolved",
  "notes": "Ravi confirmed the PostgreSQL setup is complete. Migration was done on April 4.",
  "created_at": "2026-04-07T10:00:00Z"
}
```

**Prisma schema:**
```prisma
enum FollowupItemType {
  decision
  action_item
  blocker
}

enum FollowupResolution {
  resolved
  updated
  still_open
  escalated
}

model Followup {
  id              String             @id @default(uuid())
  sourceMeetingId String             @map("source_meeting_id")
  targetMeetingId String             @map("target_meeting_id")
  itemType        FollowupItemType   @map("item_type")
  itemId          String             @map("item_id")
  resolution      FollowupResolution
  notes           String?
  createdAt       DateTime           @default(now()) @map("created_at")

  sourceMeeting   Meeting            @relation("FollowupSource", fields: [sourceMeetingId], references: [id], onDelete: Cascade)
  targetMeeting   Meeting            @relation("FollowupTarget", fields: [targetMeetingId], references: [id], onDelete: Cascade)

  @@index([sourceMeetingId])
  @@index([targetMeetingId])
  @@index([itemId])
  @@map("followups")
}
```

> [!IMPORTANT]
> Add the Followup relations to the Meeting model:
> ```prisma
> // Add to Meeting model:
> followupsAsSource Followup[] @relation("FollowupSource")
> followupsAsTarget Followup[] @relation("FollowupTarget")
> ```

---

### Key Queries You'll Run Often

These are the actual SQL/Prisma queries your dashboard and API will use daily. Designing around them now avoids painful refactors later.

**1. Dashboard summary stats:**
```typescript
const summary = await Promise.all([
  prisma.meeting.count({ where: { userId } }),
  prisma.actionItem.count({
    where: { meeting: { userId }, status: "open" }
  }),
  prisma.actionItem.count({
    where: {
      meeting: { userId },
      status: { not: "done" },
      deadline: { lt: new Date() }
    }
  }),
  prisma.blocker.count({
    where: { meeting: { userId }, status: "active" }
  }),
  prisma.actionItem.count({
    where: { meeting: { userId }, staleCount: { gte: 3 } }
  }),
]);
// Returns: [totalMeetings, openActions, overdueActions, activeBlockers, staleItems]
```

**2. Action items filtered by status + owner:**
```typescript
const actions = await prisma.actionItem.findMany({
  where: {
    meeting: { userId },
    ...(status && { status }),
    ...(owner && { owner }),
  },
  include: {
    meeting: { select: { title: true, meetingDate: true } },
    decision: { select: { text: true } },
    blockers: { where: { status: "active" } },
  },
  orderBy: [
    { deadline: "asc" },        // Soonest deadline first
    { priority: "asc" },        // Then by priority
  ],
});
```

**3. Meeting detail with all extractions:**
```typescript
const meeting = await prisma.meeting.findUnique({
  where: { id: meetingId },
  include: {
    transcript: true,
    decisions: { orderBy: { createdAt: "asc" } },
    actionItems: {
      include: { blockers: true },
      orderBy: { priority: "asc" },
    },
    blockers: { orderBy: { detectedAt: "asc" } },
    followupsAsTarget: {
      include: { sourceMeeting: { select: { title: true } } },
    },
  },
});
```

**4. Cross-meeting: all open items for a user (used by M8):**
```typescript
const openItems = {
  actions: await prisma.actionItem.findMany({
    where: {
      meeting: { userId },
      status: { in: ["open", "in_progress", "blocked"] },
    },
    select: { id: true, task: true, owner: true, status: true },
  }),
  decisions: await prisma.decision.findMany({
    where: {
      meeting: { userId },
      status: { in: ["active", "tentative"] },
    },
    select: { id: true, text: true, status: true },
  }),
  blockers: await prisma.blocker.findMany({
    where: { meeting: { userId }, status: "active" },
    select: { id: true, description: true, blockedOwner: true },
  }),
};
```

**5. Stale items (mentioned 3+ times without resolution):**
```typescript
const staleItems = await prisma.actionItem.findMany({
  where: {
    meeting: { userId },
    staleCount: { gte: 3 },
    status: { not: "done" },
  },
  include: {
    meeting: { select: { title: true } },
  },
  orderBy: { staleCount: "desc" },
});
```

---

## 8. TECH STACK

### Full Stack Table

| Layer | Choice | Version | Why This Specifically |
|---|---|---|---|
| **Runtime** | Node.js | 20 LTS | Stable, universal, matches Next.js requirement |
| **Language** | TypeScript | 5.x | Catches bugs at compile time. Prisma generates types from your schema — your DB, API, and frontend all share the same types. Eliminates an entire class of runtime errors. |
| **Framework** | Next.js (App Router) | 14.x | One repo = frontend + backend. File-based routing. Server components for fast dashboard loads. API routes replace the need for Express. Deploy to Vercel in one click. |
| **Styling** | Tailwind CSS | 3.x | Utility-first = fast iteration. No context-switching between files for CSS. shadcn/ui gives you pre-built components styled with Tailwind. |
| **UI Components** | shadcn/ui | latest | Not a dependency — it copies component source into your project. Cards, tables, badges, dialogs, dropdowns, tabs — everything you need for the dashboard. Fully customizable since you own the code. |
| **Database** | PostgreSQL | 15+ | Relational = perfect for this data model (heavy use of FKs, JOINs, filtering). Postgres-specific features used: `TEXT[]` for arrays, `ENUM` for status fields, `DATE` type, indexes. |
| **DB Hosting** | Neon | free tier | Serverless Postgres — no always-on server cost. Free tier: 512 MB storage, 100 hours compute. Pairs perfectly with Vercel's serverless model. Auto-scales to zero when idle. |
| **ORM** | Prisma | 5.x | Schema-as-code → auto migrations → auto-generated TypeScript types. Write `prisma.actionItem.findMany()` instead of raw SQL. Handles relations, filtering, pagination out of the box. |
| **Auth** | NextAuth.js (Auth.js) | 5.x | Built for Next.js. Credentials provider (email/password) for MVP. Can add Google OAuth in 10 lines later. Session management, JWT, middleware protection — all handled. |
| **Password Hashing** | bcrypt | latest | Industry standard. 12 rounds. Never roll your own. |
| **LLM** | OpenAI API (gpt-4o-mini) | latest | Best JSON output reliability. `response_format: { type: "json_object" }` ensures structured output. Cost: ~$0.15/1M input tokens = ~$0.001 per meeting transcript. Fast (2–5 seconds per call). |
| **LLM Client** | openai (npm) | 4.x | Official SDK. Type-safe. Handles retries, streaming, rate limits. |
| **Date Parsing** | chrono-node | 2.x | Parses "next Friday", "end of March", "April 15th" into JS Date objects. Lightweight (no heavy dependencies). Used as fallback when LLM date parsing is ambiguous. |
| **Validation** | Zod | 3.x | Validate LLM responses against a schema before saving to DB. Also validate API request bodies. Type-safe — infers TypeScript types from schemas. |
| **Deployment** | Vercel | hobby (free) | One `git push` = deployed. Automatic HTTPS, preview URLs per branch, serverless functions for API routes, edge network for static assets. Zero DevOps work. |
| **Version Control** | Git + GitHub | — | Required for Vercel deployment. Also portfolio visibility. |

### What You'll Install

```bash
# Create the project
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm

# Core dependencies
npm install prisma @prisma/client    # ORM
npm install next-auth@beta           # Auth (v5)
npm install bcrypt                   # Password hashing
npm install openai                   # LLM client
npm install zod                      # Validation
npm install chrono-node              # Date parsing

# UI components (shadcn/ui — run init, then add what you need)
npx shadcn-ui@latest init
npx shadcn-ui@latest add card table badge button input tabs dialog dropdown-menu select toast

# Dev dependencies
npm install -D @types/bcrypt         # Type definitions
npx prisma init                      # Initialize Prisma
```

### Cost Breakdown (MVP Phase)

| Service | Free Tier Limit | Your MVP Usage | Monthly Cost |
|---|---|---|---|
| Vercel | 100 GB bandwidth, serverless functions | Well under limit | **$0** |
| Neon (Postgres) | 512 MB, 100 compute hours | ~50 meetings = ~5 MB | **$0** |
| OpenAI (gpt-4o-mini) | Pay-as-you-go | ~100 meetings = ~$0.10 | **~$0.10** |
| GitHub | Unlimited public repos | 1 repo | **$0** |
| **Total** | | | **~$0.10/month** |

---

## 9. BACKEND / FRONTEND ARCHITECTURE

### Guiding Principle

```
One repo. One framework. One deployment.
Modules are functions, not services.
```

Everything lives in a single Next.js 14 project. The "backend" is API routes inside the same repo. The "frontend" is React server/client components in the same repo. They share types, they share validation schemas, they deploy together.

### Project Structure

```
decisio/
├── src/
│   ├── app/                          # ROUTES (pages + API)
│   │   ├── layout.tsx                # Root layout: sidebar nav, auth provider
│   │   ├── page.tsx                  # Dashboard (server component)
│   │   │
│   │   ├── meetings/
│   │   │   ├── page.tsx              # Meeting list (server component)
│   │   │   ├── new/
│   │   │   │   └── page.tsx          # Upload form (client component)
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Meeting detail (server component)
│   │   │
│   │   ├── actions/
│   │   │   └── page.tsx              # Action board (client component — interactive)
│   │   │
│   │   ├── decisions/
│   │   │   └── page.tsx              # Decision log (server component)
│   │   │
│   │   ├── blockers/
│   │   │   └── page.tsx              # Blocker tracker (client component)
│   │   │
│   │   ├── projects/
│   │   │   ├── page.tsx              # Project list
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Project detail
│   │   │
│   │   └── api/                      # API ROUTES (backend)
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts      # NextAuth handler
│   │       ├── meetings/
│   │       │   ├── route.ts          # GET: list, POST: create
│   │       │   └── [id]/
│   │       │       ├── route.ts      # GET: detail
│   │       │       └── process/
│   │       │           └── route.ts  # POST: trigger LLM extraction
│   │       ├── actions/
│   │       │   └── [id]/
│   │       │       └── route.ts      # PATCH: update status/owner/deadline
│   │       ├── blockers/
│   │       │   └── [id]/
│   │       │       └── route.ts      # PATCH: resolve
│   │       ├── projects/
│   │       │   └── route.ts          # GET: list, POST: create
│   │       └── dashboard/
│   │           └── summary/
│   │               └── route.ts      # GET: aggregate stats
│   │
│   ├── lib/                          # SHARED LOGIC (the "backend brain")
│   │   ├── db.ts                     # Prisma client singleton
│   │   ├── openai.ts                 # OpenAI client singleton
│   │   ├── auth.ts                   # NextAuth configuration
│   │   │
│   │   ├── extraction/               # CORE EXTRACTION MODULES
│   │   │   ├── pipeline.ts           # M2: Orchestrator — calls LLM, validates, saves
│   │   │   ├── prompt.ts             # LLM prompt templates
│   │   │   ├── cross-meeting.ts      # M8: Cross-meeting comparison
│   │   │   ├── date-parser.ts        # M6: Deadline parsing with chrono-node
│   │   │   └── owner-normalizer.ts   # M5: Name normalization
│   │   │
│   │   ├── schemas/                  # ZOD VALIDATION SCHEMAS
│   │   │   ├── extraction.ts         # Validate LLM response shape
│   │   │   ├── meeting.ts            # Validate meeting creation input
│   │   │   └── action.ts             # Validate action update input
│   │   │
│   │   └── utils/
│   │       ├── errors.ts             # Custom error classes + handler
│   │       └── api-response.ts       # Consistent API response format
│   │
│   ├── components/                   # REUSABLE UI COMPONENTS
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   │   ├── Header.tsx            # Page header with breadcrumbs
│   │   │   └── AuthProvider.tsx      # Session provider wrapper
│   │   │
│   │   ├── dashboard/
│   │   │   ├── StatCard.tsx          # Single metric card
│   │   │   ├── AttentionList.tsx     # Items needing attention
│   │   │   └── RecentMeetings.tsx    # Recent meeting snippets
│   │   │
│   │   ├── meetings/
│   │   │   ├── MeetingCard.tsx       # Meeting list item
│   │   │   ├── UploadForm.tsx        # Transcript upload form
│   │   │   ├── ProcessingStatus.tsx  # Loading animation during extraction
│   │   │   └── TranscriptView.tsx    # Left-panel transcript display
│   │   │
│   │   ├── extraction/
│   │   │   ├── DecisionCard.tsx      # Single decision display
│   │   │   ├── ActionTable.tsx       # Action items table with filters
│   │   │   ├── ActionRow.tsx         # Single action item row
│   │   │   ├── BlockerAlert.tsx      # Single blocker display
│   │   │   └── CrossMeetingLink.tsx  # Followup reference badge
│   │   │
│   │   └── shared/
│   │       ├── StatusBadge.tsx       # Colored status pill
│   │       ├── PriorityBadge.tsx     # Priority indicator
│   │       ├── ConfidenceBadge.tsx   # Confidence level indicator
│   │       ├── EmptyState.tsx        # "No data yet" placeholder
│   │       └── OverdueBadge.tsx      # Red "X days overdue" pill
│   │
│   └── types/                        # TYPESCRIPT TYPES
│       └── index.ts                  # Shared types (augmenting Prisma-generated ones)
│
├── prisma/
│   ├── schema.prisma                 # Database schema (single source of truth)
│   └── seed.ts                       # Demo data seeder (for Day 13)
│
├── public/                           # Static assets
│   └── logo.svg
│
├── .env                              # Environment variables (gitignored)
├── .env.example                      # Template for env vars (committed)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

### Backend Architecture: How API Routes Work

**Each API route is a file that exports HTTP method handlers:**

```typescript
// src/app/api/meetings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { meetingCreateSchema } from "@/lib/schemas/meeting";

// GET /api/meetings — List all meetings for the current user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetings = await prisma.meeting.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { decisions: true, actionItems: true, blockers: true },
      },
    },
    orderBy: { meetingDate: "desc" },
  });

  return NextResponse.json({ meetings });
}

// POST /api/meetings — Create a new meeting + trigger processing
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = meetingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, meetingDate, projectId, transcript } = parsed.data;

  // 1. Create meeting + transcript in a transaction
  const meeting = await prisma.meeting.create({
    data: {
      userId: session.user.id,
      title,
      meetingDate: new Date(meetingDate),
      projectId: projectId || null,
      status: "processing",
      transcript: {
        create: {
          rawText: transcript,
          charCount: transcript.length,
          source: "pasted",
        },
      },
    },
  });

  // 2. Trigger extraction asynchronously (don't await — return immediately)
  processTranscript(meeting.id).catch((err) => {
    console.error(`Processing failed for meeting ${meeting.id}:`, err);
    prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: "failed", errorMessage: err.message },
    });
  });

  return NextResponse.json({ meetingId: meeting.id, status: "processing" }, { status: 201 });
}
```

**Extraction pipeline (the core "backend brain"):**

```typescript
// src/lib/extraction/pipeline.ts

import { prisma } from "@/lib/db";
import { openai } from "@/lib/openai";
import { buildExtractionPrompt } from "./prompt";
import { extractionResponseSchema } from "@/lib/schemas/extraction";
import { parseDeadline } from "./date-parser";
import { normalizeOwner } from "./owner-normalizer";
import { runCrossMeetingCheck } from "./cross-meeting";

export async function processTranscript(meetingId: string) {
  // 1. Fetch meeting + transcript
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { transcript: true },
  });
  if (!meeting?.transcript) throw new Error("Meeting or transcript not found");

  // 2. Call LLM
  const prompt = buildExtractionPrompt(
    meeting.transcript.rawText,
    meeting.meetingDate.toISOString().split("T")[0]
  );

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4000,
  });

  const rawJson = JSON.parse(response.choices[0].message.content!);

  // 3. Validate with Zod
  const parsed = extractionResponseSchema.safeParse(rawJson);
  if (!parsed.success) {
    // Retry once with stricter prompt
    // ... retry logic ...
    throw new Error("LLM response validation failed after retry");
  }

  const data = parsed.data;

  // 4. Get existing participant names for owner normalization
  const existingNames = await getExistingParticipantNames(meeting.userId);

  // 5. Save decisions
  for (const decision of data.decisions) {
    await prisma.decision.create({
      data: {
        meetingId,
        text: decision.text,
        context: decision.context || null,
        confidence: decision.confidence,
        isFinal: decision.is_final,
        status: decision.is_final ? "active" : "tentative",
        participants: decision.participants,
      },
    });
  }

  // 6. Save action items
  for (const action of data.action_items) {
    const normalizedOwner = normalizeOwner(action.owner, existingNames);
    const parsedDeadline = action.deadline
      ? parseDeadline(action.deadline, meeting.meetingDate)
      : null;

    await prisma.actionItem.create({
      data: {
        meetingId,
        task: action.task,
        owner: normalizedOwner,
        deadline: parsedDeadline,
        priority: action.priority,
        status: "open",
      },
    });
  }

  // 7. Save blockers
  for (const blocker of data.blockers) {
    await prisma.blocker.create({
      data: {
        meetingId,
        description: blocker.description,
        blockedOwner: blocker.blocked_owner,
        blockingEntity: blocker.blocking_entity,
        status: "active",
      },
    });
  }

  // 8. Update meeting status
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: "processed",
      participantNames: data.participants_detected,
    },
  });

  // 9. Cross-meeting check (if past meetings exist)
  const pastMeetingCount = await prisma.meeting.count({
    where: { userId: meeting.userId, status: "processed", id: { not: meetingId } },
  });
  if (pastMeetingCount > 0) {
    await runCrossMeetingCheck(meetingId, meeting.userId);
  }
}
```

### Frontend Architecture: Component Patterns

**Server vs. client components — when to use which:**

| Use Server Component | Use Client Component |
|---|---|
| Dashboard page (read-only data display) | Upload form (user input, file handling) |
| Meeting list (query DB directly, no interactivity) | Action board (status toggles, inline editing) |
| Decision log (read-only, filtered server-side) | Blocker tracker (resolve button interactions) |
| Meeting detail transcript view | Processing status poller (needs `useEffect`) |
| Any page where data is fetched and rendered | Any page with buttons, dropdowns, or state |

**Server component example (dashboard):**

```tsx
// src/app/page.tsx — Dashboard (server component, NO "use client")

import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StatCard } from "@/components/dashboard/StatCard";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { RecentMeetings } from "@/components/dashboard/RecentMeetings";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const userId = session.user.id;

  // Query directly — no API call needed. This runs on the server.
  const [totalMeetings, openActions, overdueActions, activeBlockers] =
    await Promise.all([
      prisma.meeting.count({ where: { userId } }),
      prisma.actionItem.count({
        where: { meeting: { userId }, status: "open" },
      }),
      prisma.actionItem.count({
        where: {
          meeting: { userId },
          status: { not: "done" },
          deadline: { lt: new Date() },
        },
      }),
      prisma.blocker.count({
        where: { meeting: { userId }, status: "active" },
      }),
    ]);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Meetings" value={totalMeetings} icon="calendar" />
        <StatCard label="Open Actions" value={openActions} icon="list" />
        <StatCard label="Overdue" value={overdueActions} icon="alert" variant="warning" />
        <StatCard label="Blockers" value={activeBlockers} icon="block" variant="danger" />
      </div>

      <AttentionList userId={userId} />
      <RecentMeetings userId={userId} />
    </div>
  );
}
```

**Client component example (action status toggle):**

```tsx
// src/components/extraction/ActionRow.tsx

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ActionStatus = "open" | "in_progress" | "blocked" | "done";

interface ActionRowProps {
  id: string;
  task: string;
  owner: string;
  deadline: string | null;
  status: ActionStatus;
  isOverdue: boolean;
}

export function ActionRow({ id, task, owner, deadline, status: initialStatus, isOverdue }: ActionRowProps) {
  const [status, setStatus] = useState<ActionStatus>(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleStatusChange(newStatus: ActionStatus) {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setStatus(newStatus);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <tr className={isOverdue ? "bg-red-50 dark:bg-red-950/20" : ""}>
      <td className="p-3">{task}</td>
      <td className="p-3">{owner}</td>
      <td className="p-3">
        {deadline || "—"}
        {isOverdue && <Badge variant="destructive" className="ml-2">Overdue</Badge>}
      </td>
      <td className="p-3">
        <Select value={status} onValueChange={handleStatusChange} disabled={isUpdating}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}
```

### Data Flow: How It All Connects

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│                                                              │
│  Server Components              Client Components            │
│  ────────────────              ──────────────────            │
│  Dashboard page ─────────┐    Upload form ──────────┐       │
│  Meeting list             │    Action board           │       │
│  Decision log             │    Blocker tracker        │       │
│  (fetch data directly     │    Status toggles         │       │
│   from Prisma on server)  │    (call API via fetch)   │       │
│                           │                           │       │
└───────────┬───────────────┘───────────┬───────────────┘──────┘
            │                           │
            │ direct DB query           │ HTTP request
            │ (server-side only)        │ (client → server)
            ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER                            │
│                                                              │
│  ┌───────────────────┐    ┌──────────────────────┐          │
│  │ Server Components │    │ API Routes            │          │
│  │ render on server  │    │ /api/meetings         │          │
│  │ with direct DB    │    │ /api/actions/:id      │          │
│  │ access            │    │ /api/dashboard/summary│          │
│  └────────┬──────────┘    └──────────┬───────────┘          │
│           │                          │                       │
│           └──────────┬───────────────┘                       │
│                      │                                       │
│                      ▼                                       │
│  ┌────────────────────────────────────────┐                  │
│  │ lib/ (shared logic)                    │                  │
│  │                                        │                  │
│  │  db.ts ──────────▶ Prisma Client       │                  │
│  │  openai.ts ──────▶ OpenAI Client       │                  │
│  │  extraction/                           │                  │
│  │    pipeline.ts ──▶ Orchestrator        │                  │
│  │    prompt.ts ────▶ Prompt Templates    │                  │
│  │    cross-meeting ▶ M8 Logic            │                  │
│  │  schemas/ ───────▶ Zod Validation      │                  │
│  └────────────────────┬───────────────────┘                  │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │
            ┌───────────┼───────────┐
            ▼                       ▼
    ┌──────────────┐       ┌──────────────┐
    │  PostgreSQL  │       │  OpenAI API  │
    │  (Neon)      │       │  (gpt-4o-    │
    │              │       │   mini)      │
    └──────────────┘       └──────────────┘
```

### Key Architecture Decisions (and Why)

**1. No separate backend server.**
Next.js API routes ARE the backend. Same repo, same deploy, same language. You'll never need Express for this MVP. If you hit a scaling wall at 10,000 users, extract then. You won't hit that wall.

**2. Server components for read-heavy pages, client components for interactive ones.**
Dashboard loads fast because it queries the DB directly on the server — no API round-trip, no loading spinner, no waterfall. Action board uses client components because users click status toggles.

**3. Prisma as the single source of truth.**
Your `schema.prisma` file defines the database schema AND generates TypeScript types. When you add a field to the schema, your IDE autocompletes it everywhere. When you remove a field, your code breaks at compile time — not in production.

**4. Zod for LLM response validation.**
LLMs hallucinate structure. They'll randomly omit a field, nest an array inside a string, or add fields you didn't ask for. Zod catches all of this before it hits your database. Define the schema once, validate every LLM response against it.

**5. Processing is fire-and-forget with error capture.**
When a user uploads a meeting, the API returns immediately with `{ status: "processing" }`. The LLM call runs in the background. If it fails, the meeting status is set to `"failed"` with an error message. The frontend polls `/api/meetings/:id/status` every 2 seconds until it sees `"processed"` or `"failed"`.

### Environment Variables

```bash
# .env (NEVER commit this file)

# Database
DATABASE_URL="postgresql://user:pass@ep-something.us-east-2.aws.neon.tech/decisio?sslmode=require"

# Auth
NEXTAUTH_SECRET="generate-a-random-32-char-string"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI
OPENAI_API_KEY="sk-..."

# .env.example (commit this file — template for other developers)
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="sk-..."
```

---

*End of Part 3. Next: 14-Day Build Plan and Recruiter/Startup Positioning.*
