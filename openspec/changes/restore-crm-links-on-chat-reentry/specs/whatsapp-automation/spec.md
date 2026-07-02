# whatsapp-automation Specification

## Purpose

Define inbound WhatsApp behavior that restores CRM-visible conversation identity when a customer writes again after chat deletion or archive.

## Requirements

### Requirement: Reentry WhatsApp identity normalization

The system MUST derive a CRM matching identity from the inbound WhatsApp sender data and MUST strip only terminal companion-device suffixes from phone-like identifiers when matching CRM methods.

#### Scenario: Match a suffixed phone-like sender

- GIVEN an inbound sender identity `5491112345678:52@s.whatsapp.net`
- WHEN the system prepares CRM re-entry matching
- THEN it uses `5491112345678` as the normalized phone-like identity

#### Scenario: Preserve non-suffixed identities

- GIVEN an inbound sender identity `171855029772514@lid` with sender phone `18496294358@s.whatsapp.net`
- WHEN the system prepares CRM re-entry matching
- THEN it uses the existing inbound canonical identity and does not broaden matching beyond the minimum suffix repair

### Requirement: Customer reentry restores visible conversation state

The system MUST treat a new inbound customer message as reactivation activity. If the conversation is archived, it MUST become visible again, and if CRM relinking succeeds, the conversation MUST remain CRM-visible without requiring manual repair.

#### Scenario: Unarchive on inbound customer activity

- GIVEN a matched conversation exists in archived state
- WHEN a customer sends a new inbound message
- THEN the conversation becomes unarchived in the same inbound flow

#### Scenario: Do not invent a CRM link on failed match

- GIVEN a recreated or re-entered conversation has no safe CRM identity match
- WHEN the inbound message is processed
- THEN the conversation still persists the message but no automatic CRM link is created
