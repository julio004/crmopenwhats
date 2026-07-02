# Verify Report: normalize-whatsapp-turns-followups

## Verification Report

**Change**: `normalize-whatsapp-turns-followups`
**Mode**: hybrid
**Focus**: full change verification after artifact reconciliation, including the `getOrCreateConversation` phone/LID corrective slice
**Strict TDD**: Active
**Final Verdict**: **FAIL**

### Completeness

| Dimension | Result | Details |
| --- | --- | --- |
| Proposal/spec/design/tasks/apply-progress available | ✅ | All authoritative OpenSpec inputs requested for this rerun were present and reviewed. |
| Runtime verification executed | ✅ | Targeted regression execution, full `npm test`, `npx tsc --noEmit`, `npm run build`, and repository diff checks were executed in this verify pass. |
| Tasks total | ✅ | 55 checklist items found in `tasks.md`. |
| Tasks complete | ⚠️ | 1/55 checked (`getOrCreateConversation` corrective task). |
| Tasks incomplete | ❌ | 54/55 remain unchecked, including core implementation and verify items. |
| Verify report artifact updated | ✅ | This file reflects the post-reconciliation rerun. |

### Build / Test / Coverage Evidence

| Command | Result | Notes |
| --- | --- | --- |
| `npm test -- --test-name-pattern="unique constraint violation|repairs an existing LID conversation phone"` | ✅ PASS | PostgreSQL collision regressions and the preserved LID-repair path passed at runtime. |
| `npm test` | ✅ PASS | 164 tests passed across 49 suites. |
| `npx tsc --noEmit` | ✅ PASS | TypeScript completed with no errors. |
| `npm run build` | ✅ PASS | Next.js 16 production build compiled and generated routes successfully. |
| `npm run lint` | ⚠️ WARNING | Fails with `Invalid project directory provided ... \waopen\lint`; the configured lint script is not currently executable as written. |
| `git diff --check -- openspec/changes/normalize-whatsapp-turns-followups src/lib/postgres-adapter.ts tests/postgres-adapter.test.ts` | ✅ PASS | No whitespace or trailing-space violations were reported; only Git CRLF warnings were emitted. |
| `git diff --stat -- src/lib/postgres-adapter.ts tests/postgres-adapter.test.ts openspec/changes/normalize-whatsapp-turns-followups/apply-progress.md openspec/changes/normalize-whatsapp-turns-followups/tasks.md` | ✅ PASS | 181 changed lines in the corrective implementation/evidence set; within the 400-line review budget. |

**Coverage analysis**: Skipped — no coverage tool is configured in this repository.

### TDD Compliance

| Check | Result | Details |
| --- | --- | --- |
| TDD evidence reported | ✅ | `apply-progress.md` contains RED/GREEN/TDD evidence for the original slices and the July 1 corrective regression slices. |
| Relevant regression tests exist | ✅ | `tests/postgres-adapter.test.ts` contains both collision regression tests and the preserved LID repair case. |
| GREEN confirmed by runtime execution | ✅ | Targeted regression run and the full suite both passed in this verify rerun. |
| Triangulation adequate | ✅ | Runtime evidence covers phone-priority selection, collision-without-update, collision-with-name-backfill, and the historical LID phone repair path. |
| Safety-net traceability for modified files | ⚠️ | `apply-progress.md` uses older TDD evidence tables and does not include the stricter explicit `Safety Net` field for every modified-file slice. |

**TDD Compliance**: 4/5 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
| --- | --- | --- | --- |
| Unit | 3 slice-specific regression cases plus broader feature unit coverage | `tests/postgres-adapter.test.ts` and related contract files | `node:test` + `tsx` + fake `pg` / fake Redis / injected adapters |
| Integration | API-route and service interaction tests present in the full suite | multiple route/service test files | `node:test` + direct route/service invocation |
| E2E | 0 | 0 | Not used |
| **Total** | **164** | **49 suites** | |

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected.

### Assertion Quality

**Assertion quality**: ✅ All reviewed slice-relevant assertions verify real behavior.

Reviewed runtime assertions exercise production code and validate observable outcomes for:

- existing-row selection priority between phone and LID matches;
- refusal to apply conflicting `phone` or `jid` updates;
- safe name backfill when a collision exists;
- preserved historical LID-to-real-phone repair behavior.

No tautologies, ghost loops, smoke-only assertions, or implementation-detail-only checks were found in the reviewed corrective tests.

### Spec Compliance Matrix

| Requirement / Scenario | Status | Runtime Evidence | Notes |
| --- | --- | --- | --- |
| Inbound Turn Lifecycle — persists inbound data before reply and finalizes transient state safely | ✅ COMPLIANT | `tests/inbound-handler.test.ts` (`persists accepted messages before DeepSeek...`, `AI mode customer message... finalizes`, `invalid DeepSeek JSON... finalizes without auth cleanup`) | Runtime coverage plus source inspection support the persist → history → reply/finalize lifecycle. |
| Idempotency, Deduplication, and Debounced Queueing | ✅ COMPLIANT | `tests/inbound-handler.test.ts` duplicate/debounce cases; `tests/redis-turn-state.test.ts`; `tests/redis-adapter.test.ts` | Deduplication, queueing, token-owned locks, and safe cleanup all passed at runtime. |
| Owner Intervention and Activation Keyword | ✅ COMPLIANT | `tests/inbound-handler.test.ts` owner control cases; `tests/whatsapp-rules.test.ts` owner keyword control | Owner `fromMe` handling uses `ok.` activation only and preserves customer non-toggle behavior. |
| Owner Reactivation and Intervention Refresh | ✅ COMPLIANT | `tests/inbound-handler.test.ts` owner enable/disable refresh cases; `tests/db-contract.test.ts` timestamp/event semantics | HUMAN refresh and AI reactivation behavior are covered. |
| Conversation Labels, States, and Timestamps | ✅ COMPLIANT | `tests/db-contract.test.ts`; `tests/postgres-adapter.test.ts` timestamp/mode/event cases | Roles, timestamps, mode separation, and follow-up resets are covered by runtime tests. |
| Follow-Up Scheduling Without Active Conversation Collision | ✅ COMPLIANT | `tests/followup-scheduler.test.ts` eligible send, active-turn skip, NO decision, duplicate follow-up skip | Scheduler behavior, collision avoidance, and audit paths passed at runtime. |
| WhatsApp 24-Hour Boundary and Spam Risk Handling | ✅ COMPLIANT | `tests/followup-scheduler.test.ts` blocked-outside-24h case; `tests/postgres-adapter.test.ts` blocked-followup audit helper | Automatic follow-ups are blocked/audited outside the allowed window. |
| Contacts CRM Uses Persisted Conversations | ✅ COMPLIANT | `tests/conversation-view.test.ts` API compatibility payload cases; source inspection in `src/components/ContactsOverview.tsx` | Contacts view consumes persisted conversation rows rather than fake seeded contacts. |
| JSON Workflow Parity on Local Stack | ✅ COMPLIANT | Full suite across inbound handler, DeepSeek adapter, Redis adapter, PostgreSQL adapter, follow-up scheduler | Behavioral mapping to local Baileys/PostgreSQL/Redis/DeepSeek/scheduler components is covered by distributed runtime tests. |
| Authoritative task completion for the change | ❌ FAILING | `tasks.md` checklist review | Only 1 of 55 tasks is checked, so formal completion is not proven for archive. |

### Correctness Table

| Check | Result | Evidence |
| --- | --- | --- |
| Phone/LID collision resolution prioritizes the correct existing row | ✅ PASS | `src/lib/postgres-adapter.ts`; targeted regression tests passed |
| Collision checks prevent conflicting `phone` writes | ✅ PASS | `tests/postgres-adapter.test.ts` collision regression |
| Collision checks prevent conflicting `jid` writes during name backfill | ✅ PASS | `tests/postgres-adapter.test.ts` name-backfill collision regression |
| Historical LID phone repair still works | ✅ PASS | `repairs an existing LID conversation phone...` runtime test |
| Diff hygiene is clean after reconciliation | ✅ PASS | `git diff --check` produced no whitespace violations |
| Lint command is healthy | ⚠️ WARNING | `npm run lint` currently fails because the configured script is invalid in this environment |
| Formal task artifact matches implemented change scope | ❌ FAIL | `tasks.md` still contains 54 unchecked items |

### Design Coherence Table

| Design Point | Result | Evidence |
| --- | --- | --- |
| Durable conversation identity remains a PostgreSQL responsibility | ✅ PASS | Corrective logic stays in `src/lib/postgres-adapter.ts`. |
| Transient turn coordination remains Redis-scoped | ✅ PASS | Queue/lock/debounce behavior remains in Redis contracts/adapters and related tests. |
| Owner control remains owner-only via `fromMe` + activation keyword | ✅ PASS | Inbound handler and rule tests match the design. |
| Follow-ups remain 12-hour due evaluations with 24-hour blocking | ✅ PASS | Scheduler/runtime tests reflect the designed behavior. |
| OpenSpec task synchronization is complete | ❌ FAIL | `tasks.md` now records the corrective bugfix, but the broader change ledger is still overwhelmingly unchecked. |

### Issues

#### CRITICAL

- `openspec/changes/normalize-whatsapp-turns-followups/tasks.md` still has 54 unchecked items out of 55 total. Under the authoritative task-artifact rule, the change is not formally complete and cannot pass archive readiness.

#### WARNING

- `npm run lint` fails with `Invalid project directory provided, no such directory: C:\Users\Asistente\Desktop\Nueva_carpeta\waopen\lint`.
- Strict-TDD evidence is present, but the apply artifact still uses the older evidence format without explicit `Safety Net` fields.

#### SUGGESTION

- Reconcile `tasks.md` to reflect actual completion state for the broader change, or split the July 1 corrective work into its own small OpenSpec change if the parent change is intentionally still open.
- Repair or replace the lint script so future verify runs have a working lint quality gate.

### Final Assessment

Artifact reconciliation improved the formal state: the corrective `getOrCreateConversation` task is now checked and the previous whitespace warning is gone. Runtime evidence still shows the implementation behaving correctly across inbound processing, owner controls, follow-ups, CRM persisted-contact usage, and the July 1 phone/LID collision fix.

However, the authoritative task ledger is still not complete. Because `tasks.md` remains 54/55 unchecked, formal SDD verification does **not** pass and the change is **not** ready for archive.

### Archive Readiness

**Not ready for archive.**

Required before archive:

1. reconcile `tasks.md` so the authoritative checklist reflects the implemented scope and verify-complete state;
2. fix the broken `npm run lint` script or document why lint is intentionally unavailable.
