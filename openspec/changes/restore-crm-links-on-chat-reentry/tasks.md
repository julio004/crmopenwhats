# Tasks: Restore CRM Links on Chat Reentry

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180-260 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Restore CRM link + unarchive on re-entry | PR 1 | Base on current change branch; includes tests |
| 2 | Normalize inbound identity safely | PR 1 | Same PR; keep suffix stripping minimal |

## Phase 1: Foundation / Domain Rules

- [x] 1.1 Add `normalizeWhatsappIdentity(phoneOrIdentifier)` in `src/domain/whatsapp-rules.ts` to strip only terminal `:\d+` suffixes from phone-like identifiers.
- [x] 1.2 Add unit tests in `tests/whatsapp-rules.test.ts` for suffixed phone-like IDs and non-suffixed `@lid` identities.

## Phase 2: CRM Reentry Restoration

- [x] 2.1 Extend `HandlerRepository` in `src/lib/db-contract.ts` with `tryRestoreCrmLink(conversationId, normalizedPhone, instanceId)`.
- [x] 2.2 Implement `tryRestoreCrmLink` in `src/lib/postgres-adapter.ts` to link only on exactly one tenant-scoped `crm_contact_methods` match.
- [x] 2.3 Update `insertMessageAndTouchConversation` in `src/lib/postgres-adapter.ts` to set `is_archived = false` for inbound user messages.
- [x] 2.4 Wire `normalizeWhatsappIdentity` and `tryRestoreCrmLink` into `src/lib/baileys/inbound-handler.ts` after conversation load/create.

## Phase 3: TDD Regression Coverage

- [x] 3.1 Add failing regressions in `tests/inbound-handler.test.ts` for normalized identity lookup, link restoration, and unarchive-on-user-message behavior.
- [x] 3.2 Add adapter tests in `tests/postgres-adapter.test.ts` for 0, 1, and 2 contact matches plus archived conversation restoration.
- [x] 3.3 Verify `npm test` covers the full inbound re-entry path without creating links on ambiguous or missing matches.

## Phase 4: Cleanup / Verification

- [x] 4.1 Update any inline comments or test fixtures to reflect the new re-entry behavior and normalization boundary.
- [x] 4.2 Run `npm test` and confirm the diff stays focused on CRM re-entry restoration only.
