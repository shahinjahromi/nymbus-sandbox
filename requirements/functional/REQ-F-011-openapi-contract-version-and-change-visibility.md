# REQ-F-011: OpenAPI contract version and change visibility

**ID:** REQ-F-011  
**Type:** Functional  
**Status:** Proposed

## Description

The developer portal must provide visibility into the active Nymbus OpenAPI contract used by the simulator and communicate API changes clearly to developers.

This requirement applies only to project-managed Nymbus OpenAPI artifacts and does not require SDK distribution or embedded "Try It" execution.

## Acceptance criteria

1. The portal displays the active contract source/version metadata derived from project-managed Nymbus OpenAPI files.
2. Developers can view a human-readable change log of endpoint, request model, and response model changes between published simulator contract versions.
3. Operations or fields marked as deprecated in the active contract are highlighted with deprecation guidance in portal documentation views.
4. Breaking changes to contract behavior are surfaced with migration notes before or at release of the corresponding simulator version.
5. Contract visibility in the portal remains consistent with REQ-F-005 contract parity expectations.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-011-T1 | `tests/req-f-011-contract-version-metadata.test.ts` | Verifies active contract metadata is surfaced from managed OpenAPI artifacts. |
| REQ-F-011-T2 | `tests/req-f-011-contract-change-log.test.ts` | Verifies portal change log generation for contract deltas across versions. |
| REQ-F-011-T3 | `tests/req-f-011-deprecation-highlights.test.ts` | Verifies deprecated operations/fields are highlighted with guidance. |

Success of these tests proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
