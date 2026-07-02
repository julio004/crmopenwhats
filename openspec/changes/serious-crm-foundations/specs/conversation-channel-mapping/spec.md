# Conversation Channel Mapping Specification

## Purpose

Define migration-safe rules that preserve current WhatsApp conversation flows while introducing CRM identity mapping.

## Requirements

### Requirement: Existing WhatsApp Automation Remains Compatible

The system MUST preserve the behavior of inbound handling, follow-up scheduling, and current conversation-mode logic during the CRM identity migration.

#### Scenario: Channel orchestration still runs from conversation records

- GIVEN a customer message arrives through the current WhatsApp pipeline
- WHEN the message is processed during migration
- THEN the system MUST keep using the existing conversation and message flow for orchestration
- AND it MUST NOT require Phase 1 or Phase 2 to rewrite Baileys, Redis turn-state, or follow-up control flow

### Requirement: Transitional Conversation APIs Stay Stable

The system MUST keep current conversation-focused APIs and UI usable while progressively exposing linked contact/account identity.

#### Scenario: Existing conversation list remains valid

- GIVEN the dashboard or API requests conversation data using current routes
- WHEN CRM mappings exist
- THEN the system MUST continue returning conversation-centered records compatible with current consumers
- AND it SHOULD include linked CRM identity fields in a backward-compatible way

### Requirement: Mapping Changes Are Auditable

The system MUST record creation, reassignment, merge-safe updates, or removal of conversation-to-contact/account mappings.

#### Scenario: Operator remaps a conversation

- GIVEN an authorized operator corrects which contact or account a conversation belongs to
- WHEN the mapping is saved
- THEN the system MUST record the acting user, previous mapping, new mapping, and timestamp
