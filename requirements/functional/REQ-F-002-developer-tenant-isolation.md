# REQ-F-002: Developer tenancy and isolated ID spaces

**ID:** REQ-F-002  
**Type:** Functional  
**Status:** Proposed

## Description

The sandbox backend must support developer account onboarding for integrators and enforce strict multi-tenant isolation.

Each developer account has its own ID space and can create users and bank accounts only within that space. Data belonging to one developer account must not be visible or accessible to any other developer account.

At implementation time, endpoint behavior and payload shapes must conform to the Nymbus Stoplight API specification (`https://nymbus-docs.stoplight.io/explore`) for the covered resources.

## Acceptance criteria

1. The backend supports creation of a developer account with sandbox credentials and returns a unique developer identifier for that tenant.
2. A developer account can create and manage users and bank accounts within its own tenant scope.
3. All persisted entities (users, accounts, cards, transactions, transfers) are bound to a developer tenant identifier.
4. Requests authenticated as Developer A cannot read, list, update, or delete entities created by Developer B.
5. Unauthorized cross-tenant lookups do not leak metadata (e.g., names, existence details, balances, or card attributes).
6. Tenant-scoped behavior is applied consistently across all exposed sandbox endpoints related to users, accounts, cards, and transactions.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-002-T1 | `tests/req-f-002-tenant-isolation.test.ts` | `REQ-F-002: Developer ID-space isolation` — Creates data under one developer and verifies another developer cannot access or infer it. |

Success of this test proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
