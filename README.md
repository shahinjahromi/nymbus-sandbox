# Nymbus Sandbox

A **sandbox environment** for the Nymbus processor so integrators can create developer accounts with OAuth credentials, call all APIs, and receive **production-like responses** to integrate and validate their implementations before going live against a live Nymbus core processor.

## What This Provides

- **Developer accounts & OAuth 2.0** — Integrators get `client_id` and `client_secret`; they use the **client_credentials** grant to obtain an access token for the sandbox API.
- **Developer portal (MVP)** — Built-in sandbox portal at `/portal` for developer registration/login, OTP password reset, credential lifecycle actions (create/list/rotate/revoke), and sandbox activity/audit visibility.
- **Security guardrails** — Configurable in-memory throttling for OAuth, authenticated API operations, and portal auth/reset endpoints with `429` + `Retry-After` enforcement on abuse patterns.
- **Full API surface** — Same endpoints and response shapes as production: accounts, transactions, customers, transfers (ACH, wire, internal, instant).
- **Deterministic mock data** — Realistic but fake data so integrators can assert on balances, statuses, and pagination without touching real cores.
- **Durable persistence** — Tenant and fallback state is persisted to a SQLite database (WAL mode) so data survives process restarts. Configure via `SANDBOX_SQLITE_PATH` and `SANDBOX_SQLITE_RESET_ON_BOOT`.
- **Pre-production validation** — Build and test integrations end-to-end, then switch the base URL and credentials to production when ready.

## Quick Start

```bash
cp .env.example .env   # optional: edit for custom port or default client
npm install
npm run dev
```

Server runs at **http://localhost:3040** (or `PORT` from `.env`).

## For Integrators

### 1. Get credentials

In a real deployment, you receive **client_id** and **client_secret** from the Nymbus developer portal after creating a sandbox developer account. For local runs, the default sandbox client is:

- **Client ID:** `sandbox_dev_001`
- **Client Secret:** `sandbox_secret_change_in_production`

### 2. Get an access token

```bash
curl -X POST http://localhost:3040/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"sandbox_dev_001","client_secret":"sandbox_secret_change_in_production","grant_type":"client_credentials"}'
```

Response:

```json
{
  "access_token": "<token>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "<optional>",
  "scope": "sandbox"
}
```

### 3. Call the API

Use the `access_token` as a Bearer token on all protected endpoints:

```bash
export TOKEN="<access_token from step 2>"

# List accounts
curl -H "Authorization: Bearer $TOKEN" http://localhost:3040/accounts

# List accounts for a customer
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3040/accounts?customer_id=cust_sand_001"

# Get account by ID
curl -H "Authorization: Bearer $TOKEN" http://localhost:3040/accounts/acct_sand_001

# List transactions for an account
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3040/transactions?account_id=acct_sand_001"

# List customers
curl -H "Authorization: Bearer $TOKEN" http://localhost:3040/customers

# List transfers for an account
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3040/transfers?account_id=acct_sand_001"

# Create a transfer (sandbox accepts and returns a pending transfer)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"from_account_id":"acct_sand_001","to_account_id":"acct_sand_002","amount":100,"type":"internal"}' \
  http://localhost:3040/transfers
```

### 4. API spec

- **OpenAPI (YAML):** `GET /docs` returns the sandbox API spec.
- **Versioned API support:** implemented core resources are available on unversioned paths and versioned prefixes (`/v1.0` to `/v1.5`) for parity progression with bundled Nymbus contracts.
- **Prioritized specialized Core routes:** customer/account nested operations, loan-payment management, document/UDF workflows, transfer/debit-card controls, and transaction lifecycle flows are implemented directly (for example: `GET /customers-ext`, `POST /customers/search`, `GET /accounts-ext`, `GET/PATCH/DELETE /accounts/:id/loanPayments*`, `PATCH /accounts/:id/updateRewardProgramLevel`, `GET /accounts/:id/transactions/:transactionId/image`, `POST /customers`, `PATCH /customers/:id`, `GET/POST /customers/:id/accounts`, `PATCH /customers/:id/accounts/:accountId`, `POST /customers/:id/accounts/:accountId/close`, `POST /customers/:id/accounts/:accountId/reopen`, `GET /customers/:id/transfers`, `POST /customers/:id/transfers/*`, `PATCH/DELETE /customers/:id/transfers/:transferId`, `GET/POST /customers/:id/userDefinedFields`, `GET/POST/PATCH/DELETE /customers/:id/accounts/:accountId/userDefinedFields*`, `POST /customers/:id/documents`, `GET/PATCH/DELETE /customers/:id/documents/:documentRootId`, `GET/POST /customers/:id/accounts/:accountId/documents`, `GET/PATCH/DELETE /customers/:id/accounts/:accountId/documents/:documentRootId`, `GET/POST /customers/:id/debitCards`, `POST /customers/:id/debitCards/:debitCardId/*`, `POST /debitCards/activateCardByCardNumber`, `GET /debitCards/referenceId/:refId`, `POST /accounts/search`, `POST /transactions`, `POST /transactions/transfer`, `POST /transactions/externalTransfer`, `POST /transactions/createIncomingWire`, `POST /transactions/createOutgoingWire`, `POST /transactions/updateIncomingWireStatus`, `POST /transactions/updateOutgoingWireStatus`, `POST /transactions/commitWireTransaction`, `POST /transactions/disbursement`, `POST /onboarding/loanOnboardingFunding`, `GET/POST/PATCH /accounts/:id/escrow*`, `GET/POST /accounts/:id/loanChargeAssessment`, `POST /accounts/:id/reservePremium`, `POST /accounts/:id/originalLtv`, `POST /accounts/:id/remoteDepositCapture`, `GET /accounts/:id/statements`, `GET /accounts/:id/statements/:statementId`, `POST /accounts/:id/stopCheck`, `GET/POST/DELETE /customers/:id/accounts/:accountId/stopCheck*`, `GET/POST/DELETE /customers/:id/accounts/:accountId/stopAch*`, `POST /customers/:id/creditCards`).
- **Contract fallback coverage:** bundled OpenAPI path/method pairs that are not yet specialized are still routed by local sandbox handlers with tenant-scoped, stateful execution.
- **Portal UI:** `GET /portal` serves the sandbox developer portal client.
- **Portal API:**
  - Auth/session: `POST /portal-api/register`, `POST /portal-api/login`, `POST /portal-api/password-reset/*`, `GET /portal-api/me`
  - Credentials: `GET/POST /portal-api/credentials`, `POST /portal-api/credentials/:id/rotate`, `POST /portal-api/credentials/:id/revoke`
  - Tenant operations: `GET/POST /portal-api/users`, `GET/POST /portal-api/accounts`, `GET /portal-api/accounts/:id`, `GET /portal-api/accounts/:id/transactions`, `POST /portal-api/accounts/:id/seed`, `POST /portal-api/accounts/:id/reset`, `POST /portal-api/tenant/reset`, `POST /portal-api/tenant/seed`
  - Simulations: `POST /portal-api/simulations/ach-incoming`, `POST /portal-api/simulations/ach-outgoing`, `POST /portal-api/simulations/wire-incoming`, `POST /portal-api/simulations/card`
  - Interest/yield: `GET/POST /portal-api/accounts/:id/yield-config`, `POST /portal-api/interest/accrue-daily`
  - Observability: `GET /portal-api/api-activity`, `GET /portal-api/audit`
  - Contract visibility: `GET /portal-api/contract/metadata`, `GET /portal-api/contract/changelog`, `GET /portal-api/contract/deprecations`
- **Environment scope header:** authenticated API and portal session calls accept optional `x-environment` (or `x-sandbox-environment`); values other than `sandbox` are rejected with `401 INVALID_ENVIRONMENT_SCOPE`.
- **Root:** `GET /` returns a short summary with token URL and endpoint list.
- **Health:** `GET /health` for liveness.

## Sandbox vs production

| Aspect | Sandbox | Production |
|--------|--------|------------|
| Base URL | e.g. `http://localhost:3040` or hosted sandbox URL | Live Nymbus core API URL |
| Credentials | Sandbox developer client_id / client_secret | Production OAuth credentials issued for your app |
| Data | Mock, deterministic; no real accounts or money | Real core; real accounts and transactions |
| Behavior | Same response shapes and status codes; transfers/effects are simulated | Real processing and settlement |

Integrators should use the **same client code** for both environments and only switch configuration (base URL + credentials) when promoting to production.

## Project structure

```
nymbus-sandbox/
├── openapi/
│   └── sandbox-api.yaml    # API specification for sandbox
├── src/
│   ├── index.ts            # Express app, routes, /health, /docs
│   ├── config.ts           # Env-based config
│   ├── auth/
│   │   ├── oauth.ts        # Token issuance, client_credentials grant
│   │   └── middleware.ts   # Bearer auth for protected routes
│   ├── routes/
│   │   ├── auth.ts         # POST /oauth/token
│   │   ├── accounts.ts     # GET /accounts, /accounts/:id
│   │   ├── transactions.ts # GET /transactions, /transactions/:id
│   │   ├── customers.ts    # GET /customers, /customers/:id
│   │   └── transfers.ts    # GET/POST /transfers, GET /transfers/:id
│   ├── services/
│   │   ├── developer-registry.ts  # In-memory OAuth client store
│   │   └── mock-data.ts    # Production-like mock entities
│   └── types/
│       └── index.ts        # Shared types (Account, Transaction, etc.)
├── .env.example
├── package.json
└── README.md
```

## Extending the sandbox

- **More endpoints:** Add routes under `src/routes/` and mirror production request/response shapes; add mock data or behavior in `src/services/mock-data.ts`.
- **Developer portal:** Replace the in-memory `developer-registry` with a database and a small portal (or admin API) that issues `client_id` / `client_secret` per developer.
- **Hosted deployment:** Set `SANDBOX_BASE_URL` to the public sandbox URL; run behind HTTPS and rate limiting in production.

## License

Internal use; align with your organization’s policy for the Nymbus integration.
