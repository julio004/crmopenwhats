# Tasks: normalize-whatsapp-turns-followups

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 changed lines across OpenSpec artifacts |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR: OpenSpec artifact amendment only |
| Delivery strategy | single-pr |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

## Context and Constraints

- Repository now has application code and `npm test`; this task only updates OpenSpec artifacts and must not edit app code.
- This change updates the active OpenSpec artifacts first; app code and any prompt/documentation implementation remain separate apply work.
- Do not implement app code, migrations, or tests in this OpenSpec artifact amendment.
- Keep the OpenSpec artifact amendment under the 400 changed-line review budget.

## Implementation Tasks

### 1. RED — Build a document-review checklist from accepted specs

- [ ] Create a temporary reviewer checklist from:
  - `openspec/changes/normalize-whatsapp-turns-followups/proposal.md`
  - `openspec/changes/normalize-whatsapp-turns-followups/specs/whatsapp-automation/spec.md`
  - `openspec/changes/normalize-whatsapp-turns-followups/design.md`
  - current implementation and prior apply notes
- [ ] Checklist must explicitly flag current implementation/prior artifacts for these known conflicts:
  - any implementation or prior artifact that filters all `msg.key.fromMe === true` messages.
  - customer-triggered administrative mode changes such as `humano`, `asesor`, or `Ok.`.
  - incomplete `conversations`/`messages` DDL for role/source/timestamp/follow-up decisions.
  - missing durable `settings` for `bot_on_keyword` and optional audit/event model.
  - missing Redis key conventions/TTL cleanup boundaries.
  - follow-ups lacking 12-hour due evaluation, active-turn collision checks, and 24-hour free-form boundary handling.
  - missing DeepSeek strict JSON fallback behavior.
- [ ] Verification: reviewer can point to each failing current implementation/prior-artifact section before any code or prompt/documentation edit is made.

### 2. GREEN — Update behavior for owner intervention and activation

- [ ] Revise the high-level inbound behavior so there is no configurable word for deactivation.
- [ ] State that owner WhatsApp messages (`fromMe === true`) are persisted as `role='human'`.
- [ ] State that if normalized owner text matches `bot_on_keyword` (`ok.` by default), the chat changes to `AI`.
- [ ] State that every other owner WhatsApp message changes or refreshes that chat as `HUMAN`/bot silent, updates human intervention timestamps, and may use Redis transient label-like state for runtime checks while PostgreSQL remains the durable source of truth.
- [ ] State that customer messages matching `ok.` or administrative-looking values are normal `user` messages; customer handoff intent remains a separate AI/business decision.
- [ ] Verification: document diff shows no remaining instruction that customer text alone administratively toggles bot mode and no removed deactivation setting remains.

### 3. GREEN — Update PostgreSQL schema and helper contracts in OpenSpec

- [ ] Specify/confirm the DDL requirements in OpenSpec for `conversations` with fields for `jid`, `mode_reason`, `mode_changed_at`, `mode_changed_by`, follow-up blocked metadata, source-specific timestamps, owner intervention, and AI reactivation timestamp.
- [ ] Specify/confirm the DDL for `messages` with `whatsapp_message_id`, `direction`, `role`, `media_type`, `source`, `from_me`, `raw_timestamp`, `metadata`, and a unique index for WhatsApp message IDs.
- [ ] Add the `settings` table and required defaults for `bot_on_keyword`, debounce/lock TTLs, 12-hour follow-up due interval, follow-up limits, and 24-hour boundary behavior.
- [ ] Add optional `conversation_events` audit table or clearly specify the minimum conversation fields used when audit events are deferred.
- [ ] Update DB helper names/contracts in OpenSpec to include transactional insert/update, settings access, mode changes with reason/actor, recent history, follow-up candidates, attempt increments, and event recording if present.
- [ ] Verification: schema supports every role, timestamp, mode, follow-up, dedupe, and owner reactivation scenario in `spec.md`.

### 4. GREEN — Add Redis transient-state conventions to OpenSpec

- [ ] Add Redis key prefix `wa:v1:` and document keys for:
  - message deduplication by WhatsApp message ID;
  - per-conversation debounce queue;
  - debounce timer marker;
  - processing lock and processing state;
  - global follow-up runner lock;
  - per-conversation follow-up lock.
- [ ] Document TTLs and token-safe release for locks.
- [ ] Document finalization cleanup boundaries: delete transient turn keys only; never delete PostgreSQL history, `./auth/`, Baileys state, or durable conversation mode.
- [ ] Verification: document review can distinguish transient Redis state from durable PostgreSQL state.

### 5. GREEN — Rewrite inbound handler lifecycle in OpenSpec

- [ ] Ensure the OpenSpec lifecycle and future implementation plan include:
  - receive/filter valid 1:1 `messages.upsert` notifications;
  - dedupe by WhatsApp message ID before persistence;
  - persist accepted messages before DeepSeek calls;
  - assign `user` vs `human` role correctly;
  - process owner activation keyword `ok.`;
  - switch/refresh `HUMAN` mode for any owner message that does not match the activation keyword;
  - refresh owner intervention timestamps before finalizing the owner turn;
  - ensure non-activation owner messages never reactivate and always refresh intervention/off state;
  - skip AI when conversation is `HUMAN`;
  - debounce customer messages in `AI` mode;
  - load recent history and active prompt before DeepSeek;
  - send validated response parts and persist `assistant` messages;
  - handle AI handoff to `HUMAN`;
  - finalize transient state idempotently without touching Baileys auth.
- [ ] Verification: the old blanket `fromMe` filter is removed or explicitly rejected.

### 6. GREEN — Rewrite follow-up scheduler behavior in OpenSpec

- [ ] Update the follow-up scheduler specification to match local scheduler parity with `seguimiento.json` while using Baileys/PostgreSQL/Redis/DeepSeek.
- [ ] Document candidate rules:
  - `mode='AI'`;
  - latest visible message is `assistant`;
  - no `user` message after that assistant message;
  - `followup_attempts < 2` or configured max;
  - 12-hour due interval rather than a 24-hour wait after the assistant message;
  - inside 24-hour customer interaction window when blocking is enabled;
  - no active Redis queue/debounce/lock/processing state;
  - follow-up lock acquired.
- [ ] Document strict DeepSeek follow-up JSON contract `{ "respuesta": "SI" | "NO", "mensaje": "..." }` and safe invalid-JSON behavior.
- [ ] Document that user replies reset/cancel follow-up attempts and inbound turns take priority over scheduler sends.
- [ ] Verification: document diff covers all follow-up scenarios in `spec.md`, including 12-hour due checks, collision, and 24-hour blocking.

### 7. GREEN — Add DeepSeek contracts and safe fallback rules to OpenSpec

- [ ] Document normal reply JSON contract with `response.part_1..part_3` and optional `handoff.required/reason`.
- [ ] Require strict parsing, validated non-empty string parts, ordered sending, and no raw unvalidated LLM text.
- [ ] Add retry/repair behavior for malformed normal reply JSON and safe handoff fallback if retry fails.
- [ ] Add malformed follow-up JSON behavior: send nothing and record skip/audit.
- [ ] Verification: reviewer can verify both normal replies and follow-ups have explicit parser failure paths.

### 8. GREEN — Add Contacts CRM persisted-data scope

- [ ] Specify that `ContactsOverview` must remove local fake contact state and consume persisted `/api/conversations` data already loaded by Home, or equivalent persisted conversation data.
- [ ] Specify that unpersisted CRM status/tags must not be invented as hardcoded placeholders.
- [ ] Verification: OpenSpec scenarios cover absence of hardcoded fake contacts.

### 9. TRIANGULATE — Cross-check artifacts against OpenSpec requirements

- [ ] Compare edited artifacts against every requirement/scenario in `openspec/changes/normalize-whatsapp-turns-followups/specs/whatsapp-automation/spec.md`.
- [ ] Confirm the document preserves approved stack constraints from `openspec/config.yaml`: Baileys, PostgreSQL via `pg`, Redis via `ioredis`, DeepSeek, local scheduler; no Prisma/Drizzle/Supabase/WebSockets/Vercel/Meta API/Twilio/OpenAI SDK.
- [ ] Confirm migration notes map n8n/Evolution/OpenAI/official WhatsApp API concepts to local components.
- [ ] Verification: maintain a short manual checklist in the PR description or apply notes showing each scenario is covered.

### 10. REFACTOR — Keep the documentation diff reviewable

- [ ] Remove duplicated or contradictory instructions introduced during editing.
- [ ] Keep edits focused on active OpenSpec artifacts; do not reformat unrelated sections.
- [ ] Confirm changed lines remain below the 400-line review budget; if the diff grows above ~300 changed lines, pause and split or compress before proceeding.
- [ ] Verification: `git diff --stat -- openspec/changes/normalize-whatsapp-turns-followups` and document review show a focused artifact-only change.

### 11. VERIFY — Artifact verification

- [ ] Run document-only checks available in the repository:
  - `git diff -- openspec/changes/normalize-whatsapp-turns-followups`
  - `git diff --stat -- openspec/changes/normalize-whatsapp-turns-followups`
  - grep/search for stale deactivation-setting text plus required terms: `fromMe === true`, `seguimiento`, `followup`, `12`, `24`, `Redis`, `HUMAN`.
- [ ] Run `npm test` because strict TDD mode is configured, even though this artifact-only change should not require test updates.
- [ ] Verify no application code files were modified.
- [ ] Verification output should explicitly state this was an OpenSpec-only change and include npm test results.

## Future Code Tasks (deferred until OpenSpec amendment is approved)

- [ ] Add executable tests before implementation for dedupe, owner intervention, `ok.` activation, customer keyword non-toggle, non-activation owner refresh, follow-up 12-hour eligibility, Redis collision checks, 24-hour blocking, invalid DeepSeek JSON, and Baileys auth-safe finalization.
- [ ] Implement PostgreSQL schema/helper updates in `src/lib/db.ts`.
- [ ] Implement Redis turn state helpers in `src/lib/redis.ts` or equivalent.
- [ ] Implement owner-aware Baileys inbound handling in `src/lib/baileys/handler.ts`.
- [ ] Implement follow-up scheduler behavior in `scripts/followups-cron.ts` with 12-hour due evaluation inside the 24-hour customer window.
- [ ] Implement ContactsOverview data plumbing from persisted conversations and remove hardcoded contacts.
- [ ] Update or remove stale tests that still assert the superseded deactivation-command / timed owner-reactivation model.
- [ ] Keep lint/build/test evidence in SDD verify.

## Corrective Tasks (Post-Amendment)

- [x] Fix `getOrCreateConversation` phone vs LID collision to avoid unique constraint violations, including correct behavior during name backfill updates.
