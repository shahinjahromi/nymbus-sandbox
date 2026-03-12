# REQ-F-004: Payment-rail and card lifecycle simulation

**ID:** REQ-F-004  
**Type:** Functional  
**Status:** Proposed

## Description

The sandbox backend must simulate core-processor transaction flows that arrive through external payment rails and card networks, with effects reflected in tenant-scoped ledgers and transaction history.

Supported simulations include:

- Incoming and outgoing ACH transactions
- Incoming wire transfers
- Card transaction lifecycle events: authorization, post (capture/settlement), void, and refund

At implementation time, endpoint behavior and payload shapes must conform to the Nymbus Stoplight API specification (`https://nymbus-docs.stoplight.io/explore`) for the covered resources.

## Acceptance criteria

1. The backend supports simulation APIs/events for incoming ACH and outgoing ACH transactions.
2. The backend supports simulation APIs/events for incoming wire transfers.
3. The backend supports card-network style transaction operations on card-linked ledgers: auth, post, void, and refund.
4. Simulated rail/card events create and update transaction records with statuses and timestamps suitable for integration testing.
5. Ledger/account effects from simulations are reflected in balances and transaction history according to defined sandbox rules.
6. Card operations enforce lifecycle validity (e.g., voiding an eligible auth, refunding an eligible posted transaction) and return production-like error responses for invalid transitions.
7. All simulated transactions remain tenant-scoped; no cross-tenant visibility or mutation is possible.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-004-T1 | `tests/req-f-004-rails-card-simulation.test.ts` | `REQ-F-004: ACH, wire, and card lifecycle simulation` — Verifies rail/card event handling, status transitions, balance effects, and tenant isolation. |

Success of this test proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
