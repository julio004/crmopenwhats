# Design: Serious CRM Foundations

## Overview

The repo already has stable channel orchestration in `src/lib/baileys/inbound-handler.ts`, `src/lib/followup-scheduler.ts`, and conversation-first APIs/UI under `src/app/api/conversations/*`, `src/app/api/messages/*`, `src/app/HomeClient.tsx`, and `src/components/ContactsOverview.tsx`. The first foundation slice must secure operator access and separate CRM identity from `conversations` without rewriting the WhatsApp layer or bloating `src/lib/db.ts` further.

## Architecture Decisions

| Decision | Why | Concrete files |
|---|---|---|
| Keep `conversations` as channel runtime records | `db-contract.ts`, scheduler, inbound handler, outbox, and message APIs already depend on conversation-centric timestamps/mode semantics | Preserve `src/lib/db-contract.ts`, `src/lib/postgres-adapter.ts`, `src/lib/baileys/inbound-handler.ts`, `src/lib/followup-scheduler.ts` |
| Add durable auth with DB-backed sessions, not env-cookie auth | `src/middleware.ts` and `src/app/api/auth/login/route.ts` currently compare `bot_session` to `ADMIN_PASSWORD`, which is not auditable or per-user | Add `src/lib/auth/session.ts`, `src/lib/auth/password.ts`, `src/lib/auth/bootstrap.ts`, `src/lib/repositories/auth-repository.ts`; update auth routes and middleware |
| Move new auth/CRM persistence into focused repositories/services | `src/lib/db.ts` is already a large facade; adding users, teams, sessions, contacts, mappings, and audit there would harden the wrong boundary | Keep `src/lib/db.ts` for legacy conversation/runtime APIs; add `src/lib/repositories/crm-repository.ts` and `src/lib/services/conversation-view.ts` |
| Separate CRM audit from channel events | `conversation_events` is runtime-oriented; auth and ownership changes need actor identity and before/after snapshots | Add `audit_events`; keep `conversation_events` for WhatsApp/runtime only |

## Schema Plan

| Area | Tables / changes | Notes |
|---|---|---|
| Auth | `users`, `teams`, `team_memberships`, `user_password_credentials`, `user_sessions` | `users.status`, `team_memberships.role` (`owner`,`manager`,`agent`,`viewer`), hashed password only, session token stored as hash with expiry/revocation |
| CRM identity | `crm_accounts`, `crm_contacts`, `crm_contact_methods`, `crm_contact_account_links`, `conversation_crm_links` | Contacts/accounts become CRM roots; methods store normalized WhatsApp phone/JID/email values |
| Conversation compatibility | Add nullable `primary_contact_id` and `primary_account_id` only if needed for fast joins; otherwise derive via `conversation_crm_links` | Do not change inbound/follow-up conversation semantics |
| Audit | `audit_events` | Columns: `actor_user_id`, `team_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `request_metadata`, `created_at` |

## Auth and RBAC Design

`src/middleware.ts` becomes a lightweight gate: allow `/login`, `/api/auth/login`, static/media routes, and redirect/401 when no signed session cookie exists. Durable validation happens in server helpers because the middleware runtime should not depend on `pg` queries.

`src/lib/auth/session.ts` provides `getSessionFromRequest`, `requireSession`, and `requireRole`. Route handlers under `src/app/api/**` call these helpers before reading or mutating data. Phase-1 enforcement points: conversation delete/archive/lead updates, settings, prompts, automations, tasks, WhatsApp instance management, and all future membership/ownership endpoints. Read routes can start at `viewer`; mutating routes require `agent` or above; membership/config changes require `owner` or `manager`.

Migration from env auth: during schema init or first login, `src/lib/auth/bootstrap.ts` seeds one team, one admin user, and one owner membership from `ADMIN_EMAIL`/`ADMIN_PASSWORD` if and only if no users exist. After seeding, login verifies DB credentials and issues a random session id cookie; logout revokes the session row and records audit.

## CRM Identity and Compatibility Layer

`conversations` remains the WhatsApp thread table. `crm_contacts` and `crm_accounts` hold ownership and business identity. `crm_contact_methods` stores normalized channel identifiers; `conversation_crm_links` maps a conversation to the current primary contact/account without rewriting message history.

To keep `/api/conversations` and the current UI stable, `src/lib/services/conversation-view.ts` should compose the existing conversation row plus backward-compatible CRM fields such as `contact_id`, `contact_name`, `account_id`, `account_name`, and `owner_user_id`. `src/components/ContactsOverview.tsx` can keep using `/api/conversations` first, but the payload becomes conversation-centered-with-linked-identity instead of treating conversation as the CRM root.

Ownership changes, membership changes, login success/failure, session revocation, and conversation remaps write `audit_events`. Existing runtime transitions continue writing `conversation_events`.

## Rollout, Rollback, and Tests

Safe slice order:

1. Extend schema and repositories for auth plus `audit_events`.
2. Cut over `src/app/api/auth/*` and `src/middleware.ts` to DB sessions.
3. Add CRM identity/mapping tables and repositories.
4. Update conversation query composition and `/api/conversations*` responses with linked CRM fields.

Rollback: revert middleware/auth/API composition to the current conversation-only flow; new tables are additive and can remain unused. WhatsApp orchestration stays untouched throughout.

Testing stays repo-native: add node tests for auth bootstrap/session/RBAC repositories, route-level authorization, CRM mapping repositories, and `/api/conversations` compatibility shape; keep `tests/inbound-handler.test.ts` and `tests/followup-scheduler.test.ts` green to prove channel preservation. Validate with `npm test` and `npx tsc --noEmit`.
