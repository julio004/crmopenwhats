# CRM Identity Foundation Specification

## Purpose

Define CRM identity entities that separate people and companies from WhatsApp conversation records.

## Requirements

### Requirement: Contact Identity Is Separate from Conversation Identity

The system MUST treat contacts and accounts as CRM roots, while conversations remain channel interaction records.

#### Scenario: Contact exists independently from a chat thread

- GIVEN a person known to the CRM
- WHEN no active WhatsApp thread exists for that person
- THEN the system MUST still allow the contact to exist as a first-class CRM identity

### Requirement: Contact Methods and Account Links

The system MUST support contact methods and account association without assuming one conversation equals one contact or one account.

#### Scenario: One account has multiple contacts and methods

- GIVEN an account with more than one person and more than one contact method
- WHEN CRM identity data is stored
- THEN the system MUST allow multiple contacts under the account
- AND it MUST allow channel identifiers such as WhatsApp numbers to link through contact methods or mapping records

### Requirement: Ownership Is Assigned to CRM Identities

The system MUST support owner assignment on CRM identities separately from channel runtime state.

#### Scenario: Contact owner changes without rewriting message history

- GIVEN an existing contact linked to prior conversations
- WHEN an authorized operator changes ownership
- THEN the system MUST update CRM ownership without reclassifying persisted conversation messages
