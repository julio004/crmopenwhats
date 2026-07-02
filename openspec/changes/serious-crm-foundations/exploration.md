## Exploration: serious CRM foundations

### Current State
This repo is already more than a prompt-only inbox: it has a real PostgreSQL-backed conversation/message model, Redis turn-state, Baileys ingestion, a follow-up loop, simple CRM tasks, saved prompts, safe automations, and a Next.js dashboard. But the data model is still conversation-centric, not CRM-centric. `conversations` is acting as both WhatsApp thread and contact record, `crm_tasks` links only to `conversation_id`, and there are no tables or APIs for users, teams, memberships, companies/accounts, deals, pipelines, stages, or ownership. Security is still single-admin: `src/app/api/auth/login/route.ts` sets `bot_session` to the raw `ADMIN_PASSWORD`, and `src/middleware.ts` authorizes by comparing the cookie value directly to `process.env.ADMIN_PASSWORD`. Operationally, there is some audit signal (`conversation_events`) but no general activity log, no delivery receipts/state machine beyond `outbox.sent` 0/1/2, no structured observability stack, and background work runs in-process via `setInterval`, `setTimeout`, Redis locks, and file-flag restarts.

### Affected Areas
- `src/middleware.ts` — current auth is a single shared password cookie, no user/session/team authorization boundary.
- `src/app/api/auth/login/route.ts` — login issues the raw admin password as the session token.
- `src/lib/db-contract.ts` — schema defines conversations/messages/events/tasks/automations, but no CRM core entities or RBAC tables.
- `src/lib/db.ts` — large repository facade mixes chat, settings, prompts, automations, tasks, connection state, and outbox in one module.
- `src/lib/baileys/inbound-handler.ts` — inbound flow is already channel-orchestration friendly and can keep working if CRM ownership/contact mapping is introduced below it.
- `src/lib/followup-scheduler.ts` — follow-up runtime already depends on contracts, but today only understands conversation-level state.
- `scripts/start-bot.ts` — operational runtime is process-local and restart-driven, not job-runner-grade.
- `scripts/followups-cron.ts` — scheduler loop is in-process, with no persisted runs, retries, or job history.
- `src/app/api/conversations/*.ts` — dashboard APIs expose conversation records as the main CRM object.
- `src/components/ContactsOverview.tsx` — “contacts CRM” UI is literally a filtered view of conversations.
- `src/components/DashboardOverview.tsx` — reporting is client-derived from conversation snapshots, not from CRM/activity facts.
- `src/lib/crm-tasks.ts` and `src/app/api/tasks/*.ts` — task system exists, but it is lightweight and conversation-bound.

### Approaches
1. **Keep extending the conversation-centric model** — Add more columns to `conversations` and continue treating WhatsApp threads as the CRM backbone.
   - Pros: Lowest short-term churn; fits current UI and APIs; easiest to ship tiny slices.
   - Cons: Bakes channel identity into CRM identity; makes multi-contact accounts, deal pipelines, team ownership, and non-WhatsApp future channels awkward; increases `conversations`/`db.ts` coupling.
   - Effort: Medium

2. **Introduce a CRM core beneath existing chat flows** — Keep the current inbound/follow-up architecture, but add real CRM entities and map conversations to them.
   - Pros: Fits the repo’s current contract-oriented orchestration; preserves WhatsApp runtime while unlocking users/teams, contacts/accounts/deals, ownership, pipelines, reporting, and automation growth.
   - Cons: Requires schema expansion, repository refactoring, and transitional APIs/UI because current screens assume conversation == contact.
   - Effort: High

### Recommendation
Use **Approach 2**, but in dependency-ordered slices that preserve the current channel architecture:

1. **Security foundation first**: replace shared-password cookie auth with real `users`, `teams`, `memberships`, hashed passwords, server-issued sessions, and route-level authorization.
2. **CRM identity core second**: add `contacts`, `accounts`, `contact_methods`, `conversation_links`, and `owners` without breaking existing `conversations` APIs yet.
3. **Work management third**: add `pipelines`, `stages`, `deals`, `deal_stage_history`, and re-home `crm_tasks` so tasks can belong to deals/contacts/conversations.
4. **Operational truth fourth**: add `activity_log`, richer `outbox` delivery state, and reporting-ready facts instead of client-only aggregates.
5. **Runtime hardening fifth**: move in-process automation/follow-up execution toward persisted job execution with observable runs/retries.
6. **Refactor boundary last**: split `src/lib/db.ts` into domain repositories/services once the new schema exists, instead of doing a speculative refactor first.

What can stay: the injected-contract style in `inbound-handler.ts`, `followup-scheduler.ts`, Redis locks, and channel ingestion flow. What needs refactor: auth, data model, `db.ts` concentration, conversation-as-contact assumptions in APIs/UI, and weak operational state modeling.

### Risks
- The biggest structural risk is keeping `conversation` as the primary CRM identity for too long; that will make companies, multiple contacts per account, shared ownership, and deals painful.
- Auth is currently unsafe for a serious CRM because one leaked cookie/password grants full access and there is no per-user audit trail.
- Reporting built from `listConversations()` snapshots will produce misleading CRM metrics once deals, owners, and stage history exist.
- The current in-process scheduler/outbox loops are fine for a bot, but risky for CRM-grade automation because there is no durable job history, retry policy, or operator visibility.

### Ready for Proposal
Yes — the codebase is clear enough to propose a dependency-ordered foundation change. The orchestrator should tell the user the safest proposal is a staged CRM-core migration that keeps WhatsApp ingestion intact while replacing auth first, then introducing CRM entities before pipelines/deals/reporting/runtime hardening.
