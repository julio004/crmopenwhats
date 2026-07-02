# Proposal: Serious CRM Foundations

## Intent

This repo already has durable WhatsApp conversation handling, follow-ups, tasks, and a dashboard, but its foundation is still bot-centric. `src/app/api/auth/login/route.ts` and `src/middleware.ts` use a shared password cookie, `src/lib/db-contract.ts` models `conversations` as both chat thread and CRM identity, and `src/lib/db.ts` concentrates too many concerns behind conversation-first APIs. The problem is not missing deals yet; it is that serious multi-user CRM ownership, auditability, and identity cannot be added safely on top of the current auth and data boundaries.

## Scope

### In Scope
- Define a staged migration that keeps WhatsApp orchestration (`src/lib/baileys/inbound-handler.ts`, `src/lib/followup-scheduler.ts`) as the channel layer.
- Make Phase 1 the security and ownership base: users, teams, memberships, roles, hashed credentials, server-issued sessions, and route/API authorization.
- Make Phase 2 the CRM identity base: contacts, accounts, contact methods, ownership links, and conversation-to-CRM mapping without breaking current conversation flows.
- Frame later phases for deals, reporting facts, and runtime hardening so sequencing is explicit before specs/design.

### Out of Scope
- Rewriting Baileys ingestion, turn-state orchestration, or DeepSeek/Telegram channel adapters.
- Implementing deals, dashboards, or reporting in Phase 1.
- Replacing the whole repository layer before the new schema boundaries exist.

## Capabilities

### New Capabilities
- `auth-rbac-foundation`: authenticated users, team membership, role checks, secure sessions, and audit-ready access boundaries.
- `crm-identity-foundation`: contacts, accounts, contact methods, owners, and links from WhatsApp conversations to CRM identities.
- `conversation-channel-mapping`: preserve existing conversation workflows while mapping them to CRM entities instead of treating conversation as the CRM root.

### Modified Capabilities
- None

## Approach

Sequence by dependency, not ambition: secure access first, introduce CRM identity second, then layer deals/tasks/reporting/runtime hardening on top. This is safest because it removes the current auth risk immediately, preserves working WhatsApp automation, and avoids baking future CRM concepts into `conversations` again.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/middleware.ts` | Modified | Replace shared-cookie auth gate with session and role checks |
| `src/app/api/auth/login/route.ts` | Modified | Replace raw password cookie issuance |
| `src/lib/db-contract.ts` | Modified | Add RBAC and CRM identity schema/contracts |
| `src/lib/db.ts` | Modified | Introduce cleaner CRM/auth repository seams over time |
| `src/app/api/conversations/*` | Modified | Support transitional conversation-to-contact/account behavior |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Identity split breaks current UI/API assumptions | Med | Use transitional mapping; keep conversation APIs alive first |
| Auth cutover locks out operators | Med | Stage migration with seeded admin and rollback path |
| Oversized cross-cutting implementation | High | Spec and task by phase under 400-line review slices |

## Rollback Plan

Ship Phase 1 and Phase 2 behind schema-compatible migrations and transitional APIs. If a phase fails, revert the new auth/CRM entry points and continue operating on the preserved conversation/channel paths.

## Dependencies

- PostgreSQL schema evolution through existing `pg`-based infrastructure
- Follow-on specs/design for auth, identity, and transitional API behavior

## Success Criteria

- [ ] Specs can define Phase 1 auth/RBAC and CRM identity behavior without rewriting WhatsApp orchestration.
- [ ] The proposal establishes explicit non-goals and sequencing for deals/reporting/runtime work.
- [ ] Reviewable implementation slices can be planned within the 400-line budget.
