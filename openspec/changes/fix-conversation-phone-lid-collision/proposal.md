# Proposal: Isolate Conversation Phone/LID Collision Fix

## Proposal Question Round

- Assumption: this change exists only to give the already-implemented bugfix its own archiveable OpenSpec trail.
- Assumption: the follow-on delta should stay under the existing `whatsapp-automation` capability rather than create a parallel domain.
- Review only if archive sequencing later requires a different capability split.

## Intent

Separate the already-implemented `getOrCreateConversation` fix from `normalize-whatsapp-turns-followups` so it can be verified and archived independently. The fix prevents unique-key failures and wrong-row mutation when a phone row and an `@lid` row both match the same conversation, including the name-backfill path.

## Scope

### In Scope
- Document safe row selection when phone and `@lid` matches coexist.
- Document collision guards that MUST skip conflicting `phone` or `jid` writes during repair and name backfill.
- Capture regression coverage expectations for `src/lib/postgres-adapter.ts` and `tests/postgres-adapter.test.ts`.

### Out of Scope
- Owner controls, follow-up scheduling, CRM/UI, or runtime wiring from the parent change.
- New schema redesign beyond the adapter behavior already exercised by this corrective fix.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `whatsapp-automation`: clarify `getOrCreateConversation` identity resolution for phone/LID collisions and safe name backfill.

## Approach

Create a narrow corrective change that references the existing implementation and limits the spec surface to durable conversation identity matching. Keep follow-on specs/tasks centered on PostgreSQL repository behavior already proven by targeted regressions, and explicitly record that this split exists because the parent change is still too large to archive.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/fix-conversation-phone-lid-collision/proposal.md` | New | Isolated archiveable change record |
| `src/lib/postgres-adapter.ts` | Modified | `getOrCreateConversation` row selection and collision-safe updates |
| `tests/postgres-adapter.test.ts` | Modified | Regression coverage for collision and name-backfill cases |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope drifts back into the parent change | Med | Keep follow-on spec/tasks limited to this adapter bugfix |
| Archive wording diverges from parent capability naming | Low | Reuse `whatsapp-automation` from the parent artifacts |

## Rollback Plan

If separate tracking causes confusion, revert this isolated OpenSpec change and keep the bugfix documented only under `normalize-whatsapp-turns-followups`. If code rollback is needed later, revert `src/lib/postgres-adapter.ts` and `tests/postgres-adapter.test.ts` together.

## Dependencies

- Existing corrective implementation and passing regressions in `src/lib/postgres-adapter.ts` and `tests/postgres-adapter.test.ts`

## Success Criteria

- [ ] The change stays strictly limited to phone/LID collision resolution and the name-backfill regression path.
- [ ] A future spec/tasks/verify sequence can archive this bugfix without requiring the parent change to be complete.
