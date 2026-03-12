# Nymbus Sandbox

A **sandbox environment** for the Nymbus processor so integrators can create developer accounts with OAuth credentials, call all APIs, and receive **production-like responses** to integrate and validate their implementations before going live against a live Nymbus core processor.

## What This Provides

- **Developer accounts & OAuth 2.0** — Integrators get `client_id` and `client_secret`; they use the **client_credentials** grant to obtain an access token for the sandbox API.
- **Full API surface** — Same endpoints and response shapes as production: accounts, transactions, customers, transfers (ACH, wire, internal, instant).
- **Deterministic mock data** — Realistic but fake data so integrators can assert on balances, statuses, and pagination without touching real cores.
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
