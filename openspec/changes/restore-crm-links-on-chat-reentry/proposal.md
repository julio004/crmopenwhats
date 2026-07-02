# Proposal: Restore CRM Links on Chat Reentry

## Proposal Question Round

- Assumption: deleting a chat should remove only the conversation thread; surviving CRM contact methods must be enough to rebuild identity on the next inbound upsert.
- Assumption: re-entry repair should happen inline during inbound processing, not through a later reconciliation job.
- Review: if more than one CRM contact matches the same normalized WhatsApp identity, the follow-on spec should define a safe no-auto-link fallback.

## Intent

Fix the bug where deleting a conversation permanently removes a contact from CRM views. Today deleting a conversation cascades `conversation_crm_links`; later inbound upserts recreate the conversation row, but no CRM link is rebuilt. The repair should follow the inbound-upsert identity model: rebuild mapping from surviving CRM contact methods, not from prior chat permanence.

## Scope

### In Scope
- Restore `conversation_crm_links` when an inbound customer message recreates or re-enters a conversation and a unique existing CRM contact matches the inbound WhatsApp identity.
- Normalize inbound WhatsApp identity only as far as needed for reliable re-entry matching, including stripping companion-device suffixes such as `:52` from phone-like identifiers before CRM lookup.
- Unarchive an existing matched conversation on new inbound user activity when archive state would otherwise hide the contact after re-entry.

### Out of Scope
- New CRM merge/dedupe workflows, bulk backfills, or background reconciliation jobs.
- Schema redesign, contact deletion rules, or broader Baileys identity refactors beyond the minimum re-entry match.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `whatsapp-automation`: inbound turns MUST restore visible conversation state on customer re-entry and use normalized inbound identity for matching.
- `crm-identity-foundation`: CRM contact methods MUST be sufficient to re-link a recreated conversation after the old thread was deleted.

## Approach

Apply MUST be TDD-first. Add failing regressions before code changes. On inbound upsert, derive a stable identity from the message, create/load the conversation, look up a tenant-scoped CRM contact by persisted WhatsApp methods, recreate `conversation_crm_links` when the match is unique, and unarchive the conversation when the new customer message reactivates it. Prefer repository helpers over schema changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/baileys/inbound-handler.ts` | Modified | Re-entry identity derivation, relink trigger, unarchive trigger |
| `src/lib/repositories/crm-repository.ts` | Modified | Tenant-scoped CRM identity lookup and link restoration |
| `src/lib/baileys/client.ts` | Modified | Wire CRM relink dependency into runtime inbound flow |
| `tests/inbound-handler.test.ts` | Modified | RED-GREEN re-entry and unarchive regressions |
| `tests/crm-repository.test.ts` | Modified | RED-GREEN contact-method match regressions |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| False-positive relink if normalization collapses distinct identities | Med | Auto-link only on unique tenant-scoped exact normalized matches |
| Scope drifts into full CRM dedupe | Low | Keep follow-on specs limited to re-entry restoration and minimum normalization |

## Rollback Plan

Revert the inbound relink/unarchive behavior and its tests together; fallback returns to current conversation recreation without automatic CRM reattachment.

## Dependencies

- Existing `crm_contact_methods` data must survive conversation deletion.
- Apply phase MUST use strict TDD with `npm test`.

## Success Criteria

- [ ] After deleting a conversation, a later inbound message recreates a visible conversation and restores the CRM contact link when a unique method match exists.
- [ ] Companion-device suffixes no longer prevent correct re-entry matching, and the implementation starts from failing regression tests.
