# Design: Normalize WhatsApp Turns, Owner Controls, and Follow-Ups

## Overview

This design specifies the future update to `promt.md` for change `normalize-whatsapp-turns-followups`. It does not edit `promt.md` in this phase.

The design keeps the project on the approved local stack: Baileys, PostgreSQL through `pg`, Redis through `ioredis`, DeepSeek through native `fetch` or an HTTP client, and a local scheduler (`node-cron` or robust `setInterval`). It replaces the n8n/Evolution/OpenAI/official WhatsApp API assumptions from `concepto.json` and `seguimiento.json` with local equivalents.

Key decision: a WhatsApp inbound message is a processing turn. The turn may be delayed by debounce to group rapid customer messages, but all accepted messages are persisted before any LLM call. Finalizing a turn only clears transient Redis state; it must never close Baileys, delete `./auth/`, or require a QR re-scan.

## Future `promt.md` update plan

Later phases should update `promt.md` exactly in these areas:

1. Replace the current inbound step that says to filter `msg.key.fromMe === true` with owner-aware handling:
   - do not ignore all `fromMe` messages;
   - persist owner messages as `role='human'`;
   - only owner-originated messages may reactivate the bot by matching `bot_on_keyword`; all other owner WhatsApp messages place/refresh the chat in `HUMAN` mode.
2. Replace the current customer keyword shutdown rule with owner-only intervention handling:
   - customers saying `humano`, `asesor`, `ok.`, or administrative-looking text must not administratively toggle bot mode;
   - customer intent to request a human remains a separate AI/business handoff decision.
3. Expand the database DDL for `conversations`, `messages`, and new `settings` and optional `conversation_events` tables as defined below.
4. Add Redis key conventions and TTLs as defined below.
5. Rewrite the inbound handler section as the lifecycle algorithm in this design: persist -> history -> mode/keyword checks -> reply -> finalize turn.
6. Add owner intervention timestamp refresh and owner activation by `bot_on_keyword`, with required timestamps.
7. Replace the follow-up section with the 12-hour scheduler behavior below, matching `seguimiento.json` parity while preventing collisions with active inbound turns.
8. Add the WhatsApp 24-hour boundary rule for automatic free-form follow-ups.
9. Add DeepSeek JSON contracts and safe fallbacks for normal replies and follow-ups.

## Database design

### `conversations`

Extend the existing table, preserving existing columns where possible:

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  jid TEXT UNIQUE,
  name TEXT,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
  mode_reason TEXT,
  mode_changed_at TIMESTAMP WITH TIME ZONE,
  mode_changed_by TEXT CHECK(mode_changed_by IN ('system','owner','dashboard','assistant')),

  followup_attempts INTEGER NOT NULL DEFAULT 0,
  last_followup_at TIMESTAMP WITH TIME ZONE,
  followup_blocked_at TIMESTAMP WITH TIME ZONE,
  followup_blocked_reason TEXT,

  last_message_at TIMESTAMP WITH TIME ZONE,
  last_user_message_at TIMESTAMP WITH TIME ZONE,
  last_assistant_message_at TIMESTAMP WITH TIME ZONE,
  last_human_message_at TIMESTAMP WITH TIME ZONE,
  last_owner_intervention_at TIMESTAMP WITH TIME ZONE,
  last_ai_reactivated_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

Notes:
- `phone` remains the stable display/contact key.
- `jid` stores the Baileys remote JID when available.
- `mode` is durable and must not be stored in Redis.
- `last_owner_intervention_at` is refreshed by every owner WhatsApp message that does not match `bot_on_keyword`; use it to explain why the bot remains in `HUMAN` mode.
- `last_user_message_at` defines the WhatsApp 24-hour free-form boundary for follow-ups.

### `messages`

Extend the existing table with WhatsApp IDs and source metadata:

```sql
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  whatsapp_message_id TEXT,
  direction TEXT CHECK(direction IN ('inbound','outbound')) NOT NULL,
  role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
  content TEXT NOT NULL,
  media_type TEXT CHECK(media_type IN ('text','image','audio','unknown')) DEFAULT 'text',
  source TEXT CHECK(source IN ('whatsapp','dashboard','bot','scheduler','system')) NOT NULL DEFAULT 'whatsapp',
  from_me BOOLEAN NOT NULL DEFAULT FALSE,
  raw_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_whatsapp_id
  ON messages(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON messages(conversation_id, created_at);
```

Role rules:
- Customer/external messages: `direction='inbound'`, `role='user'`, `from_me=false`.
- Owner WhatsApp messages: `direction='outbound'`, `role='human'`, `from_me=true`, `source='whatsapp'`.
- Dashboard human messages: `direction='outbound'`, `role='human'`, `source='dashboard'`.
- Bot replies and follow-ups: `direction='outbound'`, `role='assistant'`, `source='bot'` or `source='scheduler'`.

### `settings`

Add a singleton/key-value settings table for operational values:

```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

Required keys and default values:

```json
{
  "bot_on_keyword": "ok.",
  "keyword_match_mode": "exact",
  "keyword_case_sensitive": false,
  "debounce_ms": 12000,
  "processing_lock_ttl_ms": 90000,
  "dedupe_ttl_seconds": 86400,
  "conversation_queue_ttl_seconds": 300,
  "followup_interval_hours": 12,
  "followup_due_interval_hours": 12,
  "followup_max_attempts": 2,
  "whatsapp_freeform_window_hours": 24,
  "block_outside_24h_followups": true
}
```

`bot_on_keyword` is the only owner activation command. No setting or UI should exist for a separate deactivation word; any other owner WhatsApp message refreshes human/off state. Customer messages matching `ok.` or administrative-looking text are normal user content.

### Optional `conversation_events`

Add this table if implementation wants an audit trail beyond fields on `conversations`:

```sql
CREATE TABLE IF NOT EXISTS conversation_events (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_role TEXT CHECK(actor_role IN ('user','assistant','human','system')) NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_events_conv_created
  ON conversation_events(conversation_id, created_at);
```

Recommended event types: `bot_disabled`, `bot_enabled`, `owner_intervention`, `handoff_to_human`, `followup_sent`, `followup_skipped`, `followup_blocked_24h`, `deepseek_json_invalid`, `turn_failed`.

## Redis key conventions

Use a project prefix and version: `wa:v1:`.

### Deduplication

- Key: `wa:v1:dedupe:msg:{whatsappMessageId}`
- Value: `1` or persisted message id
- Command: `SET key value NX EX 86400`
- Purpose: prevent duplicate persistence/replies for Baileys redelivery.
- Cleanup: expire automatically; finalization does not need to delete it unless using a short lease. Keeping it for the TTL is preferred.

### Debounce queue

- Key: `wa:v1:turn:queue:{conversationId}`
- Type: Redis list
- Values: JSON items `{ messageId, dbMessageId, text, mediaType, createdAt }`
- TTL: 300 seconds, refreshed on `RPUSH`
- Purpose: group rapid customer messages before one AI response.

### Debounce timer marker

- Key: `wa:v1:turn:debounce:{conversationId}`
- Value: Unix ms timestamp when the current debounce window should fire
- TTL: `debounce_ms + 60s`
- Purpose: coordinate debounce across process-local timers/restarts. If using in-memory `setTimeout`, this key still records active state for scheduler collision checks.

### Processing lock

- Key: `wa:v1:turn:lock:{conversationId}`
- Value: random token/UUID
- Command: `SET key token NX PX processing_lock_ttl_ms`
- Release: Lua compare-and-delete by token only.
- Purpose: allow one active processor per conversation.

### Processing state

- Key: `wa:v1:turn:processing:{conversationId}`
- Value: JSON `{ token, startedAt, messageIds }`
- TTL: same as or slightly longer than the lock.
- Purpose: observability and follow-up collision avoidance.

### Follow-up scheduler lock

- Global key: `wa:v1:followups:runner-lock`
- Value: token
- TTL: slightly less than scheduler interval, e.g. 11 hours for a 12-hour interval, or a shorter TTL if the job is quick.
- Purpose: prevent multiple bot processes from running the scheduler concurrently.

### Follow-up conversation lock

- Key: `wa:v1:followups:lock:{conversationId}`
- Value: token
- TTL: 120 seconds or expected send timeout.
- Purpose: prevent double follow-up sends for the same conversation.

### Cleanup guarantees

At turn finalization, delete only transient keys for the conversation:
- `wa:v1:turn:queue:{conversationId}`
- `wa:v1:turn:debounce:{conversationId}`
- `wa:v1:turn:processing:{conversationId}`
- `wa:v1:turn:lock:{conversationId}` only through token-safe release

Do not delete:
- durable PostgreSQL rows;
- `./auth/`;
- Baileys connection/session state;
- dedupe keys unless intentionally shortening dedupe after a fully skipped invalid event.

## Inbound lifecycle algorithm

### 1. Receive and filter

For each `messages.upsert`:
1. Accept only `type === 'notify'`.
2. Ignore groups: `remoteJid.endsWith('@g.us')`.
3. Accept only 1:1 JIDs ending in `@s.whatsapp.net`.
4. Extract `whatsappMessageId`, `remoteJid`, `fromMe`, timestamp, push name, text/media.
5. Apply dedupe before persistence with `wa:v1:dedupe:msg:{messageId}`. If the key exists, stop without sending.

### 2. Persist first

1. `getOrCreateConversation(phone, jid, pushName)`.
2. If media exists, download/process it and derive text/description/transcription when possible. If processing fails, persist a safe placeholder and metadata.
3. Determine role:
   - `fromMe === true` and message belongs to the connected owner account: `human`;
   - otherwise: `user`.
4. Insert `messages` row before any DeepSeek call.
5. Update conversation timestamps in the same transaction:
   - always: `last_message_at`, `updated_at`;
   - user: `last_user_message_at`, reset `followup_attempts = 0`, clear follow-up blocked markers;
   - human: `last_human_message_at`, `last_owner_intervention_at`;
   - assistant: `last_assistant_message_at`.

### 3. Owner mode checks

If role is `human` and `fromMe === true`:
1. Normalize text using settings: `trim`; lower-case unless `keyword_case_sensitive`; exact comparison by default.
2. If text equals `bot_on_keyword`:
   - set conversation `mode='AI'`;
   - set `mode_reason='owner_keyword_on'`, `mode_changed_by='owner'`, `mode_changed_at=NOW()`, `last_ai_reactivated_at=NOW()`;
   - clear or expire transient Redis human/off labels for that conversation if present;
   - create `bot_enabled` event;
   - finalize turn; future customer messages are AI-eligible.
3. Otherwise:
   - set conversation `mode='HUMAN'`;
   - set `mode_reason='owner_intervention'`, `mode_changed_by='owner'`, `mode_changed_at=NOW()`;
   - refresh `last_owner_intervention_at` / `last_human_message_at` for the current message;
   - apply or refresh transient Redis label-like state used by runtime checks, e.g. `wa:v1:conversation:human:{conversationId}`, with TTL/cleanup appropriate to the active turn;
   - create `bot_disabled` or `owner_intervention` event;
   - finalize turn; no AI reply.
4. Owner messages never trigger an AI reply to themselves in that turn.

Customer messages that equal `bot_on_keyword` or administrative-looking text are persisted as `user` and do not toggle mode.

### 4. Owner reactivation and intervention refresh

For an owner WhatsApp message where the conversation is currently `HUMAN`:
1. If normalized text equals `bot_on_keyword`, set mode to `AI`, set `mode_reason='owner_keyword_on'`, set `mode_changed_by='owner'`, set `mode_changed_at=NOW()` and `last_ai_reactivated_at=NOW()`, then clear transient Redis human/off labels for that conversation.
2. If normalized text does not equal `bot_on_keyword`, keep mode `HUMAN`, refresh `last_owner_intervention_at` and any transient Redis human/off label, and finalize without AI reply.
3. Dashboard/manual mode changes may also reactivate to `AI`, but dashboard messages are not treated as WhatsApp owner keyword commands.

The timestamp refresh must not erase durable history or Baileys auth state.

### 5. Customer mode check and debounce

For role `user`:
1. Re-read the conversation after persistence and any timestamp updates.
2. If mode is `HUMAN`, finalize without DeepSeek.
3. If mode is `AI`:
   - enqueue the persisted message in `wa:v1:turn:queue:{conversationId}`;
   - set/refresh debounce marker;
   - schedule processing after `debounce_ms`.
4. Follow-up state has already been reset by the user message.

### 6. Debounced processing

When the debounce window fires:
1. Acquire `wa:v1:turn:lock:{conversationId}`.
2. Set `wa:v1:turn:processing:{conversationId}`.
3. Re-read conversation. If mode is no longer `AI`, finalize cleanup and stop.
4. Load recent history, e.g. last 20 persisted messages, including the queued messages.
5. Load the active system prompt.
6. Call DeepSeek using the normal reply JSON contract.
7. Parse and validate reply parts.
8. For each non-empty part:
   - wait natural delay `2000ms + text.length * 10` unless disabled in tests;
   - send through `sock.sendMessage(remoteJid, { text })`;
   - persist as `assistant` with source `bot` and update `last_assistant_message_at`.
9. If DeepSeek indicates human handoff, persist event and set conversation `mode='HUMAN'` after sending/recording the handoff message, or immediately if no safe message exists.
10. Finalize cleanup idempotently.

### 7. Error/failure finalization

On any error after persistence:
- release token-safe locks;
- delete queue/debounce/processing keys for that conversation if the current processor owns the lock;
- record `turn_failed` event if audit is enabled;
- do not close Baileys auth/session;
- do not delete message history.

## Owner detection

A message is considered owner-originated only when Baileys reports `msg.key.fromMe === true` for a 1:1 chat using the connected WhatsApp session. This is sufficient for administrative keywords because only the connected account can generate `fromMe` messages in Baileys.

Implementation must not use text content alone to identify owner commands. The command must satisfy both:
- `fromMe === true`;
- normalized text equals the configured owner keyword.

Dashboard messages are human intervention but are not owner WhatsApp `fromMe` messages. They may set mode through explicit dashboard controls, but they should not be treated as owner keyword commands unless the dashboard API deliberately exposes that action.

## Follow-up scheduler design

### Parity with `seguimiento.json`

The local scheduler matches the reference workflow behavior:
- evaluates due conversations every 12 hours by default;
- selects conversations where the latest visible message is from the bot/assistant;
- requires no customer message after that assistant message;
- requires `followup_attempts < 2`;
- loads the last 10-20 messages as context;
- asks the LLM for strict JSON `{ "respuesta": "SI" | "NO", "mensaje": "..." }`;
- sends and persists only when `respuesta === "SI"` and `mensaje` is valid.

### Candidate selection

A conversation is eligible only if:
1. `mode='AI'`.
2. `followup_attempts < followup_max_attempts`.
3. Latest non-system visible message is `role='assistant'`.
4. No `role='user'` message exists after that assistant message.
5. The 12-hour due interval has elapsed since the last assistant/follow-up evaluation; do not wait 24 hours after the assistant message.
6. `last_user_message_at >= NOW() - whatsapp_freeform_window_hours` when free-form follow-ups are blocked outside 24h.
7. No active Redis inbound state exists:
   - no `wa:v1:turn:queue:{conversationId}`;
   - no `wa:v1:turn:debounce:{conversationId}`;
   - no `wa:v1:turn:lock:{conversationId}`;
   - no `wa:v1:turn:processing:{conversationId}`.
8. The scheduler can acquire `wa:v1:followups:lock:{conversationId}`.

### Sending behavior

For each candidate:
1. Re-check eligibility after acquiring the follow-up lock.
2. If outside the 24-hour boundary, do not call DeepSeek or send; record `followup_blocked_24h`, set blocked fields, and optionally surface for human intervention.
3. Load recent history.
4. Call DeepSeek with the follow-up JSON contract.
5. If JSON is invalid or says `NO`, record skip if audit is enabled; do not increment attempts unless product policy later decides to count evaluated skips.
6. If JSON says `SI` with a non-empty message:
   - send through Baileys;
   - persist as `assistant`, `source='scheduler'`;
   - increment `followup_attempts` by 1;
   - set `last_followup_at` and `last_assistant_message_at`;
   - record `followup_sent`.
7. Release the follow-up lock.

### Collision handling

Inbound turns always win. If a customer message arrives while a follow-up is being evaluated:
- the inbound dedupe/persist path proceeds;
- the user message resets `followup_attempts`;
- the follow-up re-check before send must detect the new user message or active lock and skip.

## WhatsApp 24-hour boundary

Because Baileys uses WhatsApp Web rather than the official API, the project still treats automatic free-form follow-ups outside 24 hours since the last customer message as spam-risk/non-compliant behavior. Default behavior: block automatic follow-up sends outside the configured 24-hour window.

Normal direct replies to inbound customer messages are allowed because they occur immediately after `last_user_message_at` is updated. Follow-ups are evaluated against `last_user_message_at`, not `last_assistant_message_at`.

Blocked follow-ups must be visible through one of:
- `conversation_events` with `event_type='followup_blocked_24h'`;
- `conversations.followup_blocked_at` and `followup_blocked_reason`;
- dashboard status in a later UI task.

## DeepSeek contracts and fallbacks

### Normal reply contract

Request DeepSeek to return strict JSON:

```json
{
  "response": {
    "part_1": "string",
    "part_2": "string",
    "part_3": "string"
  },
  "handoff": {
    "required": false,
    "reason": ""
  }
}
```

Compatibility fallback: if the implementation keeps the current `{ response: { part_1, part_2, part_3 } }` contract only, it must still support handoff by parsing known handoff phrases or a separate classifier result. Preferred future update is the extended contract above.

Validation:
- parse JSON strictly;
- send only non-empty string parts under `response` in numeric order;
- cap message length per part if needed by WhatsApp safety;
- ignore unknown keys.

Fallbacks:
- If JSON parsing fails, attempt one repair/retry with a system instruction: "Return only valid JSON matching the schema.";
- If retry fails, send a conservative handoff message only if configured safe, e.g. `Déjame derivarte con un asesor humano.`;
- persist a `deepseek_json_invalid` event;
- do not send raw unvalidated LLM text.

### Follow-up contract

Strict JSON:

```json
{
  "respuesta": "SI",
  "mensaje": "Texto breve de seguimiento"
}
```

Rules:
- `respuesta` must be exactly `SI` or `NO` after trimming and uppercasing;
- `mensaje` is required only for `SI`;
- if `respuesta !== 'SI'`, do not send;
- if JSON is malformed, do not send raw text;
- record skip/audit for troubleshooting.

## Contacts CRM data source

ContactsOverview should consume the persisted `ConversationListRow[]` already loaded by Home from `/api/conversations`, or an equivalent direct call to the same API. It must remove fake contact initialization and derive display name, phone, mode, and latest interaction from persisted conversation fields. Status/tags should be omitted or explicitly empty until a persisted CRM contact model exists.

## Contracts for DB helpers

Future `promt.md` should require these helpers in `src/lib/db.ts` or equivalent:

- `getOrCreateConversation(phone, jid?, name?)`
- `insertMessageAndUpdateConversation({ conversationId, whatsappMessageId, direction, role, content, mediaType, source, fromMe, rawTimestamp, metadata })`
- `getConversationById(id)`
- `setConversationMode(id, mode, reason, changedBy)`
- `getRecentHistory(conversationId, limit)`
- `getSettings()` and `updateSetting(key, value)`
- `getFollowUpCandidates(now, settings)`
- `incrementFollowUpAttempt(conversationId)`
- `recordConversationEvent(...)` if audit table is implemented

All message insertion and conversation timestamp updates must be transactional.

## Tests to plan in tasks phase

Test-first tasks should cover:
- duplicate Baileys message id is not persisted/responded twice;
- `fromMe` owner non-activation message switches or refreshes `AI/HUMAN -> HUMAN` and sends no AI reply;
- customer text equal to owner keyword does not toggle mode;
- owner on keyword switches `HUMAN -> AI`;
- owner non-activation reply refreshes `HUMAN` and does not reactivate;
- user message resets follow-up attempts;
- scheduler sends only when latest message is assistant and no user replied after it;
- scheduler skips when inbound Redis lock/debounce/queue exists;
- scheduler blocks outside 24-hour window;
- malformed DeepSeek follow-up JSON sends nothing;
- normal reply malformed JSON does not send raw text;
- finalization clears Redis transient keys without touching Baileys auth.

## Rollout and migration notes

This is a prompt/spec update first; no database migration is executed in this design phase. Future implementation should:
1. Update `promt.md` in one reviewable documentation change.
2. Add tests and code tasks after user approval.
3. Preserve existing base DDL compatibility while adding columns/tables.
4. Default to audit events if review budget permits; otherwise use conversation fields first and add events in a follow-up task.

## Review workload forecast for updating `promt.md`

Estimated documentation change: 120-180 changed lines.

Expected edits:
- Database DDL section: replace/expand about 60-80 lines.
- Inbound handler section: replace about 30-45 lines.
- Follow-up section: replace about 20-35 lines.
- Add Redis/owner/24h/DeepSeek contract notes: about 30-50 lines.

This is within the configured 400 changed-line review budget. No chained PR split is required for the `promt.md` documentation update alone. If implementation tasks are combined with the prompt update, split documentation from code to keep reviews small.

## Open decisions

No blocking product decision remains for the design. The defaults above keep exact owner-only `bot_on_keyword`, remove any separate deactivation word, evaluate follow-ups every 12 hours, and block automatic free-form follow-ups outside 24 hours.
