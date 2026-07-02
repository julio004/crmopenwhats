# Tasks: Serious CRM Foundations

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700-1000 across 4 slices |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 auth schema/repo -> PR 2 auth runtime -> PR 3 CRM schema/repo -> PR 4 conversation view/API |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Auth schema + repository + audit base | PR 1 | Smallest safe slice; no route cutover yet |
| 2 | Session login/logout + middleware + RBAC guards | PR 2 | Depends on PR 1; keep channel flow untouched |
| 3 | CRM identity + mapping persistence | PR 3 | Depends on PR 1 audit/user ids |
| 4 | Conversation compatibility view + API payload | PR 4 | Depends on PR 3; UI shape stays backward compatible |

## Phase 1: Auth persistence foundation

- [x] 1.1 RED: add `tests/auth-repository.test.ts` for `users`, `teams`, `team_memberships`, `user_password_credentials`, `user_sessions`, and `audit_events` in `src/lib/db-contract.ts` / `src/lib/postgres-adapter.ts`.
- [x] 1.2 GREEN: extend `src/lib/db-contract.ts` schema/types and add `src/lib/repositories/auth-repository.ts` with user, membership, session, and audit methods.
- [x] 1.3 GREEN: add `src/lib/auth/password.ts` and `src/lib/auth/bootstrap.ts` to hash passwords and seed the first owner from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Phase 2: Session auth and RBAC cutover

- [x] 2.1 RED: add `tests/auth-session.test.ts` and `tests/auth-routes.test.ts` for login success/failure, logout revocation, unauthenticated redirects/401, and role denial.
- [x] 2.2 GREEN: add `src/lib/auth/session.ts` for `getSessionFromRequest`, `requireSession`, and `requireRole` using hashed session tokens.
- [x] 2.3 GREEN: update `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, and `src/middleware.ts` to replace the shared cookie with DB sessions.
- [x] 2.4 GREEN: enforce `viewer`/`agent`/`manager` roles in `src/app/api/conversations/[conversationId]/route.ts`, `src/app/api/tasks*.ts`, `src/app/api/settings/route.ts`, `src/app/api/prompts/route.ts`, `src/app/api/automations/route.ts`, and `src/app/api/instances*.ts`.

## Phase 3: CRM identity and mapping persistence

- [x] 3.1 RED: add `tests/crm-repository.test.ts` for contacts independent of conversations, multi-method account links, owner reassignment, and auditable remaps.
- [x] 3.2 GREEN: extend `src/lib/db-contract.ts` with `crm_accounts`, `crm_contacts`, `crm_contact_methods`, `crm_contact_account_links`, and `conversation_crm_links`.
- [x] 3.3 GREEN: add `src/lib/repositories/crm-repository.ts` for identity, ownership, and mapping CRUD plus `audit_events` writes.

## Phase 4: Compatibility view and verification

- [x] 4.1 RED: add `tests/conversation-view.test.ts` and API coverage for `/api/conversations` returning compatible rows plus `contact_*`, `account_*`, and `owner_user_id` fields.
- [x] 4.2 GREEN: add `src/lib/services/conversation-view.ts` and update `src/app/api/conversations/route.ts`, `src/app/api/conversations/[conversationId]/route.ts`, and `src/components/ContactsOverview.tsx` to use linked CRM fields without breaking current consumers.
- [x] 4.3 REFACTOR/VERIFY: run `npm test` and `npx tsc --noEmit`, keeping `tests/inbound-handler.test.ts` and `tests/followup-scheduler.test.ts` green as migration guards.
