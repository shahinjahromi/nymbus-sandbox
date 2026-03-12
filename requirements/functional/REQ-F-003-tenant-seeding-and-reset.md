# REQ-F-003: Tenant seeding, test data lifecycle, and reset

**ID:** REQ-F-003  
**Type:** Functional  
**Status:** Proposed

## Description

The sandbox backend must support deterministic seeding and reset workflows per developer tenant so integrators can start from known datasets and repeat test scenarios.

The system must allow creating a fresh tenant dataset, viewing seeded user/account/transaction/card data, clearing tenant test data, and reseeding the tenant again.

At implementation time, endpoint behavior and payload shapes must conform to the Nymbus Stoplight API specification (`https://nymbus-docs.stoplight.io/explore`) for the covered resources.

## Acceptance criteria

1. The backend supports seeding a newly created developer tenant with an initial deterministic dataset.
2. Seeded datasets include at minimum user identities, bank accounts, transaction history, and card-linked data needed for core integration testing.
3. A developer can retrieve seeded data through tenant-scoped APIs and use it for login and account/transaction/card test flows.
4. The backend supports wiping/clearing tenant test data without affecting other developer tenants.
5. After a wipe, a developer can reseed a fresh dataset and receive a valid initial state again.
6. Seed and reset operations are deterministic enough that repeated runs in the same profile produce consistent integration-test outcomes.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-003-T1 | `tests/req-f-003-seeding-reset.test.ts` | `REQ-F-003: Seed, view, wipe, and reseed tenant data` — Verifies deterministic dataset creation, retrieval, cleanup, and recreation for one tenant without cross-tenant impact. |

Success of this test proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
