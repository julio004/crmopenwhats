# crm-identity-foundation Specification

## Purpose

Define CRM identity rules that let surviving contact methods rebuild conversation links after the old chat thread is deleted.

## Requirements

### Requirement: Contact methods restore conversation links

The system MUST be able to recreate `conversation_crm_links` from surviving tenant-scoped CRM WhatsApp contact methods and MUST NOT require the deleted conversation row to remain present.

#### Scenario: Recreate link after chat deletion

- GIVEN a prior conversation was deleted but the contact still has WhatsApp methods in CRM
- WHEN a new inbound message recreates the conversation and exactly one contact matches
- THEN the system recreates the conversation-to-contact link for that conversation

#### Scenario: Restore deterministic account context

- GIVEN the uniquely matched contact already has deterministic CRM account context
- WHEN the conversation link is recreated
- THEN the restored link includes the same CRM-visible identity context without requiring manual relinking

### Requirement: Auto-link only on unique exact matches

The system MUST auto-link only when exactly one contact in the same tenant matches the normalized inbound WhatsApp identity exactly. The system MUST NOT expand this into generic CRM dedupe or link when the result is ambiguous.

#### Scenario: Unique tenant-scoped match relinks automatically

- GIVEN one CRM contact in the active tenant matches normalized WhatsApp identity `5491112345678`
- WHEN inbound re-entry processing runs
- THEN that contact is linked to the recreated conversation automatically

#### Scenario: Ambiguous or missing matches stay unlinked

- GIVEN zero or multiple CRM contacts match the normalized inbound identity
- WHEN inbound re-entry processing runs
- THEN the conversation remains unlinked and no cross-contact repair is attempted
