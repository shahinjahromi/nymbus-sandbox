# REQ-F-008: Transaction simulation controls and account yield configuration

**ID:** REQ-F-008  
**Type:** Functional  
**Status:** Proposed

## Description

The developer portal must expose simulation actions for external transaction scenarios and account attribute configuration supported by the Nymbus Core API specifications.

The backend simulator must persist the configuration and compute daily interest accrual as account balances evolve over time.

## Acceptance criteria

1. A logged-in developer can trigger simulation of an external incoming ACH transfer for a tenant-scoped account.
2. A logged-in developer can trigger simulation of an external incoming wire transfer for a tenant-scoped account.
3. A logged-in developer can trigger simulation of an incoming card-network transaction against a card linked to a tenant-scoped account ledger.
4. The portal allows configuration of account yield/interest attributes (e.g., APY, interest settings, and other supported account attributes) where such attributes are supported by the active Nymbus Core API contract.
5. Backend persists account configuration changes and applies contract-valid validation and error behavior.
6. Backend computes and records daily accrued interest for configured accounts based on account balance and configured yield rules as the account ages.
7. Ledger balance and transaction/interest history reflect simulation events and accrual effects consistently.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-008-T1 | `tests/req-f-008-transfer-card-simulations.test.ts` | Verifies ACH, wire, and card incoming simulation flows and ledger effects. |
| REQ-F-008-T2 | `tests/req-f-008-account-yield-config.test.ts` | Verifies APY/interest configuration persistence and validation. |
| REQ-F-008-T3 | `tests/req-f-008-daily-interest-accrual.test.ts` | Verifies daily interest accrual computation and recording over simulated account aging. |

Success of these tests proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
