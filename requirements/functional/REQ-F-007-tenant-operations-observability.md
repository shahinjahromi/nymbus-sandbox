# REQ-F-007: Tenant operations visibility, test-data lifecycle, and API activity log

**ID:** REQ-F-007  
**Type:** Functional  
**Status:** Proposed

## Description

After authentication, the developer portal must provide tenant-scoped operational visibility for entities created via APIs, account financial state, and operational controls for sandbox data setup/reset.

The portal must also provide visibility into API call activity performed with the developer's credentials.

## Acceptance criteria

1. A logged-in developer can view users and bank accounts created via APIs in their own tenant.
2. For each SMB account in tenant scope, the portal provides actions to seed account test data and clear/reset test data to a clean state.
3. For accounts created via APIs, the portal displays current ledger balance.
4. For accounts created via APIs, the portal displays associated transaction history.
5. The portal provides an API activity log for the developer showing calls made against backend services with that developer's credentials.
6. API activity log includes, at minimum, method, endpoint, timestamp, status/result, and correlation/request identifier where available.
7. All data views and actions in this requirement are tenant-scoped and prevent cross-tenant data access.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-007-T1 | `tests/req-f-007-tenant-data-visibility.test.ts` | Verifies tenant-scoped visibility of users, accounts, balances, and transactions. |
| REQ-F-007-T2 | `tests/req-f-007-seed-clear-lifecycle.test.ts` | Verifies SMB account seed/reset actions and resulting dataset transitions. |
| REQ-F-007-T3 | `tests/req-f-007-api-activity-log.test.ts` | Verifies developer API activity log content and tenant isolation. |

Success of these tests proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
