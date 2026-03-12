# REQ-F-012: Environment scoping and credential separation

**ID:** REQ-F-012  
**Type:** Functional  
**Status:** Proposed

## Description

The developer portal must make environment context explicit and enforce credential/data separation by environment.

For current scope, sandbox is the active environment; if additional environments are enabled later, credentials and data visibility must remain environment-scoped and isolated.

## Acceptance criteria

1. The portal clearly labels active environment context (sandbox) on credential, API log, and simulation views.
2. Credentials are bound to a specific environment scope and cannot be used outside their configured environment scope.
3. API activity and operational views are partitioned by environment scope in addition to tenant scope.
4. Environment scoping behavior is documented for developers as part of integration guidance.
5. This requirement does not require production endpoint monitoring.

## Test case(s)

| Test | File | Description |
|------|------|-------------|
| REQ-F-012-T1 | `tests/req-f-012-environment-labeling.test.ts` | Verifies explicit environment labeling in authenticated portal views. |
| REQ-F-012-T2 | `tests/req-f-012-credential-environment-scope.test.ts` | Verifies environment-bound credentials cannot authenticate cross-environment calls. |
| REQ-F-012-T3 | `tests/req-f-012-environment-partitioned-logs.test.ts` | Verifies API activity is partitioned by tenant and environment context. |

Success of these tests proves the requirement is implemented correctly.

## Change history

- 2026-03-12: Initial requirement logged.
