# Apply Progress: Serious CRM Foundations

## Change

- Change: `serious-crm-foundations`
- Mode: Strict TDD
- Delivery: stacked PR slice (`force-chained` resolved to `stacked-to-main`)
- Current slice: post-review corrective fixes for conversation PATCH compatibility and CRM owner reassignment parity

## Completed Tasks

- [x] 1.1 RED: add `tests/auth-repository.test.ts` for auth/audit schema and repository boundaries.
- [x] 1.2 GREEN: extend `src/lib/db-contract.ts` schema/types and add `src/lib/repositories/auth-repository.ts`.
- [x] 1.3 GREEN: add `src/lib/auth/password.ts` and `src/lib/auth/bootstrap.ts`.
- [x] 2.1 RED: add `tests/auth-session.test.ts` and `tests/auth-routes.test.ts`.
- [x] 2.2 GREEN: add `src/lib/auth/session.ts`.
- [x] 2.3 GREEN: update auth routes and `src/middleware.ts` to DB sessions.
- [x] 2.4 GREEN: enforce roles in protected API routes.
- [x] 3.1 RED: add `tests/crm-repository.test.ts` for CRM identity and remap behavior.
- [x] 3.2 GREEN: extend `src/lib/db-contract.ts` with CRM identity and mapping tables.
- [x] 3.3 GREEN: add `src/lib/repositories/crm-repository.ts` for identity, ownership, and mapping CRUD plus audit writes.
- [x] 4.1 RED: add `tests/conversation-view.test.ts` and compatibility API coverage.
- [x] 4.2 GREEN: add `src/lib/services/conversation-view.ts` and compatible `/api/conversations*` payload composition.
- [x] 4.3 REFACTOR/VERIFY: keep the full suite and typecheck green, including WhatsApp migration guards.

## Post-Verify Corrective Slice

- [x] Verify follow-up: add route-level auth regression coverage for `GET /api/conversations` covering missing session, revoked session, and `viewer` access.
- [x] Verify follow-up: enforce durable `viewer` session validation inside `src/app/api/conversations/route.ts` while preserving the compatibility payload shape.

## Post-Review Corrective Slice

- [x] Review follow-up: preserve the freshly updated conversation `name` in `PATCH /api/conversations/[conversationId]` responses while keeping CRM compatibility fields.
- [x] Review follow-up: make Postgres CRM owner reassignment fail without audit writes when the target contact does not exist.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `tests/auth-repository.test.ts` | Unit | ✅ `tests/db-contract.test.ts` 9/9 passing | ✅ Written first; missing auth modules failed import | ✅ `node --import tsx --test tests/auth-repository.test.ts tests/auth-bootstrap.test.ts` | ✅ schema + in-memory + SQL session cases | ✅ kept repository API narrow |
| 1.2 | `tests/auth-repository.test.ts` | Unit | ✅ `tests/db-contract.test.ts` 9/9 passing | ✅ repository/schema expectations existed before implementation | ✅ auth repository tests 7/7 passing | ✅ in-memory + Postgres query paths | ✅ extracted shared email normalization |
| 1.3 | `tests/auth-bootstrap.test.ts` | Unit | N/A (new files) | ✅ bootstrap/password tests written first | ✅ auth bootstrap tests 7/7 passing | ✅ hash verify + bootstrap create/skip cases | ✅ bootstrap kept as thin orchestration |
| 2.1 | `tests/auth-session.test.ts`, `tests/auth-routes.test.ts` | Unit | ✅ `npm test` 116/116 passing | ✅ written first; missing `src/lib/auth/session.ts` failed import | ✅ `node --import tsx --test tests/auth-session.test.ts tests/auth-routes.test.ts` | ✅ valid/invalid login, revoked/expired sessions, middleware path matrix | ✅ shared request builders kept auth tests focused |
| 2.2 | `tests/auth-session.test.ts` | Unit | ✅ `npm test` 116/116 passing | ✅ session helpers referenced before implementation | ✅ auth session tests 3/3 passing | ✅ active, expired, revoked, and role hierarchy cases | ✅ extracted cookie/token helpers plus auth error mapping |
| 2.3 | `tests/auth-routes.test.ts` | Unit | ✅ `npm test` 116/116 passing | ✅ route factories expected DB session behavior before cutover | ✅ auth route tests 3/3 passing | ✅ login success/failure, logout revoke, API/page gate | ✅ extracted `runtimeSessionDeps` to keep auth route wiring thin |
| 2.4 | `tests/auth-session.test.ts`, `tests/auth-routes.test.ts` | Unit | ✅ `npm test` 116/116 passing | ✅ viewer/manager protection expectations existed before enforcement | ✅ `npm test` and `npx tsc --noEmit` passing after route guard wiring | ✅ viewer, agent, manager thresholds across protected route handlers | ✅ reused shared `requireRequestRole` instead of duplicating checks |
| 3.1 | `tests/crm-repository.test.ts` | Unit | ✅ `node --import tsx --test tests/db-contract.test.ts tests/auth-repository.test.ts` 13/13 passing | ✅ written first; missing `src/lib/repositories/crm-repository.ts` failed import | ✅ `node --import tsx --test tests/crm-repository.test.ts` | ✅ contact-without-conversation, multi-method links, owner reassignment, remap audit, and Postgres SQL boundaries | ✅ kept one focused CRM test file instead of spreading fixture noise |
| 3.2 | `tests/crm-repository.test.ts`, `tests/db-contract.test.ts` | Unit | ✅ `node --import tsx --test tests/db-contract.test.ts tests/auth-repository.test.ts` 13/13 passing | ✅ schema/table expectations existed before implementation | ✅ `node --import tsx --test tests/crm-repository.test.ts tests/db-contract.test.ts` | ✅ schema fragments plus in-memory link behavior exercised different paths | ✅ kept CRM tables additive so conversation runtime stayed untouched |
| 3.3 | `tests/crm-repository.test.ts` | Unit | N/A (new file) | ✅ repository API referenced before implementation | ✅ `node --import tsx --test tests/db-contract.test.ts tests/auth-repository.test.ts tests/crm-repository.test.ts` | ✅ in-memory + Postgres owner/mapping audit flows | ✅ extracted shared audit insert helper and mapping snapshot builder |
| 4.1 | `tests/conversation-view.test.ts` | Unit | ✅ `npm test` 127/127 passing | ✅ written first; missing `src/lib/services/conversation-view.ts` failed import | ✅ `node --import tsx --test tests/conversation-view.test.ts` | ✅ service fallback + CRM-enriched route payload cases | ✅ kept compatibility assertions in one focused test file |
| 4.2 | `tests/conversation-view.test.ts` | Unit | ✅ `npm test` 127/127 passing | ✅ route/service factories were referenced before implementation | ✅ `node --import tsx --test tests/conversation-view.test.ts` 4/4 passing | ✅ list payload + patch payload + no-mapping fallback cover different code paths | ✅ extracted `enrichConversation` and UI display helpers to avoid breaking legacy consumers |
| 4.3 | `tests/conversation-view.test.ts`, `tests/inbound-handler.test.ts`, `tests/followup-scheduler.test.ts` | Unit | ✅ `npm test` 131/131 passing | ✅ verification expectations recorded before final pass | ✅ `npm test` and `npx tsc --noEmit` passing | ✅ targeted compatibility tests plus full-suite migration guards | ✅ final payload wiring stayed additive; WhatsApp runtime untouched |
| PV-1 | `tests/conversation-view.test.ts` | Unit | ✅ `node --import tsx --test tests/conversation-view.test.ts` 4/4 passing before fix | ✅ added missing-session + revoked-session + viewer-access assertions before route changes; missing-session initially failed 200 vs 401 | ✅ `node --import tsx --test tests/conversation-view.test.ts` 6/6 passing after route guard wiring | ✅ missing session, revoked session, and viewer success exercise distinct auth paths without changing payload shape | ✅ reused shared auth helpers and kept the route payload contract intact |
| PR-1 | `tests/conversation-view.test.ts` | Unit | ✅ `node --import tsx --test tests/conversation-view.test.ts` 6/6 passing before review fixes | ✅ added PATCH assertion for the freshly edited `name`; it failed because the compatibility row overwrote `Nuevo nombre` with `Mapped Contact` | ✅ `node --import tsx --test tests/conversation-view.test.ts tests/crm-repository.test.ts` 12/12 passing after response merge fix | ✅ preserved edited base `name` while keeping additive CRM fields in the same response | ✅ extracted a tiny response merge helper instead of changing global compatibility composition |
| PR-2 | `tests/crm-repository.test.ts` | Unit | ✅ `node --import tsx --test tests/crm-repository.test.ts` 4/4 passing before review fixes | ✅ added missing-contact rejection coverage first; Postgres path initially returned `undefined` and still attempted audit behavior | ✅ `node --import tsx --test tests/conversation-view.test.ts tests/crm-repository.test.ts` 12/12 passing after not-found guard | ✅ existing owner-reassignment SQL path plus missing-contact edge case now exercise distinct success/failure branches | ✅ kept Postgres behavior aligned with the in-memory adapter using the same error contract |

## Test Summary

- Total tests written: 26
- Total tests passing: 134 (`npm test`)
- Layers used: Unit (26), Integration (0), E2E (0)
- Approval tests: None — additive compatibility layer slice
- Pure functions created: 10 (`hashPassword`, `verifyPassword`, `hashSessionToken`, `normalizeMethodValue`, `mappingSnapshot`, `enrichConversation`, `mergePatchedConversationResponse`, `contactDisplayName`, `contactDisplayPhone`, `contactDisplayJid`)

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `tests/auth-repository.test.ts` | Created | Added RED coverage for auth schema, repository behavior, and durable session SQL boundaries. |
| `tests/auth-bootstrap.test.ts` | Created | Added password hashing and bootstrap seed tests. |
| `src/lib/db-contract.ts` | Modified | Added auth/audit schema plus row/type exports for the durable foundation, then extended it with CRM identity and mapping tables. |
| `src/lib/repositories/auth-repository.ts` | Created | Added isolated auth repository adapters for Postgres and in-memory use. |
| `src/lib/auth/password.ts` | Created | Added scrypt password hashing and verification helpers. |
| `src/lib/auth/bootstrap.ts` | Created | Added first-owner bootstrap flow from admin env inputs. |
| `tests/auth-session.test.ts` | Created | Added RED coverage for durable session lookup, revocation, expiry, and role hierarchy. |
| `tests/auth-routes.test.ts` | Created | Added RED coverage for DB-backed login/logout and middleware gating. |
| `src/lib/auth/session.ts` | Created | Added hashed session issuance, request validation, role checks, and auth error helpers. |
| `src/lib/auth/runtime.ts` | Created | Added schema-safe runtime auth repository wiring for server routes. |
| `src/lib/repositories/auth-repository.ts` | Modified | Added user lookup by id for durable session resolution. |
| `src/app/api/auth/login/route.ts` | Modified | Cut login over to DB credentials plus opaque session cookies. |
| `src/app/api/auth/logout/route.ts` | Modified | Revokes durable sessions and clears the auth cookie. |
| `src/middleware.ts` | Modified | Switched edge gate from env-secret matching to session-cookie presence checks. |
| `src/app/api/conversations/[conversationId]/route.ts` | Modified | Added compatibility PATCH response composition while preserving the existing destructive auth guard. |
| `src/app/api/tasks/route.ts` | Modified | Enforced `viewer`/`agent` task route access. |
| `src/app/api/tasks/[taskId]/route.ts` | Modified | Enforced `agent` role for task mutations. |
| `src/app/api/settings/route.ts` | Modified | Enforced `viewer` read and `manager` config writes. |
| `src/app/api/prompts/route.ts` | Modified | Enforced `viewer` reads and `manager` prompt changes. |
| `src/app/api/automations/route.ts` | Modified | Enforced `viewer` reads and `manager` automation changes. |
| `src/app/api/instances/route.ts` | Modified | Enforced `viewer` reads and `manager` instance creation. |
| `src/app/api/instances/[instanceId]/route.ts` | Modified | Enforced `manager` role for instance switching and deletion. |
| `tests/crm-repository.test.ts` | Created | Added RED coverage for CRM identity tables, contact/account links, owner reassignment, conversation remaps, and SQL boundaries. |
| `src/lib/repositories/crm-repository.ts` | Created | Added focused Postgres and in-memory CRM repositories with audit writes for owner changes and conversation remaps. |
| `tests/conversation-view.test.ts` | Created | Added RED/GREEN coverage for compatibility enrichment and `/api/conversations*` payloads. |
| `src/lib/services/conversation-view.ts` | Created | Added CRM compatibility composition over legacy conversation rows plus runtime join loading. |
| `src/app/api/conversations/route.ts` | Modified | Switched conversation list responses to the compatibility service and now enforces durable `viewer` session validation at the route level. |
| `src/lib/db.ts` | Modified | Extended `ConversationListRow` typing with additive CRM compatibility fields. |
| `src/components/ContactsOverview.tsx` | Modified | Rendered linked contact/account fields while keeping `/api/conversations` legacy fallbacks intact. |
| `openspec/changes/serious-crm-foundations/tasks.md` | Modified | Marked all Phase 4 tasks complete. |
| `tests/conversation-view.test.ts` | Modified | Added post-verify auth regression coverage for missing session, revoked session, and allowed `viewer` access on `GET /api/conversations`. |
| `tests/conversation-view.test.ts` | Modified | Added a regression assertion proving PATCH keeps the freshly edited conversation `name` while still returning linked CRM fields. |
| `tests/crm-repository.test.ts` | Modified | Added missing-contact Postgres coverage to prove owner reassignment rejects and skips audit writes when no contact exists. |
| `src/app/api/conversations/[conversationId]/route.ts` | Modified | Merged PATCH responses so the updated base conversation `name` wins over CRM compatibility aliasing while additive CRM fields remain intact. |
| `src/lib/repositories/crm-repository.ts` | Modified | Guarded Postgres owner reassignment against missing contacts before any audit write, matching the in-memory adapter contract. |
| `openspec/changes/serious-crm-foundations/apply-progress.md` | Modified | Merged the post-verify route-level auth fix into the cumulative strict-TDD artifact. |
| `openspec/changes/serious-crm-foundations/apply-progress.md` | Modified | Merged the post-review compatibility/audit corrective slice into the cumulative strict-TDD artifact. |

## Deviations from Design

None — implementation matches the compatibility-layer design and keeps the WhatsApp runtime untouched.

## Issues Found

- Working tree already had unrelated edits in `src/components/Sidebar.tsx` and `src/lib/baileys/client.ts`; this slice did not modify them.
- The branch also carries forward earlier PR 3 uncommitted files (`src/lib/repositories/crm-repository.ts`, `tests/crm-repository.test.ts`, `src/lib/db-contract.ts`) which were preserved and not reworked in this slice.
- `PATCH /api/conversations/[conversationId]` reused the compatibility payload shape, but that shape aliases `name` to the linked CRM contact when present; the route needed a local response merge to avoid masking just-edited conversation names.

## Remaining Tasks

- [ ] None — all scoped Phase 1 through Phase 4 tasks are complete.

## Workload / PR Boundary

- Mode: stacked PR slice
- Current work unit: post-review corrective slice for conversation PATCH compatibility and CRM audit parity
- Boundary: starts from fresh review warnings on conversation PATCH compatibility and CRM owner-reassignment audit parity, ends with two focused regressions plus minimal route/repository fixes only
- Estimated review budget impact: low; two focused files changed and unrelated pre-existing edits remain untouched

## Verification

- ✅ Baseline safety net: `npm test` (127/127 passing before Phase 4 changes)
- ✅ RED: `node --import tsx --test tests/conversation-view.test.ts` (failed on missing `src/lib/services/conversation-view.ts`)
- ✅ GREEN: `node --import tsx --test tests/conversation-view.test.ts`
- ✅ Safety net for corrective slice: `node --import tsx --test tests/conversation-view.test.ts` (4/4 passing before auth regression additions)
- ✅ RED corrective slice: `node --import tsx --test tests/conversation-view.test.ts` (failed 200 vs 401 before route-level auth guard)
- ✅ GREEN corrective slice: `node --import tsx --test tests/conversation-view.test.ts` (6/6 passing)
- ✅ RED review slice: `node --import tsx --test tests/conversation-view.test.ts tests/crm-repository.test.ts` (failed on PATCH name aliasing and missing-contact Postgres parity)
- ✅ GREEN review slice: `node --import tsx --test tests/conversation-view.test.ts tests/crm-repository.test.ts` (12/12 passing)
- ✅ Final suite: `npm test` (134/134 passing)
- ✅ Final typecheck: `npx tsc --noEmit`

## Status

13/13 tasks complete. Ready for re-verify.
