# Code Context

## Files Retrieved
1. `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` (lines 1-523) - cumulative implementation status and remaining work.
2. `openspec/changes/normalize-whatsapp-turns-followups/tasks.md` (lines 126-146) - original deferred code-task list.
3. `openspec/config.yaml` (lines 1-48) - strict TDD, stack constraints, forbidden tools, test command.
4. `package.json` (lines 1-27) - current scripts/dependencies; no `pg`, `ioredis`, or Baileys dependency yet.
5. `src/domain/whatsapp-rules.ts` (lines 1-157) - pure owner keyword, reactivation, follow-up eligibility, and JSON parser rules.
6. `src/lib/redis-turn-state.ts` (lines 1-237) - Redis key contract plus in-memory implementation to adapt next.
7. `src/lib/db-contract.ts` (lines 1-377) - PostgreSQL schema SQL, repository contract, and in-memory implementation.
8. `src/lib/baileys/inbound-handler.ts` (lines 1-412) - pure owner-aware inbound orchestration over injected DB/Redis/DeepSeek/Telegram/WhatsApp dependencies.
9. `src/lib/followup-scheduler.ts` (lines 1-242) - pure follow-up scheduler orchestration over injected dependencies.
10. `src/lib/deepseek-client.ts` (lines 1-204) - live HTTP-style DeepSeek adapter with injected fetch and repair retry, not wired yet.
11. `src/lib/telegram-notifier.ts` (lines 1-150) - live HTTP-style Telegram adapter with injected fetch, not wired yet.
12. `tests/redis-turn-state.test.ts` (lines 41-190) - behavioral contract for Redis adapter parity.
13. `tests/db-contract.test.ts` (lines 24-267) - schema/settings/repository behavior contract for PostgreSQL adapter parity.
14. `tests/inbound-handler.test.ts` (lines 42-371) - mocks for inbound orchestration behavior.
15. `tests/followup-scheduler.test.ts` (lines 56-259) - mocks for scheduler orchestration behavior.

## Key Code

Current implementation is adapter-ready but mostly pure/in-memory.

```ts
// src/lib/redis-turn-state.ts lines 1-45
export const REDIS_KEY_PREFIX = "wa:v1:";
export const redisTurnKeys = {
  dedupeMessage: (whatsappMessageId) => `wa:v1:dedupe:msg:${whatsappMessageId}`,
  turnQueue: (conversationId) => `wa:v1:turn:queue:${conversationId}`,
  debounceMarker: (conversationId) => `wa:v1:turn:debounce:${conversationId}`,
  turnLock: (conversationId) => `wa:v1:turn:lock:${conversationId}`,
  processingMarker: (conversationId) => `wa:v1:turn:processing:${conversationId}`,
  followupRunnerLock: () => "wa:v1:followups:runner-lock",
  followupConversationLock: (conversationId) => `wa:v1:followups:lock:${conversationId}`,
};
```

Important Redis semantics already specified in `src/lib/redis-turn-state.ts`:
- Dedupe must be `SET NX` with TTL intent (lines 94-103).
- Queue append must preserve existing queued items and refresh queue TTL (lines 104-116).
- Processing/follow-up locks are token-owned and must refuse wrong-token release (lines 133-148, 172-203).
- `hasActiveTurnState` checks queue/debounce/turn-lock/processing-marker for follow-up collision prevention (lines 164-170).
- `cleanupTurnState` may delete queue/debounce/processing/owned lock only when caller owns the turn lock; it must never touch PostgreSQL, `./auth/`, Baileys session, durable mode, or dedupe keys (lines 205-234).

DB contract exists but is larger:
- `DATABASE_SCHEMA_SQL` defines `conversations`, `messages`, `settings`, and `conversation_events` (lines 44-81).
- Repository methods include `getOrCreateConversation`, `insertMessageAndTouchConversation`, `setMode`, `recordConversationEvent`, `markFollowUpBlocked`, and `getPendingFollowUps` (lines 167-377).

Inbound and scheduler already consume these contracts:
- `createInboundHandler` dependency contract is `HandlerRepository` + `turnState` + injected DeepSeek/Telegram/send functions (lines 43-94).
- Inbound flow dedupes before persistence (lines 188-195), persists owner/customer messages (lines 216-227), processes owner-only controls/reactivation (lines 229-279), queues/debounces/acquires processing lock (lines 289-324), calls DeepSeek and safely handles invalid JSON/handoff (lines 326-383), and finalizes Redis state in `finally` (lines 389-394).
- `createFollowUpScheduler` uses repo candidates/settings, Redis runner/conversation locks, active-turn collision checks, DeepSeek decision, WhatsApp send, Telegram blocked notification, and event recording (lines 105-239).

Existing live-ish adapters:
- `createDeepSeekClient` accepts injected fetch, posts to `/chat/completions`, requests JSON object format, and performs one repair retry (lines 139-204).
- `createTelegramNotifier` accepts injected fetch and returns skipped/failed instead of throwing for missing config/network errors (lines 93-150).

## Architecture

Data flow today:
1. Baileys-shaped messages enter `createInboundHandler` as plain `WhatsAppUpsert` objects; there is no real Baileys client wiring yet.
2. Handler uses a repository contract for durable conversations/messages/events and a turn-state contract for transient Redis state.
3. DeepSeek and Telegram are injected callbacks in orchestration modules. Concrete adapters exist but are not integrated into startup/wiring.
4. Follow-up scheduler has deterministic `runOnce()` orchestration but no cron/start-bot runtime.
5. Tests are Node built-in tests with `tsx`; `npm test` is the canonical command. `openspec/config.yaml` declares strict TDD and forbids Prisma/Drizzle/Supabase/WebSockets/Vercel/Meta API/Twilio.

Current dependency gap:
- `package.json` has Next/React/TypeScript tooling only. It does not include `ioredis`, `pg`, or `@whiskeysockets/baileys` yet.

## Recommendation: next smallest safe slice

Implement the **live Redis adapter over `ioredis`** next.

Why this is the smallest safe slice:
- The Redis contract is narrow and fully specified in one file/test pair.
- It has no schema migration or transaction complexity.
- It unblocks both inbound handling and follow-up scheduler collision/lock behavior.
- It is safer than Baileys wiring because Baileys should not be wired until live Redis + live DB can preserve dedupe, locks, and durable state correctly.
- It is smaller than PostgreSQL adapter: the DB contract covers schema creation, JSON settings, unique constraints, timestamp touch rules, mode events, candidate queries, and blocked follow-up updates.
- Adapter integration should wait until at least Redis + PostgreSQL adapters exist; otherwise integration would wire live network sends to in-memory/durable-missing state.

Suggested files for the next slice:
1. Add `ioredis` dependency in `package.json` / `package-lock.json`.
2. Add `src/lib/redis-adapter.ts` implementing the same public methods currently supplied by `createInMemoryTurnState`.
3. Add `tests/redis-adapter.test.ts` using a mocked Redis client object, not a live Redis server.
4. Keep `src/lib/redis-turn-state.ts` unchanged unless shared interfaces need extraction; if extracting, keep it small and preserve existing tests.
5. Update `openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md` only after implementation.

Acceptance criteria for Redis adapter slice:
- RED: tests fail first because `src/lib/redis-adapter.ts` does not exist.
- Adapter uses `ioredis` API semantics but tests use a fake/mocked client; no live Redis required in unit tests.
- Implements parity with `createInMemoryTurnState` methods used by current orchestration:
  - `acceptDedupeMessage(messageId, { ttlSeconds, value? })` uses atomic NX + EX/PX TTL and returns boolean.
  - `enqueueTurnMessage(conversationId, item, { ttlSeconds })` appends to per-conversation queue and refreshes TTL without clobbering concurrent items unsafely. Prefer Redis list operations (`RPUSH` + `EXPIRE`) or a Lua script over JSON read-modify-write.
  - `getQueuedTurnMessages(conversationId)` returns parsed `QueuedTurnMessage[]` in order and treats missing queue as `[]`.
  - `setDebounceMarker(conversationId, { fireAtMs, ttlMs })` stores with PX TTL.
  - `acquireProcessingLock` and follow-up locks use `SET key token NX PX ttlMs`.
  - `releaseProcessingLock`, `releaseFollowupRunnerLock`, and `releaseFollowupConversationLock` release only when the stored token matches. Use Lua or equivalent atomic compare-and-del.
  - `setProcessingState` stores JSON with PX TTL; `getProcessingState` parses safely.
  - `hasActiveTurnState` checks queue/debounce/turn-lock/processing-marker existence.
  - `cleanupTurnState(conversationId, token)` deletes queue/debounce/processing and releases lock only if caller owns the processing lock; wrong-token cleanup removes nothing.
  - Cleanup result preserves `neverTouches` guarantees: `postgres`, `./auth/`, `baileys-session`, `durable-conversation-mode`, `dedupe-keys`.
- Existing tests still pass: `npm test`.
- TypeScript passes: `npx tsc --noEmit`.
- Diff remains under the 400-line review budget excluding lockfile/progress notes.

Do not implement next in this slice:
- Live PostgreSQL adapter/migrations.
- Real Baileys socket/auth/QR wiring.
- Cron/start-bot runtime.
- Cross-adapter integration wiring.

## Start Here

Open `src/lib/redis-turn-state.ts` first. It is the clearest executable contract for a live Redis adapter, and `tests/redis-turn-state.test.ts` shows the exact behavior to preserve.
