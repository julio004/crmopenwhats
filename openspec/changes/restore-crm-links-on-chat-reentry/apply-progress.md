# Apply Progress: restore-crm-links-on-chat-reentry

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1, 1.2 | `tests/whatsapp-rules.test.ts` | Unit | ✅ 164/164 | ✅ Written | ✅ Passed | ✅ 3 cases | ➖ None needed |
| 2.1-2.4, 3.1-3.3 | `tests/postgres-adapter.test.ts`, `tests/inbound-handler.test.ts` | Integration | ✅ 165/165 | ✅ Written | ✅ Passed | ✅ 3 cases | ➖ None needed |

### Test Summary
- **Total tests written**: 4
- **Total tests passing**: 4
- **Layers used**: Unit (1), Integration (3)
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: 1

## Completed Tasks

- [x] 1.1 Add `normalizeWhatsappIdentity(phoneOrIdentifier)` in `src/domain/whatsapp-rules.ts` to strip only terminal `:\d+` suffixes from phone-like identifiers.
- [x] 1.2 Add unit tests in `tests/whatsapp-rules.test.ts` for suffixed phone-like IDs and non-suffixed `@lid` identities.
- [x] 2.1 Extend `HandlerRepository` in `src/lib/db-contract.ts` with `tryRestoreCrmLink(conversationId, normalizedPhone, instanceId)`.
- [x] 2.2 Implement `tryRestoreCrmLink` in `src/lib/postgres-adapter.ts` to link only on exactly one tenant-scoped `crm_contact_methods` match.
- [x] 2.3 Update `insertMessageAndTouchConversation` in `src/lib/postgres-adapter.ts` to set `is_archived = false` for inbound user messages.
- [x] 2.4 Wire `normalizeWhatsappIdentity` and `tryRestoreCrmLink` into `src/lib/baileys/inbound-handler.ts` after conversation load/create.
- [x] 3.1 Add failing regressions in `tests/inbound-handler.test.ts` for normalized identity lookup, link restoration, and unarchive-on-user-message behavior.
- [x] 3.2 Add adapter tests in `tests/postgres-adapter.test.ts` for 0, 1, and 2 contact matches plus archived conversation restoration.
- [x] 3.3 Verify `npm test` covers the full inbound re-entry path without creating links on ambiguous or missing matches.
- [x] 4.1 Update any inline comments or test fixtures to reflect the new re-entry behavior and normalization boundary.
- [x] 4.2 Run `npm test` and confirm the diff stays focused on CRM re-entry restoration only.

