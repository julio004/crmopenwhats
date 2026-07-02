# Auth RBAC Foundation Specification

## Purpose

Define Phase 1 secure operator access for the existing dashboard and APIs without changing WhatsApp orchestration behavior.

## Requirements

### Requirement: Secure Operator Authentication

The system MUST replace shared-password cookies with per-user authentication using hashed credentials and server-issued sessions.

#### Scenario: Operator signs in with a managed account

- GIVEN an active user with a valid password
- WHEN the user submits login credentials
- THEN the system MUST verify the stored password hash
- AND it MUST issue a server-generated session bound to that user
- AND it MUST NOT store or echo the raw password in cookies, logs, or client-visible tokens

#### Scenario: Session gate protects CRM routes

- GIVEN a request to a protected dashboard page or API
- WHEN no valid session is present
- THEN the system MUST deny access before CRM data is returned

### Requirement: Team Membership and Role Authorization

The system MUST model users, teams, memberships, and roles so authorization is based on account identity instead of a global admin secret.

#### Scenario: Role controls privileged actions

- GIVEN an authenticated user without the required role
- WHEN that user attempts ownership, membership, or configuration changes
- THEN the system MUST reject the action
- AND it SHOULD return an authorization failure without exposing protected data

### Requirement: Auth and Ownership Auditability

The system MUST record audit events for login success/failure, session revocation, membership changes, role changes, and ownership changes.

#### Scenario: Privileged change creates an audit trail

- GIVEN an authorized operator changes a role, membership, or owner assignment
- WHEN the change is committed
- THEN the system MUST persist who performed it, what changed, and when it changed
