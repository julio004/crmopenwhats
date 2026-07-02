# Proposal: CRM Gaps Resolution

## Intent

Resolve key technical debt and correctness gaps in the CRM infrastructure discovered during the post-verification and adversarial reviews of `serious-crm-foundations`. This includes ensuring atomic operations in Postgres, aligning the in-memory repository mock invariants with Postgres constraints, preventing manual conversation name overrides, and avoiding empty audit logs.

## Scope

### In Scope
- Implement transaction boundaries in `createPostgresCrmRepository` for `reassignContactOwner` and `setConversationCrmLink` to ensure audits and data updates are atomic.
- Update `crmDb` in `src/lib/repositories/runtime-crm.ts` to support transaction connection checkouts.
- Enforce CHECK and foreign key constraints in `InMemoryCrmRepository` for `setConversationCrmLink` (non-null contact/account and existing references).
- Prevent compatibility mapping in `conversation-view.ts` from overwriting manually updated conversation names with CRM contact names.
- Avoid writing audit events in Postgres/InMemory repositories when `reassignContactOwner` does not actually change the owner or the contact does not exist.

### Out of Scope
- Rewriting the database structure or schema.
- Changing frontend UI components beyond fixing the name overriding side-effects.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- **`crm-atomic-mutations`**: Atomic updates and audit logging for contact owner reassignment and conversation mapping.
- **`crm-mock-parity`**: In-memory repository constraints alignment for conversation link mapping.
- **`crm-naming-integrity`**: Preserve manual conversation name changes without CRM overwrite.
- **`crm-audit-precision`**: Do not produce empty/no-op audit log entries when updates do not occur.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/repositories/crm-repository.ts` | Modified | Add Postgres transactions and in-memory mock constraint checks. |
| `src/lib/repositories/runtime-crm.ts` | Modified | Add `connect` helper to checkout postgres client for transactions. |
| `src/lib/services/conversation-view.ts` | Modified | Adjust conversation list/view logic to prevent manual name overrides. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Transaction timeouts or deadlocks | Low | Wrap operations in short-lived transactions. |
| Breaking existing tests | Med | Keep existing test suites passing, update test cases to match new strict behavior. |

## Rollback Plan

Roll back to the previous git commit. The changes are entirely backwards-compatible at the database schema level.

## Success Criteria

- [ ] All 139 tests in the test suite pass.
- [ ] In-memory repository throws errors matching Postgres for invalid conversation mappings.
- [ ] No audit records created when owner reassignment is a no-op or contact does not exist.
- [ ] Postgres updates and audits run in atomic transaction blocks.
