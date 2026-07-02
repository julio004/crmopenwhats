# Proposal: Fix Inbound AI Failure Cleanup

## Intent

Prevent no-reply stalls when AI provider calls fail at runtime (for example `deepseek_http_401`). Today thrown errors can bypass `done()` and skip `currentResult.cleanup`, leaving Redis queue/processing state orphaned and blocking later turns.

## Scope

### In Scope
- Make inbound AI turn processing release Redis queue, debounce, and processing state even when `callDeepSeek` or adjacent AI steps throw.
- Add a graceful failure path that records and returns an explicit AI runtime failure outcome without sending a partial or duplicate reply.
- Add regression coverage using strict TDD for thrown provider errors and cleanup behavior.

### Out of Scope
- Credential rotation or secret repair.
- AI provider migration, WhatsApp transport/session/auth work, or follow-up scheduler changes.

## Capabilities

### New Capabilities
- `inbound-ai-failure-resilience`: Ensure inbound AI turn failures clean up transient state and fail closed without orphaned locks.

### Modified Capabilities
- None.

## Approach

- Refactor `createInboundHandler` so cleanup ownership is established before provider execution and runs from `finally` regardless of `done()`.
- Catch runtime AI provider failures near the `callDeepSeek` path, preserve the provider reason for logs/events, stop presence safely, and end the turn in a non-reply failure state.
- Follow-up apply work MUST use RED → GREEN → REFACTOR, starting with failing tests in `tests/inbound-handler.test.ts`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/baileys/inbound-handler.ts` | Modified | Always clean turn state on thrown AI/runtime failures and add a graceful failure result/event path. |
| `tests/inbound-handler.test.ts` | Modified | Add regression tests for `deepseek_http_401`-style exceptions and cleanup guarantees. |
| `src/lib/baileys/client.ts` | Modified | Preserve provider failure reason propagation only if the handler needs a stable error surface. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Failure handling masks the provider reason | Med | Record explicit event/log reason and assert it in tests. |
| Cleanup runs without lock ownership | Low | Keep token-scoped cleanup contract and test wrong-token safety. |

## Rollback Plan

Revert the inbound failure-path changes, keep the existing provider wiring, and manually clear affected Redis conversation keys if stale locks remain from pre-fix behavior.

## Dependencies

- Existing Redis cleanup contract in `src/lib/redis-turn-state.ts`
- Existing inbound handler test harness and `npm test`

## Success Criteria

- [ ] A thrown `callDeepSeek` error no longer leaves Redis turn state or locks orphaned.
- [ ] The inbound handler exits through a graceful no-reply failure path with observable reason recording.
- [ ] Apply starts with failing regression tests and ends with `npm test` passing.

## Proposal Question Round

- Should this slice stay silent to the customer on AI runtime failure, with fallback reply copy deferred?
- Should all thrown provider/runtime errors share one cleanup/failure path, with `deepseek_http_401` as the motivating case?
- Should observability be a dedicated conversation event, log-only, or both?

Assumptions: no customer-facing fallback reply in this slice, uniform cleanup for thrown provider errors, and no transport/session changes.
