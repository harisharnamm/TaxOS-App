## Open Banking Integration (Mastercard Open Banking US)

This document outlines a phased plan to implement Mastercard Open Banking US (formerly Finicity) so CPAs can send automated bank-link requests to their clients, receive webhook events, and fetch account data (balances, transactions) for display in our platform.

### Guiding principles
- Reliability and security first. Keep secrets server-side; verify webhooks; implement idempotency.
- Implement in small, testable phases with clear acceptance criteria.
- Minimal UI/DB changes per phase; ship value incrementally.

---

## Cheat sheet: Keys and IDs

- partnerId: Identifies our platform. Permanent.
- partnerSecret: Used to obtain partner token. Permanent (rotate annually). Server-side only.
- Finicity-App-Key: Required header on all API calls. Permanent unless regenerated.
- Partner Token (from POST /aggregation/v2/partners/authentication): Short-lived (~90–120 min). Send in `Finicity-App-Token` header for subsequent calls.
- customerId: Represents the end user (CPA’s client). Permanent until deleted.
- Connect URL / Connect Email link: Generated per customerId. TTL ~3 days.

References
- Authentication: POST `https://api.finicity.com/aggregation/v2/partners/authentication`
- Create test customer: POST `https://api.finicity.com/aggregation/v2/customers/testing`
- Send Connect email: POST `https://api.finicity.com/connect/v2/send/email`
- Authorization window lookup: GET `/customers/institution-logins/{institution_login_id}/authorization-details`
- OBWMS (new Webhook system): see notification-subscriptions endpoints

---

## Architecture overview

- Backend: Supabase Edge Functions (Deno) act as our secure proxy to Mastercard APIs.
  - Token service: obtain and cache Partner Token.
  - Customer service: create testing/prod customers.
  - Connect service: send Connect email; optionally generate Connect URL.
  - Data service: fetch accounts, balances, transactions.
  - Webhook service: receive and verify Mastercard OBWMS/Connect events and persist to DB.
- Frontend (React): add actions in `ClientDetail` to initiate bank-link email and view linked data.
- Database (Postgres via Supabase): store linkage state, events, accounts, and transactions.

Secrets handling
- Keep secrets in server env only (Supabase Edge and deployment platform). Never expose in frontend bundles.

---

## Environment variables (server-side)

Store these in Supabase Edge Function secrets and deployment envs (not in frontend):

```
OPEN_BANKING_PARTNER_ID=
OPEN_BANKING_PARTNER_SECRET=
OPEN_BANKING_APP_KEY=
# OBWMS signature verification
OPEN_BANKING_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
# optional: override base URL if needed
OPEN_BANKING_BASE_URL=https://api.finicity.com
```

Frontend should not read these. For client-side routing/callback display, use non-secret config values only if necessary.

---

## Database (proposed)

Phase by phase, add minimal tables:

1) Token cache
```
open_banking_partner_tokens (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
)
```

2) Customers mapping
```
open_banking_customers (
  id uuid primary key default gen_random_uuid(),
  platform_client_id uuid not null, -- references our client entity
  finicity_customer_id text not null unique,
  created_at timestamptz not null default now()
)
```

3) Connect email logs
```
open_banking_connect_emails (
  id uuid primary key default gen_random_uuid(),
  finicity_customer_id text not null,
  email_to text not null,
  link text,
  ttl_expires_at timestamptz,
  status text not null default 'sent',
  created_at timestamptz not null default now()
)
```

4) Accounts
```
open_banking_accounts (
  id text primary key, -- Finicity account id
  finicity_customer_id text not null,
  name text,
  type text,
  status text,
  balance numeric,
  currency text,
  institution_id text,
  institution_login_id text,
  last_updated_at timestamptz
)
```

5) Transactions
```
open_banking_transactions (
  id text primary key, -- Finicity transaction id
  account_id text not null references open_banking_accounts(id),
  amount numeric not null,
  description text,
  posted_date timestamptz,
  created_at timestamptz not null default now()
)
```

6) Webhook events (idempotency + audit)
```
open_banking_webhook_events (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique, -- X-Mastercard-Webhook-Message-Id
  event_type text not null,
  finicity_customer_id text,
  headers jsonb not null,
  payload jsonb not null,
  verified boolean not null default false,
  received_at timestamptz not null default now()
)
```

We will add SQL migrations once fields are finalized.

---

## Phases & acceptance criteria

### Phase 1: Setup & token service

Deliverables
- Secrets configured in server env.
- Edge function: `ob-auth` (name tbd) that returns a Partner Token, caching it until ~75–90 minutes.
- Token stored in DB cache to survive cold starts; refreshed when < 15 min remaining.

API references
```
POST https://api.finicity.com/aggregation/v2/partners/authentication
Headers:
  Content-Type: application/json
  Accept: application/json
  Finicity-App-Key: {OPEN_BANKING_APP_KEY}
Body:
{
  "partnerId": "{OPEN_BANKING_PARTNER_ID}",
  "partnerSecret": "{OPEN_BANKING_PARTNER_SECRET}"
}
Response: { "token": "..." }
```

Acceptance criteria
- Calling our `ob-auth` returns a valid token and caches it. Unit tests cover cache refresh logic.

### Phase 2: Create customer (testing) & map to platform client

Deliverables
- Edge function: `ob-customer` endpoints
  - POST /testing to create a test customer
  - POST /prod (later) to create production customer
- Persists `finicity_customer_id` mapped to our platform client.

API reference (testing)
```
POST https://api.finicity.com/aggregation/v2/customers/testing
Headers:
  Content-Type: application/json
  Accept: application/json
  Finicity-App-Key: {OPEN_BANKING_APP_KEY}
  Finicity-App-Token: {partner_token}
Body: { "username": "A unique customer name" }
Response: { "id": "1005061234", "username": "...", "createdDate": 1607450357 }
```

Acceptance criteria
- Given a platform client, we can create or reuse a stored `finicity_customer_id`.

### Phase 3: Send Connect email (initiate linking)

Deliverables
- Edge function: `ob-connect` endpoint to `POST /connect/v2/send/email` with configured `redirectUri` and `webhook` pointing to our Edge webhook.
- Store email log with returned link & TTL.
- Frontend: add "Send Bank Authentication Request to Client" button on `ClientDetail` to call this endpoint.

API reference
```
POST https://api.finicity.com/connect/v2/send/email
Headers:
  Content-Type: application/json
  Accept: application/json
  Finicity-App-Key: {OPEN_BANKING_APP_KEY}
  Finicity-App-Token: {partner_token}
Body: {
  "language": "en",
  "partnerId": "{OPEN_BANKING_PARTNER_ID}",
  "customerId": "{finicity_customer_id}",
  "redirectUri": "https://ourapp.com/openbanking/callback",
  "webhook": "https://<supabase-edge-url>/functions/v1/open-banking-webhook",
  "webhookContentType": "application/json",
  "email": {
    "to": "bob@example.com",
    "from": "noreply@ourapp.com",
    "supportPhone": "800-555-5555",
    "subject": "Please link your bank account",
    "firstName": "Bob",
    "institutionName": "Our CPA Firm",
    "institutionAddress": "123 Main St, City, ST",
    "signature": ["Jane Doe", "CPA", "Direct: 123-456-7890"]
  },
  "singleUseUrl": true
}
```

Acceptance criteria
- Clicking the button sends email and returns/stores the link + TTL. Basic UI state shows "Pending linking".

### Phase 4: Webhooks (OBWMS + legacy Connect) & verification

Deliverables
- Edge function: `open-banking-webhook` that:
  - Accepts POST.
  - Immediately returns 202/204.
  - Verifies signature using `X-Mastercard-Signature*` headers (ECDSA/SHA256) against `OPEN_BANKING_WEBHOOK_PUBLIC_KEY`.
  - Stores event with idempotency on `X-Mastercard-Webhook-Message-Id`.
  - Handles common events: `started`, `discovered`, `added`, `processing`, `done`, errors, etc.
- (If using OBWMS) endpoints to create/list/update webhook subscriptions.

Notes
- For development, a temporary webhook.site URL can be used to observe payloads. In production, use our secure endpoint only.

Acceptance criteria
- Webhook events are persisted with `verified=true` when signature passes. Duplicate deliveries ignored.

### Phase 5: Data retrieval & persistence

Deliverables
- Edge data service to fetch and upsert:
  - Accounts for a `finicity_customer_id`.
  - Transactions per account (date range configurable).
- Scheduled refresh (e.g., daily) and on-demand refresh.
- Optional lookup of authorization window using institutionLoginId to prompt re-consent prior to expiry.

Acceptance criteria
- For a linked test customer, accounts and transactions appear in DB and UI.

### Phase 6: Frontend UI (read-only views)

Deliverables
- `ClientDetail` additions:
  - Action: Send bank-link email
  - Section: Linked accounts (name, type, balance, last updated)
  - Transactions table (paginated by account)
- Simple badges for status: Not linked / Pending / Linked / Error.

Acceptance criteria
- CPA can send link and later view fetched data.

### Phase 7: Testing & security

Testing
- Unit tests: token caching, webhook verification, parsers.
- Integration tests: mock Mastercard endpoints; E2E in sandbox with FinBanks.
- UAT with internal accounts.

Security
- Verify webhook signatures, enforce short time tolerance on `X-Mastercard-Signature-Timestamp`.
- Store PII and tokens securely; encrypt sensitive columns as needed.
- Principle of least privilege for API keys and DB roles.

Acceptance criteria
- Passing test suite; security checklist complete.

### Phase 8: Deployment & monitoring

Deliverables
- Staging rollout with secrets configured.
- Dashboards/alerts for Edge function errors, webhook failures, and data sync jobs.
- Runbook for expiring consent and re-auth prompts.

Acceptance criteria
- Stable staging run for at least one week; then production rollout.

---

## Implementation notes

- Token reuse: Use a single Partner Token across calls; refresh when age > 75–90 minutes.
- Idempotency: Use webhook message id; upsert on accounts/transactions.
- Pagination: Transactions may require paging; build incremental backfill per account.
- Rate limits: Implement basic backoff/retry. Log 429/5xx with correlation ids.
- Observability: Log request ids, event ids, institutionLoginId where applicable.

---

## API snippets (reference)

Partner authentication
```
curl --location --request POST 'https://api.finicity.com/aggregation/v2/partners/authentication' \
  --header 'Content-Type: application/json' \
  --header 'Finicity-App-Key: {{appKey}}' \
  --header 'Accept: application/json' \
  --data-raw '{
    "partnerId": "{{partnerId}}",
    "partnerSecret": "{{partnerSecret}}"
  }'
```

Create test customer
```
curl --location --request POST 'https://api.finicity.com/aggregation/v2/customers/testing' \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json' \
  --header 'Finicity-App-Key: {{appKey}}' \
  --header 'Finicity-App-Token: {{appToken}}' \
  --data-raw '{ "username": "A unique customer name" }'
```

Send Connect email
```
POST https://api.finicity.com/connect/v2/send/email
```

Authorization window (example)
```
GET https://api.finicity.com/customers/institution-logins/{institution_login_id}/authorization-details
```

---

## Open questions for you

1) Do we prefer OBWMS (new webhook system) from day one, or start with legacy Connect events? If OBWMS, please confirm we can upload and use the signature verification key now.
2) Confirm the domain and path for `redirectUri` (frontend) and webhook endpoint base URL (Edge functions prod/staging).
3) Provide the sending identity for emails (from-address, support phone, signature lines). Should we send via Mastercard email endpoint only, or also send a courtesy email via our Resend integration?
4) Confirm the minimal account/transaction fields CPAs need first (to keep UI focused), and retention policy for historical transactions.
5) Provide sandbox credentials (partnerId, partnerSecret, appKey) and the OBWMS public key to proceed with Phase 1.

---

## Acceptance & rollout checklist

- [ ] Secrets added to staging and production
- [ ] Token service working and cached
- [ ] Test customer creation flow
- [ ] Send Connect email flow with working webhook
- [ ] Webhook verification with signature + idempotency
- [ ] Accounts/transactions fetch and render
- [ ] E2E test in sandbox with FinBanks
- [ ] Monitoring/alerts configured
- [ ] Go/no-go review before production rollout


