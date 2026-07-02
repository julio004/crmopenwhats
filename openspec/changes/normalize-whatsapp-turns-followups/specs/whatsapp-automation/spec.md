# WhatsApp Automation Specification

## Purpose

Define the required behavior for local WhatsApp conversation automation using Baileys, PostgreSQL, Redis, DeepSeek, and a local scheduler, replacing the referenced n8n/Evolution/OpenAI/official WhatsApp API workflows without changing `promt.md` in this phase.

## Requirements

### Requirement: Inbound Turn Lifecycle

The system MUST process each valid 1:1 WhatsApp `messages.upsert` notification as a complete turn that persists the inbound message before reading conversation history, deciding whether to respond, sending any AI response, persisting outbound assistant messages, and finalizing transient processing state.

#### Scenario: AI turn persists before responding

- GIVEN a valid non-group inbound customer message arrives while the conversation is in `AI` mode
- WHEN the system processes the message
- THEN it MUST create or load the conversation
- AND it MUST persist the inbound message as role `user` with its timestamp before calling DeepSeek
- AND it MUST read recent conversation history and the active system prompt before generating a reply
- AND it MUST persist each sent AI reply part as role `assistant` with timestamps

#### Scenario: Human-mode turn stores without AI reply

- GIVEN a valid customer message arrives while the conversation is in `HUMAN` mode
- WHEN the system processes the message
- THEN it MUST persist the message as role `user`
- AND it MUST NOT call DeepSeek for an automatic reply
- AND it MUST finalize transient processing state for that turn

#### Scenario: Turn finalization does not close Baileys auth

- GIVEN any valid inbound turn has completed, failed, or been skipped after persistence
- WHEN the system finalizes the turn
- THEN it MUST clean applicable transient queues, locks, timers, processing flags, deduplication leases, and conversation leases
- AND it MUST NOT disconnect Baileys, delete `./auth/`, or require a new QR scan as part of normal turn finalization

### Requirement: Idempotency, Deduplication, and Debounced Queueing

The system MUST prevent duplicate automatic responses for the same WhatsApp message and MUST debounce rapid customer messages per conversation so a burst is answered as one contextual turn when appropriate.

#### Scenario: Duplicate message id is not processed twice

- GIVEN Baileys delivers the same WhatsApp message id more than once
- WHEN the duplicate delivery is received within the deduplication window
- THEN the system MUST NOT persist a second customer message for the duplicate
- AND it MUST NOT send a second AI response for that duplicate

#### Scenario: Rapid messages are combined for one AI response

- GIVEN a customer sends multiple valid messages to the same conversation within the debounce interval
- WHEN the debounce interval elapses
- THEN the system MUST process the queued customer content as one response decision
- AND it MUST call DeepSeek using recent persisted history that includes the queued messages
- AND it MUST send at most one grouped assistant response sequence for that burst

#### Scenario: Locks are idempotently released

- GIVEN a processing lock or queue entry has already expired or been removed
- WHEN the system finalizes a turn or retries cleanup
- THEN cleanup MUST be safe to run again
- AND it MUST NOT remove durable conversation mode, message history, or Baileys authentication data

### Requirement: Owner Intervention and Activation Keyword

The system MUST provide a setting only for the owner activation keyword, default `ok.`. Messages sent by the owner from their WhatsApp (`fromMe === true`) MUST either reactivate the chat when they match that keyword or place/refresh the chat in `HUMAN` mode when they do not. Redis MAY carry transient label-like runtime state for checks, but PostgreSQL conversation mode is the durable source of truth.

#### Scenario: Owner message without activation turns bot silent for a chat

- GIVEN a conversation is in `AI` mode
- AND the owner sends any WhatsApp message in that chat whose normalized text does not equal `bot_on_keyword`
- WHEN the message is processed
- THEN the system MUST persist the owner message as role `human`
- AND it MUST change that conversation to `HUMAN` mode in PostgreSQL
- AND it MUST apply or refresh transient Redis label/lock state used by runtime checks
- AND it MUST refresh the human intervention timestamp for that chat
- AND it MUST NOT send an AI response for that owner message

#### Scenario: Owner enables bot for a chat

- GIVEN a conversation is in `HUMAN` mode
- AND the owner sends the configured `bot_on_keyword`, such as `ok.`, in that chat
- WHEN the message is processed
- THEN the system MUST change that conversation to `AI` mode
- AND it MUST persist the owner message as role `human`
- AND future customer messages in that chat MUST be eligible for AI processing

#### Scenario: Customer keyword does not perform administrative toggle

- GIVEN a customer sends text equal to `ok.` or any administrative value
- WHEN the message is processed
- THEN the system MUST persist it as role `user`
- AND it MUST NOT treat the message as an owner administrative command
- AND it MUST NOT change mode solely because the customer used that text

### Requirement: Owner Reactivation and Intervention Refresh

The system MUST reactivate the bot for a conversation only when the owner uses the configured activation keyword or when an explicit dashboard/manual action changes mode. Every non-activation owner WhatsApp message MUST refresh the human intervention/off timestamp and keep the bot silent for that turn.

#### Scenario: Owner activation keyword reactivates AI

- GIVEN a conversation is in `HUMAN` mode
- WHEN the owner sends a message whose normalized text equals `bot_on_keyword`
- THEN the system MUST persist the message as role `human`
- AND it MUST change the conversation to `AI` mode
- AND it MUST record the reactivation timestamp and reason

#### Scenario: Owner non-activation message refreshes HUMAN mode

- GIVEN a conversation is in `HUMAN` mode
- WHEN the owner sends a message that is not the configured `bot_on_keyword`
- THEN the system MUST persist the message as role `human`
- AND it MUST leave the conversation in `HUMAN` mode
- AND it MUST refresh the human intervention/off timestamp

### Requirement: Conversation Labels, States, and Timestamps

The system MUST maintain durable conversation and message metadata sufficient to distinguish bot, customer, and human activity; mode state; follow-up state; and WhatsApp reply-window decisions.

#### Scenario: Message roles and media labels are preserved

- GIVEN a message is persisted from any source
- WHEN it is stored
- THEN it MUST use role `user`, `assistant`, or `human` as applicable
- AND it MUST include a timestamp
- AND it SHOULD preserve media type labels for text, image, or audio when available

#### Scenario: Conversation timestamps reflect latest activity

- GIVEN a customer, assistant, or human message is persisted
- WHEN the conversation record is updated
- THEN the system MUST update `last_message_at` or an equivalent timestamp
- AND it MUST maintain source-specific timestamps such as last customer inbound, last assistant outbound, and last human message where required by mode, reactivation, and follow-up decisions

#### Scenario: Mode labels remain distinct from roles

- GIVEN a conversation mode is displayed or used for automation
- WHEN messages are listed or sent
- THEN conversation mode MUST be represented as `AI` or `HUMAN`
- AND message authorship MUST remain represented separately as `user`, `assistant`, or `human`

### Requirement: Follow-Up Scheduling Without Active Conversation Collision

The system MUST run follow-ups according to the behavior adapted from `seguimiento.json`: periodic evaluation, maximum two attempts, last visible message from the bot, no customer response after that bot message, DeepSeek JSON decision, and no collision with active inbound processing.

#### Scenario: Eligible first follow-up is sent

- GIVEN the scheduler evaluates due conversations every 12 hours or by an equivalent 12-hour due interval
- AND a conversation is in `AI` mode
- AND the last visible message is role `assistant`
- AND the customer has not replied after that assistant message
- AND `followup_attempts` is less than 2
- AND the 12-hour follow-up due interval has elapsed
- AND the conversation is inside the allowed WhatsApp messaging window
- WHEN DeepSeek returns strict JSON with `respuesta` equal to `SI` and a non-empty `mensaje`
- THEN the system MUST send the follow-up through Baileys
- AND it MUST persist the sent follow-up as role `assistant`
- AND it MUST increment the follow-up attempt count

#### Scenario: Follow-up is skipped when customer responded

- GIVEN a conversation has a pending or eligible follow-up state
- WHEN the latest message after the prior assistant message is from the customer
- THEN the scheduler MUST NOT send a follow-up
- AND normal inbound processing MUST take priority
- AND follow-up attempts MUST be reset or cancelled according to the inbound turn rules

#### Scenario: Follow-up does not collide with active processing

- GIVEN a conversation has an active inbound queue, debounce timer, processing lock, or equivalent lease
- WHEN the follow-up scheduler evaluates that conversation
- THEN it MUST NOT send a follow-up for that conversation during active processing
- AND it MAY retry evaluation on a later scheduler run if the conversation remains eligible

#### Scenario: Invalid follow-up JSON is safe

- GIVEN DeepSeek returns malformed JSON or a JSON object without `respuesta: "SI"` and a valid `mensaje`
- WHEN the scheduler evaluates the response
- THEN the system MUST NOT send unvalidated text as a follow-up
- AND it SHOULD record the skipped decision for troubleshooting

### Requirement: WhatsApp 24-Hour Boundary and Spam Risk Handling

The system MUST avoid sending automatic free-form follow-ups outside the allowed or configured WhatsApp messaging window and MUST make blocked cases visible for human handling or audit.

#### Scenario: Follow-up inside window may proceed

- GIVEN a follow-up candidate is inside the configured 24-hour customer interaction window
- WHEN all other follow-up eligibility checks pass
- THEN the system MAY send the follow-up if DeepSeek returns `respuesta: "SI"`

#### Scenario: Follow-up outside window is blocked

- GIVEN a follow-up candidate is outside the configured 24-hour free-form messaging window
- WHEN the scheduler evaluates the conversation
- THEN the system MUST NOT send an automatic free-form follow-up
- AND it MUST record that the follow-up was blocked because of the messaging boundary or spam-risk policy
- AND it SHOULD expose or route the case for human intervention when configured

### Requirement: Contacts CRM Uses Persisted Conversations

The Contacts CRM module MUST render persisted conversation/contact data from the existing conversations API path and MUST NOT initialize fake local contact rows.

#### Scenario: Contacts are loaded from persisted conversations

- GIVEN Home has loaded conversations from `/api/conversations`
- WHEN the Contacts CRM tab is rendered
- THEN ContactsOverview MUST consume those persisted rows or equivalent API data
- AND it MUST NOT show hardcoded fake contacts
- AND it MUST NOT invent status or tag fields that are not persisted

### Requirement: JSON Workflow Parity on Local Stack

The system MUST preserve the behavioral intent of `concepto.json` and `seguimiento.json` while replacing n8n, Evolution, OpenAI, and official WhatsApp API dependencies with the local approved stack.

#### Scenario: Inbound workflow maps to local components

- GIVEN the reference workflow receives WhatsApp events, extracts content, stores history, checks state, invokes an LLM, and sends replies
- WHEN implemented in this project
- THEN WhatsApp events MUST come from Baileys `messages.upsert`
- AND durable history MUST live in PostgreSQL conversations and messages
- AND transient debounce, locks, and deduplication MUST use Redis or equivalent transient state
- AND AI responses MUST use DeepSeek with the active local system prompt
- AND outbound WhatsApp messages MUST be sent through Baileys

#### Scenario: Follow-up workflow maps to local scheduler

- GIVEN `seguimiento.json` uses a scheduled trigger, history lookup, attempt count, JSON LLM decision, and outbound message node
- WHEN implemented in this project
- THEN scheduling MUST be performed by `node-cron` or a robust local interval
- AND history lookup MUST use local PostgreSQL records
- AND the JSON decision contract MUST be `{ "respuesta": "SI" | "NO", "mensaje": "..." }`
- AND outbound follow-ups MUST be sent through Baileys and persisted locally

#### Scenario: Commercial handoff intent is preserved

- GIVEN the local active prompt and adapted `concepto.json` behavior require consultative sales and human handoff when needed
- WHEN the AI determines the customer is ready to close, asks for a person, is upset, or lacks critical information for automation
- THEN the system MUST persist the decision
- AND it MUST change or mark the conversation for `HUMAN` handling without relying on n8n tools
