# Apply Progress: normalize-whatsapp-turns-followups

## Status

Initial code implementation slice completed on 2026-06-01.

## Completed Tasks

- Added a minimal runnable TypeScript test strategy for the repository.
- Followed strict TDD RED/GREEN for pure domain/rule helpers before any live integration work.
- Implemented pure helpers for:
  - historical owner command keyword normalization and customer non-toggle coverage (superseded by the 2026-06-02 amendment: no separate deactivation keyword; owner non-activation messages refresh `HUMAN`/off state);
  - historical owner reply reactivation coverage (superseded by the 2026-06-02 amendment: reactivation from WhatsApp requires `bot_on_keyword`, `ok.` by default);
  - inbound turn finalization cleanup contract that excludes Baileys `./auth/` and durable DB state;
  - follow-up eligibility including AI mode, latest assistant, no user reply, attempt cap, active turn state, follow-up lock, minimum delay, and 24h boundary;
  - DeepSeek normal reply and follow-up JSON validation with invalid raw text marked unsafe to send;
  - Humano handoff action planning with `HUMAN` mode and Telegram notification intent.
- Updated `openspec/config.yaml` with the new test command.

## Files Changed

- `package.json` — project metadata, `npm test` command, and minimal TypeScript tooling.
- `package-lock.json` — npm lockfile for test tooling.
- `tsconfig.json` — strict TypeScript configuration for NodeNext/tsx tests.
- `tests/whatsapp-rules.test.ts` — RED/GREEN tests for the initial pure behavior slice.
- `src/domain/whatsapp-rules.ts` — pure deterministic rule/domain helpers.
- `openspec/config.yaml` — test runner and command now documented.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this progress record.

## Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected because `src/domain/whatsapp-rules.ts` did not exist yet (`ERR_MODULE_NOT_FOUND`). |
| GREEN | `npm test` | Passed: 6 suites, 6 tests. |
| VERIFY | `npx tsc --noEmit` | Passed after adding `typescript` and `allowImportingTsExtensions`. |
| VERIFY | `npm test` | Passed again: 6 suites, 6 tests. |

## TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Minimal test runner + pure rule slice | Added `tests/whatsapp-rules.test.ts` first and ran `npm test`; failed with missing implementation module. | Added `src/domain/whatsapp-rules.ts`; `npm test` passed with 6/6 tests. | Kept implementation pure/no network calls; `npx tsc --noEmit` and final `npm test` pass; covered the then-current owner keyword/reactivation model, turn cleanup, follow-up eligibility, DeepSeek parsing, and Humano handoff contract. Current owner/follow-up requirements are superseded by the 2026-06-02 OpenSpec amendment. |

## Deviations from Design

- No live Baileys, PostgreSQL, Redis, Next.js dashboard, DeepSeek HTTP, or Telegram network calls were implemented in this slice by design.
- Used Node's built-in test runner plus `tsx` instead of Vitest/Jest to keep scaffold minimal and deterministic.

## Remaining Tasks

- Implement DB schema/helpers with tests.
- Implement Redis turn state helpers with tests.
- Implement owner-aware Baileys inbound handler with tests/mocks.
- Implement DeepSeek client integration and retry/repair behavior.
- Implement Humano Telegram notification adapter without breaking pure contract tests.
- Implement follow-up scheduler integration with Redis/DB locks.
- Add Next.js dashboard/settings after core behavior is test-covered.

## Workload / PR Boundary

- Work-unit slice: minimal TypeScript scaffold + pure domain rules only.
- No chained PR required for this slice unless combined with prior documentation changes.
- Keep subsequent slices independent and test-first to protect the 400-line review budget.

---

## DB Schema/Helper Slice — 2026-06-01

### Completed Tasks

- Added deterministic DB contract helpers without live PostgreSQL/network dependencies.
- Added schema SQL contract for required `conversations`, `messages`, `settings`, and `conversation_events` tables plus the unique WhatsApp message id index.
- Added settings defaults for the then-current owner keyword/reactivation model, follow-up max attempts, and 24h boundary behavior. Current owner/follow-up requirements are superseded by the 2026-06-02 OpenSpec amendment.
- Added an in-memory repository contract covering:
  - `user` message timestamp updates and follow-up reset;
  - `assistant` and `human` source-specific timestamps;
  - mode transitions with reason/actor/timestamp and event recording;
  - follow-up candidate selection exclusions for `HUMAN`, user replies, max attempts, and 24h boundary;
  - handoff and follow-up-blocked event shapes.

### Files Changed

- `src/lib/db-contract.ts` — pure SQL/defaults/in-memory repository contract.
- `tests/db-contract.test.ts` — strict-TDD coverage for DB schema/helper behavior.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this cumulative evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected: `ERR_MODULE_NOT_FOUND` for missing `src/lib/db-contract.ts`. |
| GREEN | `npm test` | Passed after adding `src/lib/db-contract.ts` and fixing follow-up fixture ordering: 12 tests passing. |
| TRIANGULATE / VERIFY | `npm test && npx tsc --noEmit` | Passed: 12 tests, 8 suites, TypeScript no output/errors. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| DB schema/helper contract | Added `tests/db-contract.test.ts` first; `npm test` failed because `src/lib/db-contract.ts` did not exist. | Added pure deterministic `src/lib/db-contract.ts`; tests passed after aligning the max-attempts fixture with the user-message reset rule. | Compressed implementation to keep the slice reviewable (`src/lib/db-contract.ts` + test file: 283 lines), avoided live DB dependencies, and verified with `npm test && npx tsc --noEmit`. |

### Deviations from Design

- This slice intentionally does not initialize a real `pg` pool or perform live SQL execution; it defines the schema/helper contract and in-memory behavior for deterministic tests.
- `conversation_events` is implemented in the in-memory contract as a required audit shape for tested mode/handoff/follow-up-blocked scenarios.

### Remaining Tasks

- Implement Redis turn state helpers with tests.
- Implement owner-aware Baileys inbound handler with mocks/tests using the DB and Redis contracts.
- Implement DeepSeek client integration and retry/repair behavior.
- Implement Humano Telegram notification adapter without network calls in unit tests.
- Implement follow-up scheduler integration with Redis/DB locks.
- Add Next.js dashboard/settings after core behavior is test-covered.

### Workload / PR Boundary

- Work-unit slice: DB schema/helper contract only, no live DB/network.
- New source+test files for this slice are 283 lines before progress notes, staying under the 400-line review budget.
- Next slice should remain independent and test-first.

---

## Redis Turn-State Helper Slice — 2026-06-01

### Completed Tasks

- Added deterministic Redis turn-state helpers without live Redis/ioredis/network dependencies.
- Added typed key builders for the required `wa:v1:` namespace:
  - message dedupe;
  - turn debounce queue;
  - debounce marker;
  - turn processing lock;
  - processing marker;
  - follow-up runner lock;
  - follow-up conversation lock.
- Added an in-memory turn-state contract covering:
  - dedupe `SET NX` semantics with TTL intent;
  - per-conversation debounce queue and TTL refresh intent;
  - token-owned processing locks with wrong-token release protection;
  - processing markers visible to follow-up collision checks;
  - separate follow-up runner/conversation locks;
  - safe turn cleanup that removes only queue/debounce/processing/owned lock keys and never removes durable DB state, `./auth/`, Baileys session state, durable conversation mode, or dedupe keys by default.

### Files Changed

- `src/lib/redis-turn-state.ts` — pure Redis key builders and in-memory fake/contract.
- `tests/redis-turn-state.test.ts` — strict-TDD coverage for Redis turn-state behavior.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this cumulative evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected: `ERR_MODULE_NOT_FOUND` for missing `src/lib/redis-turn-state.ts`. |
| GREEN | `npm test` | Passed after adding `src/lib/redis-turn-state.ts`: 19 tests, 10 suites passing. |
| TRIANGULATE / VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Redis turn-state contract | Added `tests/redis-turn-state.test.ts` first; `npm test` failed because `src/lib/redis-turn-state.ts` did not exist. | Added pure deterministic `src/lib/redis-turn-state.ts`; all tests passed (`19` tests / `10` suites). | Kept the slice adapter-ready and network-free; verified with `npx tsc --noEmit`; new source+test files total 269 lines, under the 400-line review budget. |

### Deviations from Design

- This slice intentionally does not import `ioredis` or connect to a live Redis server; it defines key/operation contracts and an in-memory fake for deterministic tests.
- TTL behavior is represented as TTL intent (`ttlMs`) instead of wall-clock expiration simulation; live expiration belongs in a future Redis adapter/integration slice.

### Remaining Tasks

- Implement owner-aware Baileys inbound handler with mocks/tests using the DB and Redis contracts.
- Implement DeepSeek client integration and retry/repair behavior.
- Implement Humano Telegram notification adapter without network calls in unit tests.
- Implement follow-up scheduler integration with Redis/DB locks.
- Add Next.js dashboard/settings after core behavior is test-covered.

### Workload / PR Boundary

- Work-unit slice: Redis turn-state contract only, no live Redis/network.
- New source+test files for this slice are 269 lines, staying under the 400-line review budget.
- Next slice should remain independent and test-first.

---

## Owner-Aware Inbound Handler Orchestration Slice — 2026-06-01

### Completed Tasks

- Added deterministic inbound handler orchestration without live Baileys/WhatsApp, PostgreSQL, Redis, DeepSeek, or Telegram network calls.
- Added mocks/fakes-based coverage for valid `messages.upsert` filtering and owner-aware turn processing.
- Implemented orchestration behavior for:
  - ignoring non-`notify` upserts, group JIDs, and non-1:1 JIDs;
  - Redis-style dedupe before persistence, LLM calls, or sends;
  - persisting accepted messages before DeepSeek calls;
  - `fromMe=false` customer messages as `role='user'` and `fromMe=true` owner messages as `role='human'`;
  - the then-current owner command model with no DeepSeek call in the owner command turn;
  - the then-current owner reply reactivation model using pre-message timestamps; current requirements are superseded by the 2026-06-02 OpenSpec amendment (`ok.` reactivates; any other owner WhatsApp message refreshes `HUMAN`/off state);
  - customer keyword text not toggling administrative mode;
  - `HUMAN` mode customer messages persisting without DeepSeek;
  - `AI` mode customer path enqueue/debounce/lock/history/prompt/DeepSeek/send/persist flow;
  - Humano handoff mode switch and Telegram notification intent;
  - invalid DeepSeek JSON safe behavior with no raw send;
  - `finally` cleanup that returns the Redis cleanup contract excluding Baileys auth.

### Files Changed

- `src/lib/baileys/inbound-handler.ts` — pure owner-aware inbound handler orchestration over injected interfaces/fakes.
- `tests/inbound-handler.test.ts` — strict-TDD coverage for handler filtering, owner controls, AI/HUMAN paths, handoff, invalid JSON, and finalization cleanup.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this cumulative evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected: `ERR_MODULE_NOT_FOUND` for missing `src/lib/baileys/inbound-handler.ts`. |
| GREEN | `npm test` | Passed after adding the handler and fixing cleanup result attachment: 29 tests, 13 suites. |
| VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Owner-aware inbound handler orchestration | Added `tests/inbound-handler.test.ts` first; `npm test` failed because `src/lib/baileys/inbound-handler.ts` did not exist. | Added injected-interface orchestration module; `npm test` passed after ensuring cleanup is attached from `finally`. | No live services or network calls; uses existing DB and Redis contracts plus DeepSeek/Telegram mocks; verified with `npx tsc --noEmit`. |

### Deviations from Design

- Debounce processing is executed immediately/deterministically in this orchestration slice instead of waiting for real timers; live timer scheduling belongs in a future adapter slice.
- The handler uses injected interfaces and in-memory contracts, not real Baileys, `pg`, `ioredis`, DeepSeek HTTP, or Telegram HTTP adapters.
- New source+test files total 527 lines because this slice covers the full requested orchestration matrix; consider fresh review or splitting future adapter work into smaller slices.

### Remaining Tasks

- Implement DeepSeek client adapter with retry/repair behavior around the existing JSON contracts.
- Implement Telegram notification adapter with tests and no unit-test network calls.
- Implement live Redis adapter over `ioredis` that satisfies the existing turn-state contract.
- Implement live PostgreSQL adapter over `pg` that satisfies the DB contract.
- Implement Baileys event adapter/client wiring that feeds this handler without changing the pure orchestration tests.
- Implement follow-up scheduler integration with Redis/DB locks.
- Add Next.js dashboard/settings after core behavior is test-covered.

### Workload / PR Boundary

- Work-unit slice: inbound handler orchestration only, no live network/services.
- This slice is behavior-dense and exceeds the 400-line review target if counted alone (527 source+test lines). Do not combine the next adapter slice with this one in a single review without explicit size approval.

---

## Lock-Failure Cleanup Fix — 2026-06-01

### Completed Tasks

- Fixed the fresh-review blocker where cleanup after processing-lock acquisition failure could delete another active processor's queue/debounce/processing state.
- Changed Redis cleanup ownership semantics: `cleanupTurnState` now removes queue/debounce/processing and releases lock only when the provided token owns the processing lock.
- Added regression coverage at both Redis-contract and inbound-handler levels:
  - wrong-token cleanup removes no keys and preserves active state;
  - inbound lock acquisition failure does not call DeepSeek/send and does not delete the other processor's active turn state.

### Files Changed

- `src/lib/redis-turn-state.ts` — cleanup now requires lock ownership before deleting transient turn keys.
- `tests/redis-turn-state.test.ts` — updated wrong-token cleanup expectation.
- `tests/inbound-handler.test.ts` — added lock-failure regression test.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this blocker-fix evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | Fresh reviewer identified blocker in lock-failure cleanup path. Regression expectation added for wrong-token/no-ownership cleanup. |
| GREEN | `npm test` | Passed: 30 tests, 13 suites. |
| VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |

### Remaining Tasks

- Re-run fresh review if preparing PR/commit.
- Next implementation slice should be small: DeepSeek adapter, Telegram adapter, or live Redis adapter. Do not combine with the inbound handler slice without size approval.

---

## Telegram Notification Adapter Slice — 2026-06-01

### Completed Tasks

- Added a Telegram notification adapter with injected `fetch` so unit tests never perform real network calls.
- Implemented Bot API `sendMessage` request construction from `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` style config.
- Added formatted notification bodies for:
  - Humano handoff (`conversationId`, phone, JID, reason, last message);
  - follow-up blocked outside the 24h window (`conversationId`, phone, reason).
- Added safe failure behavior:
  - missing token/chat id returns `skipped` and does not call fetch;
  - non-OK Telegram HTTP response returns `failed` without throwing;
  - fetch/network error returns `failed` without throwing so caller turns can continue;
  - user-visible result messages do not expose bot token or chat id.
- Added HTML escaping for Telegram `parse_mode: "HTML"` notification values.

### Files Changed

- `src/lib/telegram-notifier.ts` — Telegram notification adapter and formatting helpers.
- `tests/telegram-notifier.test.ts` — mocked-fetch strict-TDD coverage for request construction, formatting, skipped/failure paths, and secret redaction.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this cumulative evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected: `ERR_MODULE_NOT_FOUND` for missing `src/lib/telegram-notifier.ts`. |
| GREEN | `npm test` | Passed after adding `src/lib/telegram-notifier.ts`: 38 tests, 14 suites. |
| TRIANGULATE | `npx tsc --noEmit` | Initially found a test typing issue around `HeadersInit`; fixed with a narrow cast. |
| VERIFY | `npm test && npx tsc --noEmit` | Passed: 38 tests, 14 suites, TypeScript no output/errors. |
| VERIFY | `git diff --check -- src/lib/telegram-notifier.ts tests/telegram-notifier.test.ts` | Passed with no whitespace errors. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Telegram adapter | Added `tests/telegram-notifier.test.ts` first; `npm test` failed because `src/lib/telegram-notifier.ts` did not exist. | Added adapter with injected fetch and formatting helpers; `npm test` passed. | Ran `npx tsc --noEmit`, fixed one type-only issue in test header assertion, re-ran `npm test && npx tsc --noEmit`; source+test slice is 341 lines, under the 400-line review budget. |

### Deviations from Design

- This slice intentionally does not wire the adapter into the inbound handler or scheduler; those integrations remain future slices.
- The adapter does not return Telegram response bodies to avoid leaking unnecessary data; it returns minimal safe user-visible status.

### Remaining Tasks

- Wire Telegram adapter into the inbound handler/follow-up scheduler in an integration slice.
- Implement DeepSeek client adapter with retry/repair behavior around the existing JSON contracts.
- Implement follow-up scheduler integration with Redis/DB locks.
- Implement live Redis/`pg`/Baileys adapters.

### Workload / PR Boundary

- Work-unit slice: Telegram notification adapter only, no live network in tests.
- New source+test files total 341 lines, under the 400-line review budget.
- Next recommended slice: DeepSeek client adapter with mocked fetch tests for strict JSON, retry/repair, and safe invalid-output handling.

---

## DeepSeek Client Adapter Slice — 2026-06-01

### Completed Tasks

- Added a DeepSeek chat-completions adapter with injected fetch and no live network calls in tests.
- Reused pure parsers from `src/domain/whatsapp-rules.ts` for normal replies and follow-up decisions.
- Implemented request construction for the configured API key, model, and base URL.
- Added strict prompts for:
  - normal replies: `{ response: { part_1, part_2, part_3 }, handoff }`;
  - follow-ups: `{ respuesta: "SI" | "NO", mensaje: "..." }`.
- Parsed the OpenAI-compatible `choices[0].message.content` response shape.
- Added one repair/retry request for malformed normal and follow-up JSON.
- Added safe failure behavior for still-invalid JSON, non-OK HTTP responses, invalid response shape, and network errors.
- Ensured adapter result messages do not expose the DeepSeek API key or raw invalid model text as sendable content.

### Files Changed

- `src/lib/deepseek-client.ts` — adapter-only DeepSeek client with injected fetch and repair retry.
- `tests/deepseek-client.test.ts` — strict-TDD mocked fetch coverage for request construction, strict JSON prompts, repair retry, and safe failures.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this cumulative evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected: `ERR_MODULE_NOT_FOUND` for missing `src/lib/deepseek-client.ts`. |
| GREEN | `npm test` | Passed after adding `src/lib/deepseek-client.ts`: 46 tests, 15 suites. |
| TRIANGULATE | `npx tsc --noEmit` | Initially found TypeScript narrowing issues in test assertions and a parser failure cast; fixed. |
| VERIFY | `npm test` | Passed: 46 tests, 15 suites. |
| VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |
| VERIFY | `git diff --check -- src/lib/deepseek-client.ts tests/deepseek-client.test.ts openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` | Passed. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| DeepSeek adapter | Added `tests/deepseek-client.test.ts` first; `npm test` failed because the module was missing. | Added `src/lib/deepseek-client.ts`; tests passed with mocked fetch and no real network calls. | Reused existing pure parsers, kept API-key handling adapter-local, fixed TypeScript narrowing, and verified with `npm test`, `npx tsc --noEmit`, and `git diff --check`. |

### Deviations from Design

- This slice intentionally does not wire the adapter into the inbound handler or follow-up scheduler yet.
- Repair behavior is limited to exactly one retry request, matching this slice scope.
- No live DeepSeek integration test was added; all tests use mocked fetch.

### Remaining Tasks

- Wire DeepSeek adapter into the inbound handler dependency in a future integration slice.
- Implement follow-up scheduler integration using DB/Redis locks plus the DeepSeek adapter.
- Implement live Redis adapter over `ioredis` and live PostgreSQL adapter over `pg`.
- Implement Baileys event adapter/client wiring.
- Add Next.js dashboard/settings after core behavior is test-covered.

### Workload / PR Boundary

- Work-unit slice: DeepSeek adapter only, no live network calls.
- New source+test files total 349 lines, under the 400-line review budget.
- Next slice should remain small and independent.

---

## Follow-Up Scheduler Orchestration Slice — 2026-06-01

### Completed Tasks

- Added deterministic follow-up scheduler orchestration without live cron, Baileys, PostgreSQL, Redis, DeepSeek, Telegram, or network calls.
- Added mocked/fake coverage for scheduler lock behavior and candidate processing.
- Implemented orchestration behavior for:
  - global follow-up runner lock acquisition and skip when locked;
  - repository candidate query using settings for min assistant age, max attempts, 24h free-form window, and blocking flag;
  - active inbound turn state collision skip;
  - per-conversation follow-up lock acquisition and skip when unavailable;
  - recent history loading and DeepSeek follow-up decision call;
  - `NO` decisions sending nothing and recording `followup_skipped`;
  - `SI` decisions sending through injected WhatsApp sender, persisting `assistant` with `source='scheduler'`, updating attempts/timestamps, and recording `followup_sent`;
  - invalid/safe-failure DeepSeek decisions sending nothing and recording `deepseek_json_invalid`;
  - outside-24h blocking with `followup_blocked_24h` audit and Telegram blocked notification intent;
  - release of global and per-conversation follow-up locks;
  - no Baileys auth/session cleanup in scheduler result contract.
- Added follow-up lock release methods to the in-memory Redis turn-state contract for safe scheduler cleanup.

### Files Changed

- `src/lib/followup-scheduler.ts` — pure scheduler orchestration over injected interfaces/fakes.
- `tests/followup-scheduler.test.ts` — strict-TDD coverage for scheduler lock, candidate, decision, send, blocked, and audit behavior.
- `src/lib/redis-turn-state.ts` — added token-owned follow-up runner/conversation lock release helpers.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this cumulative evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected: `ERR_MODULE_NOT_FOUND` for missing `src/lib/followup-scheduler.ts`. |
| GREEN | `npm test` | Initially failed scheduler scenarios due fixture timing and candidate override typing; after implementation/refactor passed: 53 tests, 16 suites. |
| TRIANGULATE | `npx tsc --noEmit` | Initially found candidate override typing issue; fixed with `ConversationRow[]`. Final run passed with no output/errors. |
| VERIFY | `npm test && npx tsc --noEmit` | Passed: 53 tests, 16 suites, TypeScript no output/errors. |
| VERIFY | `git diff --check -- src/lib/followup-scheduler.ts tests/followup-scheduler.test.ts src/lib/redis-turn-state.ts` | Passed. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Follow-up scheduler orchestration | Added `tests/followup-scheduler.test.ts` first; `npm test` failed because `src/lib/followup-scheduler.ts` did not exist. | Added `src/lib/followup-scheduler.ts` and follow-up lock release helpers; scheduler tests passed after aligning fixtures with 24h/min-age constraints. | Refactored to keep the slice compact, no live services, and verified with `npm test`, `npx tsc --noEmit`, and `git diff --check`. |

### Deviations from Design

- This slice intentionally does not create a live cron loop or import `node-cron`; it exposes deterministic `runOnce()` orchestration for future cron wiring.
- Repository/Redis/DeepSeek/Telegram/WhatsApp are injected contracts/fakes only; no live adapters or network calls are used.
- The existing repository contract excludes outside-24h rows from normal candidates, so the scheduler-level 24h-blocking path is covered with a candidate override/fake to verify the required re-check and audit behavior.

### Remaining Tasks

- Wire the DeepSeek adapter and Telegram notifier into scheduler dependencies in an integration slice.
- Implement live Redis adapter over `ioredis` and live PostgreSQL adapter over `pg`.
- Implement Baileys event adapter/client wiring and cron/start-bot wiring.
- Add Next.js dashboard/settings after core behavior is test-covered.

### Workload / PR Boundary

- Work-unit slice: follow-up scheduler orchestration only, no live adapters/cron.
- Source+test for this slice were refactored to stay under the 400-line review target (excluding this progress note); future live adapter slices should remain separate.

---

## Minimal Next.js Dev Scaffold Slice — 2026-06-01

### Completed Tasks

- Added a minimal Next.js 16 / React 19 App Router shell so the project can start with `npm run dev`.
- Preserved the existing Node test runner and all prior SDD implementation tests.
- Added a static app shell that shows:
  - project title;
  - scaffold readiness status;
  - a brief list of core contracts already implemented/tested.
- Kept this slice UI-only and intentionally did not wire live WhatsApp, PostgreSQL, Redis, DeepSeek, Telegram, Docker, or dashboard APIs.
- Added build/start/dev scripts while preserving `npm test`.
- Updated `.gitignore` for Next build output and TypeScript build info.

### Files Changed

- `package.json` — added `dev`, `build`, and `start` scripts plus minimal Next/React dependencies.
- `package-lock.json` — updated npm lockfile for Next/React packages.
- `tsconfig.json` — expanded TypeScript config for Next App Router/TSX and Next-generated types.
- `next-env.d.ts` — generated Next type references.
- `next.config.ts` — minimal Next config placeholder.
- `src/app/layout.tsx` — root layout with metadata and global CSS import.
- `src/app/page.tsx` — static app shell/status page.
- `src/app/globals.css` — minimal shell styling without adding Tailwind complexity in this slice.
- `.gitignore` — ignores `.next/`, `out/`, and `tsconfig.tsbuildinfo`.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this cumulative evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm run build` | Failed as expected before scaffold: missing `build` script. |
| GREEN | `npm test` | Passed: 53 tests, 16 suites. |
| VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |
| VERIFY | `npm run build` | Passed: Next.js 16.2.7 production build compiled and prerendered `/`. |
| DEV SMOKE | `timeout 8s npm run dev` | Next dev server reported ready at `http://localhost:3000`; command exited with timeout code 124 because it is intentionally long-lived. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Minimal Next dev scaffold | Ran `npm run build` before implementation; failed because the project had no build script/app scaffold. | Added minimal Next scripts/dependencies/config and App Router files; `npm test`, `npx tsc --noEmit`, and `npm run build` passed. | Ran a bounded dev smoke (`timeout 8s npm run dev`) and observed Next ready on localhost:3000; kept source/config additions focused at ~259 lines excluding lockfile and progress notes. |

### Deviations from Design

- Tailwind CSS 4 was not introduced in this slice to avoid unnecessary complexity; the shell uses plain CSS. Tailwind can be added with the dashboard/UI slice.
- No `postcss.config.mjs` was added because the current plain-CSS shell does not require PostCSS/Tailwind configuration.
- No live adapters, dashboard APIs, Baileys, `pg`, `ioredis`, Docker, or cron wiring were added by design.

### Remaining Tasks

- Add Tailwind/dashboard UI when the dashboard slice begins.
- Implement live Redis adapter over `ioredis` and live PostgreSQL adapter over `pg`.
- Wire DeepSeek/Telegram adapters into inbound/scheduler dependencies.
- Implement Baileys client/QR connection flow and route APIs.
- Add cron/start-bot wiring after live adapters exist.

### Workload / PR Boundary

- Work-unit slice: minimal Next.js dev scaffold only.
- Source/config additions are under the 400-line review target excluding `package-lock.json` and this progress note.
- `npm run dev` should now be available for interactive local development.

---

## Live Redis Adapter Slice — 2026-06-01

### Completed Tasks

- Added an ioredis-compatible Redis turn-state adapter with mocked Redis tests only; no live Redis server is required for unit tests.
- Added `ioredis` as the live Redis client dependency for future runtime wiring.
- Implemented adapter parity for the existing turn-state contract:
  - dedupe uses atomic `SET key value EX ttl NX`;
  - turn queues use `RPUSH` plus `EXPIRE` to append in order and refresh TTL without JSON read-modify-write clobbering;
  - queued message reads parse list entries safely and skip malformed/non-contract JSON entries;
  - debounce and processing markers store JSON with `PX` TTL;
  - processing and follow-up locks use `SET key token NX PX ttlMs`;
  - lock releases use Lua compare-and-delete semantics;
  - active turn state checks queue/debounce/turn-lock/processing-marker existence;
  - cleanup deletes queue/debounce/processing/processing-lock only when the token owns the processing lock.
- Preserved cleanup `neverTouches` guarantees for PostgreSQL, `./auth/`, Baileys session state, durable conversation mode, and dedupe keys.

### Files Changed

- `src/lib/redis-adapter.ts` — ioredis-compatible Redis turn-state adapter.
- `tests/redis-adapter.test.ts` — mocked Redis strict-TDD coverage for adapter commands, parsing, locks, active state, and cleanup behavior.
- `package.json` — added `ioredis` dependency.
- `package-lock.json` — updated npm lockfile for `ioredis` dependency tree.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this cumulative evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected after adding `tests/redis-adapter.test.ts`: `ERR_MODULE_NOT_FOUND` for missing `src/lib/redis-adapter.ts`; existing tests still passed. |
| GREEN | `npm test` | Passed after adding `src/lib/redis-adapter.ts`: 59 tests, 17 suites. |
| TRIANGULATE / VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |
| VERIFY | `npm run build` | Passed: Next.js production build compiled and prerendered `/` and `/_not-found`. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Live Redis adapter | Added mocked Redis adapter tests first; `npm test` failed because `src/lib/redis-adapter.ts` did not exist. | Added the ioredis-compatible adapter and `ioredis` dependency; `npm test` passed with 59/59 tests. | Used Redis list ops for queue appends, Lua compare-and-delete for token-owned release/cleanup, safe JSON parsing for stored data, then verified with `npx tsc --noEmit` and `npm run build`. |

### Deviations from Design

- This slice intentionally does not wire Redis into inbound handling or the follow-up scheduler; integration should wait for the PostgreSQL adapter and startup wiring slices.
- Unit tests use a fake Redis client implementing ioredis-style methods instead of a live Redis server.
- `npm install ioredis` reported 2 moderate vulnerabilities in the dependency tree; no forced audit fix was applied because that could introduce unrelated breaking dependency changes.

### Remaining Tasks

- Implement live PostgreSQL adapter over `pg` with mocked/client-level tests and schema/query parity.
- Wire Redis and PostgreSQL adapters into inbound/scheduler dependencies in a future integration slice.
- Implement Baileys event adapter/client wiring and cron/start-bot wiring after live durable adapters exist.
- Add dashboard/settings UI/API after core runtime adapters are in place.

### Workload / PR Boundary

- Work-unit slice: live Redis adapter only, no PostgreSQL, Baileys, cron, or cross-adapter wiring.
- Keep the next slice separate to preserve the review budget.

---

## Live PostgreSQL Adapter Slice — 2026-06-01

### Completed Tasks

- Added a `pg`-compatible PostgreSQL repository adapter with mocked pg/queryable tests only; no live PostgreSQL server is required for unit tests.
- Added `pg` and `@types/pg` dependencies for future runtime wiring.
- Added schema initialization via the shared `DATABASE_SCHEMA_SQL` contract.
- Implemented adapter parity for durable repository methods used by inbound handling and follow-up scheduling:
  - settings read merges database rows over `DEFAULT_SETTINGS`;
  - conversation lookup by phone/JID and insert when missing;
  - message insert with parameterized SQL and role-specific conversation timestamp updates;
  - user messages reset follow-up counters and blocked state;
  - assistant/human messages touch assistant/human/owner intervention timestamps correctly;
  - mode updates record reason/actor/timestamp and optional audit event;
  - recent messages return chronological rows capped by limit;
  - pending follow-up query enforces AI mode, latest assistant message, no newer user reply, max attempts, min assistant age, and optional 24h window blocking;
  - follow-up attempt increment and blocked-follow-up audit helpers.
- Kept all SQL parameterized; tests assert key SQL shapes and parameter arrays.

### Files Changed

- `src/lib/postgres-adapter.ts` — pg-compatible durable repository adapter.
- `tests/postgres-adapter.test.ts` — mocked pg strict-TDD coverage for schema, settings, conversations, messages, mode/events, recent messages, follow-up candidates, attempts, and blocked events.
- `package.json` — added `pg` and `@types/pg` dependencies.
- `package-lock.json` — updated npm lockfile for PostgreSQL dependency tree.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this cumulative evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected after adding `tests/postgres-adapter.test.ts`: `ERR_MODULE_NOT_FOUND` for missing `src/lib/postgres-adapter.ts`; existing tests still passed. |
| GREEN | `npm test` | Passed after adding `src/lib/postgres-adapter.ts` and aligning two test expectations with adapter semantics: 69 tests, 18 suites. |
| TRIANGULATE / VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |
| VERIFY | `npm run build` | Passed: Next.js production build compiled and prerendered `/` and `/_not-found`. |
| VERIFY | `git diff --check -- src/lib/postgres-adapter.ts tests/postgres-adapter.test.ts package.json package-lock.json openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` | Passed with no whitespace errors. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Live PostgreSQL adapter | Added mocked pg adapter tests first; `npm test` failed because `src/lib/postgres-adapter.ts` did not exist. | Added the pg-compatible adapter and PostgreSQL dependencies; `npm test` passed with 69/69 tests. | Kept repository methods queryable-injected and live-server-free, used parameterized SQL, added follow-up query coverage, and verified with TypeScript, Next build, and `git diff --check`. |

### Deviations from Design

- This slice intentionally does not run real migrations or connect to a live PostgreSQL server; it exposes `initializePostgresSchema()` and a queryable-injected repository for future runtime wiring.
- This slice does not wire PostgreSQL into the inbound handler or scheduler yet; cross-adapter integration remains separate.
- `npm install pg @types/pg` reported the existing 2 moderate vulnerabilities in the dependency tree; no forced audit fix was applied because that could introduce unrelated breaking dependency changes.

### Remaining Tasks

- Wire live Redis and PostgreSQL adapters into inbound/scheduler dependencies in a future integration slice.
- Wire existing DeepSeek and Telegram adapters into those runtime dependencies.
- Implement Baileys event adapter/client wiring and QR/auth startup flow.
- Add cron/start-bot wiring after live adapters are integrated.
- Add dashboard/settings UI/API after core runtime wiring is in place.

### Workload / PR Boundary

- Work-unit slice: live PostgreSQL adapter only, no Baileys, cron, dashboard APIs, or cross-adapter wiring.
- Keep the next runtime integration slice separate to preserve the review budget.

---

## PostgreSQL Adapter Blocker Fix — 2026-06-01

### Completed Tasks

- Fixed fresh-review blockers in the live PostgreSQL adapter slice.
- Updated inbound handler and follow-up scheduler contracts to accept async repository and turn-state methods while preserving compatibility with existing sync in-memory fakes by awaiting maybe-promises.
- Added transaction support for coupled PostgreSQL writes when the injected pool exposes `connect()`:
  - `insertMessageAndTouchConversation()` wraps message insert plus conversation timestamp/touch update in `BEGIN`/`COMMIT`, with `ROLLBACK` on failure;
  - `setMode()` wraps conversation mode update plus optional audit event insert in `BEGIN`/`COMMIT`, with `ROLLBACK` on failure.
- Added a whitelist for `updateConversation()` patch columns so runtime keys cannot be interpolated into SQL identifiers outside the approved conversation columns.

### Files Changed

- `src/lib/postgres-adapter.ts` — transaction helper, event insert helper, and update-column whitelist.
- `tests/postgres-adapter.test.ts` — mocked transaction rollback tests and whitelist regression test.
- `src/lib/baileys/inbound-handler.ts` — async-compatible repository/turn-state dependency contract and awaits.
- `tests/inbound-handler.test.ts` — async dependency compatibility regression test.
- `src/lib/followup-scheduler.ts` — async-compatible repository/turn-state dependency contract and awaits.
- `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` — this blocker-fix evidence update.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed as expected after adding blocker regression tests: async dependencies were not awaited, transactions did not begin, and update whitelist was missing. |
| GREEN | `npm test` | Passed after fixes: 73 tests, 18 suites. |
| VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors after replacing dynamic test wrappers with typed async wrappers. |
| VERIFY | `npm run build` | Passed: Next.js production build compiled and prerendered `/` and `/_not-found`. |
| VERIFY | `git diff --check -- src/lib/postgres-adapter.ts tests/postgres-adapter.test.ts src/lib/baileys/inbound-handler.ts tests/inbound-handler.test.ts src/lib/followup-scheduler.ts openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` | Passed with no whitespace errors. |

### Remaining Tasks

- Fresh review this blocker fix before runtime wiring.
- Then wire live Redis/PostgreSQL plus existing DeepSeek/Telegram adapters into inbound/scheduler runtime dependencies in a separate integration slice.

---

## Code Apply Amendment — 2026-06-02

### Completed Tasks

- Hardened inbound WhatsApp filtering so `remoteJid` values ending in `g.us` are ignored before dedupe, persistence, DeepSeek, or send operations.
- Replaced the legacy owner control model with owner-only activation:
  - owner `fromMe === true` messages are persisted as `role='human'`;
  - owner text matching `bot_on_keyword` (`ok.` by default) switches the chat to `AI` and records `last_ai_reactivated_at`;
  - every other owner message switches/refreshes `HUMAN` with `owner_intervention_whatsapp` and the bot stays silent.
- Removed stale app/test references to the separate deactivation keyword and timed owner auto-reactivation model.
- Updated follow-up defaults and tests to use a 12-hour due/evaluation interval while keeping the 24-hour WhatsApp free-form boundary.
- Restored strict normal DeepSeek JSON parsing: malformed raw text now triggers repair/failure and is never sendable as raw assistant text.
- Reworked Contacts CRM to consume persisted `conversations` data from `/api/conversations` via `Home` instead of local fake contacts, invented statuses, or invented tags.
- Brightened the dashboard theme and shell with a light green/white palette, stronger panels, higher-contrast borders/shadows, and a more visible brand gradient.

### Files Changed

- `src/domain/whatsapp-rules.ts`
- `src/lib/baileys/inbound-handler.ts`
- `src/lib/db-contract.ts`
- `src/lib/postgres-adapter.ts`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/components/ContactsOverview.tsx`
- `src/components/SettingsPanel.tsx`
- `tests/whatsapp-rules.test.ts`
- `tests/inbound-handler.test.ts`
- `tests/db-contract.test.ts`
- `tests/followup-scheduler.test.ts`
- `tests/postgres-adapter.test.ts`

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test` | Failed before fixes: 61 pass / 11 fail. Failures covered stale DeepSeek raw-text acceptance, stale 24h follow-up expectations, stale owner/off/reactivation behavior, and inbound debounce timing. |
| GREEN | `npm test` | Passed after code/test updates: 72 tests, 17 suites, 0 failures. |
| VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |
| VERIFY | `npm run build` | Passed: Next.js production build compiled and generated routes successfully. |
| VERIFY | stale legacy-token search over `src`, `tests`, `package.json`, and the active OpenSpec change | No results after excluding this historical evidence note from the search target. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Owner activation + group ignore + strict parser + follow-up/UI amendment | `npm test` failed on legacy owner-control behavior, DeepSeek parser repair/failure, follow-up SQL expectations, and inbound handler behavior. | Updated domain rules, inbound handler, DB defaults/adapters, tests, Contacts CRM, settings UI, and visual tokens; `npm test` passed with 72/72 tests. | Verified no stale legacy-control language remains with search; `npx tsc --noEmit` and `npm run build` passed. |

### Deviations from Design

- The configured `sdd-apply` subagent could not start because its Codex model is unsupported for this account; a normal `worker` retry also disappeared before producing output. The parent session completed the apply inline as a controlled fallback and will run fresh review afterward.
- Visual improvement is implemented as a theme/shell polish pass, not a full product redesign.

### Remaining Tasks

- Run fresh-context review of the code diff before final acceptance.
- If review passes, proceed to SDD verify/archive decision.

### Workload / PR Boundary

- Current code amendment is larger than the original OpenSpec-only forecast but remains a single coherent behavior/UI apply slice.
- Fresh review is required before completion.

---

## Phone and LID Collision Fix Slice � 2026-07-01

### Completed Tasks

- Fixed a bug where `getOrCreateConversation` hit a duplicate unique key (`conversations_phone_key`) when both a LID-based conversation row and a phone-based conversation row existed.
- Removed `LIMIT 1` from the conflict search query and instead ordered the results prioritizing phone matches.
- Handled potential unique-constraint collisions proactively by avoiding `phone` or `jid` updates if another matched row already owned those values.

### Files Changed

- `src/lib/postgres-adapter.ts` — fixed `getOrCreateConversation` to avoid updating fields if they conflict with other matched rows.
- `tests/postgres-adapter.test.ts` — added strict TDD regression test for the phone vs LID collision scenario.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test -- --test-name-pattern="avoids"` | Failed as expected: "Error: Should not try to update if it would violate unique constraint" |
| GREEN | `npm test` | Passed with 163/163 tests across 49 suites. |
| VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Phone/LID Collision | Wrote a test forcing `getOrCreateConversation` to choose between a phone row and a LID row; forced a throw if an update was attempted. Test failed on the throw. | Updated `postgres-adapter.ts` to fetch all matches, prioritize the phone match, and explicitly clear `shouldUpdatePhone` / `shouldUpdateJid` if it would cause a collision. Test passed. | Verified compilation via `npx tsc --noEmit` and ran the full suite. |

### Workload / PR Boundary

- Small, focused bugfix work-unit slice.
- Review budget: < 30 lines changed.

---

## Phone/LID Collision and Name Backfill Fix Slice — 2026-07-01

### Completed Tasks

- Fixed a bug where `src/lib/postgres-adapter.ts` ignored the `shouldUpdateJid` collision check and erroneously included the conflicting JID in the `UPDATE` query when another field like `name` triggered the update.
- Updated the `UPDATE` query to explicitly use `shouldUpdateJid ? input.jid : null` and `shouldUpdatePhone ? input.phone : null` to avoid generating duplicate key errors during name backfills.
- Added strict TDD regression test specifically covering the collision-plus-name-backfill scenario where `shouldUpdateJid` must correctly prevent writing the conflicting JID.

### Files Changed

- `src/lib/postgres-adapter.ts` — updated `getOrCreateConversation` UPDATE query to correctly honor collision checks.
- `tests/postgres-adapter.test.ts` — added `avoids unique constraint violation when a collision exists and name is updated` regression test and updated `repairs an existing LID conversation phone` test expectation.

### Test Commands Run

| Phase | Command | Result |
|-------|---------|--------|
| RED | `npm test -- --test-name-pattern="avoids unique constraint violation when a collision exists and name is updated"` | Failed as expected: `ERR_ASSERTION` due to the JID field ignoring `shouldUpdateJid` and passing the conflicting string instead of `null`. |
| GREEN | `npm test` | Passed with 164/164 tests across 49 suites. |
| VERIFY | `npx tsc --noEmit` | Passed with no TypeScript output/errors. |

### TDD Cycle Evidence

| Cycle | RED Evidence | GREEN Evidence | Refactor/Triangulate Evidence |
|-------|--------------|----------------|-------------------------------|
| Name Backfill Collision | Wrote a test forcing a name update during a phone vs LID collision. Test failed on strict assertion mismatch because the UPDATE query included the JID. | Updated the `UPDATE` query values array in `src/lib/postgres-adapter.ts` to respect `shouldUpdateJid` and `shouldUpdatePhone` flags. The test passed. | Also fixed an overly-strict historical test assertion that previously expected the JID to be updated during phone repairs. Full suite green. |

### Workload / PR Boundary

- Small, focused corrective work-unit slice.
- Review budget: < 20 lines changed.
