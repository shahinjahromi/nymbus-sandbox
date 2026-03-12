# REQ-F-006: Developer portal authentication, access, and API credentials

**ID:** REQ-F-006  
**Type:** Functional  
**Status:** Proposed

## Description

Provide a developer portal front-end that enables developer onboarding and secure access to sandbox integration resources.

The portal must allow a developer to register with email and password, recover account access through OTP-based password reset via email, view sandbox API specifications after login, and generate integration credentials used to authenticate API requests to the simulator backend.

## Acceptance criteria

1. A new developer can register in the portal using email + password and create a portal identity linked to a tenant/developer account.
2. A developer can log in with valid credentials and access authenticated portal areas.
3. A developer can initiate password reset and complete reset using a one-time passcode (OTP) delivered to their registered email.
4. After login, the developer can view API specification documentation for the sandbox (from project-managed OpenAPI sources).
5. After login, the developer can generate API authentication credentials (e.g., `client_id`/`client_secret` or equivalent supported auth artifacts) for backend integration.
6. Credential issuance and visibility are tenant-scoped so developers only access their own credentials.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-006-T1 | `tests/req-f-006-portal-auth.test.ts` | Validates registration, login, and OTP password reset flow end-to-end. |
| REQ-F-006-T2 | `tests/req-f-006-portal-credential-issuance.test.ts` | Validates authenticated access to API specs and tenant-scoped credential generation. |

Success of these tests proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
