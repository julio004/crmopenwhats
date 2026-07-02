# Design: Restore CRM Links on Chat Reentry

## Technical Approach

When an inbound message recreates or reactivates a conversation, the system will derive a normalized WhatsApp identity by stripping companion-device suffixes (e.g., `:52`). This normalized identity will be used to look up matching `crm_contact_methods`. If exactly one CRM contact matches within the active tenant (`instance_id`), the system will automatically recreate the `conversation_crm_links` record. Additionally, the conversation will be unarchived automatically on any inbound customer activity.

## Architecture Decisions

### Decision: Identity Normalization Location

**Choice**: Add a pure function `normalizeWhatsappIdentity` in `src/domain/whatsapp-rules.ts`.
**Alternatives considered**: Do the normalization inline inside the Baileys inbound handler or the database query.
**Rationale**: Keeps normalization rules testable, reusable, and independent of infrastructure. It clearly separates pure domain rules from I/O.

### Decision: CRM Relinking Execution

**Choice**: Add `tryRestoreCrmLink(conversationId, normalizedPhone, instanceId)` to `HandlerRepository` and call it from `inbound-handler.ts` after conversation creation/fetch.
**Alternatives considered**: Add a background reconciliation job or handle it inside `getOrCreateConversation`.
**Rationale**: A targeted repository method keeps the inbound orchestrator declarative while confining the CRM schema queries (checking for exactly 1 match) to the database adapter. It prevents leaking CRM schema concepts into the Baileys handler.

### Decision: Unarchive Trigger

**Choice**: Modify `insertMessageAndTouchConversation` in `postgres-adapter.ts` to set `is_archived = false` when `role === 'user'`.
**Alternatives considered**: Send a separate `updateConversation` call from the inbound handler.
**Rationale**: `insertMessageAndTouchConversation` already handles "touching" the conversation (updating timestamps, unread counts, resetting follow-up states) on new messages. Adding unarchive here is atomic and guarantees consistency.

## Data Flow

    [Baileys Upsert]
         │
         ▼
    Inbound Handler ──(phone)──▶ Domain (normalizeWhatsappIdentity)
         │                              returns normalized phone
         │
         ├─▶ Repo: getOrCreateConversation
         │
         ├─▶ Repo: tryRestoreCrmLink(normalizedPhone)
         │    └─▶ Checks crm_contact_methods for unique match
         │    └─▶ Inserts conversation_crm_links if matched
         │
         └─▶ Repo: insertMessageAndTouchConversation
              └─▶ Sets is_archived = false

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/domain/whatsapp-rules.ts` | Modify | Export `normalizeWhatsappIdentity(phone: string): string` to strip `:\d+$` suffixes. |
| `src/lib/db-contract.ts` | Modify | Add `tryRestoreCrmLink(conversationId: number, normalizedPhone: string, instanceId: number | null): Promise<boolean>` to `HandlerRepository`. |
| `src/lib/postgres-adapter.ts` | Modify | Implement `tryRestoreCrmLink` logic (count matches, insert if exactly 1). Update `insertMessageAndTouchConversation` to unarchive on user messages. |
| `src/lib/baileys/inbound-handler.ts` | Modify | Use `normalizeWhatsappIdentity` and call `tryRestoreCrmLink` after obtaining the conversation. |
| `tests/postgres-adapter.test.ts` | Modify | Add tests for `tryRestoreCrmLink` (0, 1, 2 matches) and unarchive behavior. |
| `tests/inbound-handler.test.ts` | Modify | Mock `tryRestoreCrmLink` and verify it is called with normalized identity. |

## Interfaces / Contracts

```ts
// src/domain/whatsapp-rules.ts
export function normalizeWhatsappIdentity(phoneOrIdentifier: string): string {
    // Strips terminal companion device suffixes like ":52"
}

// src/lib/db-contract.ts - HandlerRepository
tryRestoreCrmLink?(
    conversationId: number,
    normalizedPhone: string,
    instanceId: number | null
): Promise<boolean>;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `normalizeWhatsappIdentity` | Verify it strips `:52` but keeps standard numbers and `@lid` intact. |
| Unit | `inbound-handler.ts` | Verify it calls `tryRestoreCrmLink` with the normalized phone. |
| Integration | `postgres-adapter.ts` | Setup CRM contacts. Test `tryRestoreCrmLink` creates a link when there is 1 match, does nothing for 0 or 2. Test `insertMessageAndTouchConversation` unarchives. |

## Migration / Rollout

No database schema migration is required. The changes utilize existing tables and logic safely degrades if `tryRestoreCrmLink` is not implemented in an in-memory repository mock.

## Open Questions

- None