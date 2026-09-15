# DATA SOURCES & LIVE READ-ONLY INGESTION VERIFICATION

**Document Version:** 1.0.0  
**Phase:** Task 1.2 — Live Read-Only Data Ingestion  
**Execution Mode:** STRICTLY PAPER ONLY (`ExecutionMode.PAPER`)  
**Data Access Policy:** Strictly Read-Only (Public HTTP GET queries only)  
**Security Boundary:** Zero private keys, zero wallet signing, zero execution endpoints  

---

## 1. Official Data Sources & Endpoint Verification

Polymarket architecture exposes three distinct public HTTP API subdomains for read-only market discovery and activity monitoring:

### 1.1 Polymarket Data API (`https://data-api.polymarket.com`)
*Primary purpose:* Leaderboards, wallet activity, trade history, and user positions.

| Endpoint | Capability | Auth Required | Parameters Verified | Limitations & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET /v1/leaderboard` (or `/leaderboard`) | Global profitability & volume leaderboard | None (Public) | `limit` (max 100 per page), `offset`, `timeFrame` (e.g. `all`, `month`, `week`) | Returns ranked wallets with PnL, volume, and rank. Returns paginated arrays up to requested limit. Gaps in rank or fewer entries than requested population are preserved as real counts. |
| `GET /trades` | Historical trade activity by wallet | None (Public) | `user` (0x wallet address), `limit` (max 100), `offset`, `takerOnly` (boolean) | Historical fills executed by or matched with target wallet. Includes `transactionHash` when mined on Polygon, `timestamp`, `price`, `size`, `side` (BUY/SELL), and `conditionId`/`asset`. |
| `GET /activity` | Secondary user timeline events | None (Public) | `user`, `limit`, `offset` | Event-level audit stream (mints, redeems, trades). Used as supplement if `/trades` pagination encounters gaps. |
| `GET /positions` | Current token holdings by wallet | None (Public) | `user`, `sizeThreshold` | Open token quantities across outcome tokens. |

### 1.2 Polymarket Gamma API (`https://gamma-api.polymarket.com`)
*Primary purpose:* Market catalog, metadata, question taxonomy, and resolution state.

| Endpoint | Capability | Auth Required | Parameters Verified | Limitations & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET /markets` | Market query and listing | None (Public) | `id`, `condition_id`, `slug`, `limit`, `offset`, `closed` | Returns full market specifications: `question`, `category`, `outcomes` (JSON array: `["Yes", "No"]`), `outcomePrices` (JSON array: `["0.52", "0.48"]`), `clobTokenIds`, `active`, `closed`, `resolved`, `winningOutcome`. |
| `GET /events` | Market event groupings | None (Public) | `id`, `slug` | Groups multi-outcome or nested markets under a parent event. |

### 1.3 Polymarket CLOB API (`https://clob.polymarket.com`)
*Primary purpose:* Central Limit Order Book (CLOB) depth, spreads, and midpoints.

| Endpoint | Capability | Auth Required | Parameters Verified | Limitations & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET /book` | Order book L2 depth | None (Public) | `token_id` (Asset token ID) | Returns `bids: [{price, size}]` and `asks: [{price, size}]`. Bids sorted descending, asks sorted ascending. Yields instantaneous best bid, best ask, spread, and top-of-book depth. |
| `GET /midpoint` | Immediate midpoint price | None (Public) | `token_id` | Quick point-in-time sanity check for midpoint between top bid and ask. |

---

## 2. Rate Limits & Network Infrastructure Policy

Documented and verified provider rate limits are strictly enforced by the `ReadOnlyHttpClient` sliding-window limiter:

- **Data API:** Max 10 requests / second.
- **Gamma API:** Max 10 requests / second.
- **CLOB API:** Max 15 requests / second.
- **Concurrency & Timeouts:** Bounded concurrency (default 5 concurrent requests) with a mandatory 10,000ms request timeout.
- **Backoff & Jitter:** Exponential backoff ($200\text{ms} \times 2^{\text{attempt}} + \text{jitter}$) up to 3 retries for retryable status codes (`429 Too Many Requests`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`, network disconnects).
- **Non-Retryable Errors:** Client errors (`400 Bad Request`, `401 Unauthorized`, `404 Not Found`, structural validation failures) are terminated immediately and classified with structured error codes.

---

## 3. Data Flow & Validation Pipeline

External JSON payloads are never trusted implicitly. Ingestion implements a four-stage pipeline:

```
[RAW EXTERNAL RESPONSE]
          ↓
[STAGE 1: VALIDATION]
   - Verify array/object structure
   - Verify required entity fields (walletAddress, marketId, price, outcome, etc.)
   - Reject malformed records with structured diagnostics
          ↓
[STAGE 2: NORMALIZATION (DataNormalizer)]
   - Deterministic type conversions (numeric parsing, uppercase sides, ISO UTC timestamps)
   - Preserve unaltered raw JSON payload in `rawPayload` / `rawTradeJson`
   - Capture full provenance metadata (provider, sourceIdentifier, timestamps, normalizationVersion)
          ↓
[STAGE 3: REPOSITORY PERSISTENCE]
   - Composite deduplication check (transactionHash or composite unique key)
   - Store immutable facts in SQLite: `leaderboard_scans`, `wallets`, `observed_trades`, `market_snapshots`, `ingestion_operations`
          ↓
[STAGE 4: DOMAIN CONSUMPTION]
   - Deterministic scoring engine (RuleSet) consumes stored normalized records
```

---

## 4. Provenance & Audit Trail

Every ingested fact retains explicit provenance:
1. `provider`: Source identifier (e.g. `polymarket_data_api`, `polymarket_gamma_api`, `polymarket_clob_api`, `fixture_leaderboard`).
2. `sourceIdentifier`: Upstream event ID or transaction hash.
3. `sourceTime`: Upstream UTC timestamp provided by the network. If upstream does not provide a timestamp, `sourceTime` is set to `null`—local time is **never substituted or fabricated**.
4. `ingestionTime`: Local ISO UTC timestamp when our system parsed the record.
5. `normalizationVersion`: Semantic version of the normalizer (`1.0.0`).
6. `isDemo`: Boolean flag explicitly indicating whether the record originated from live read-only APIs or fixture/demo datasets.

---

## 5. Deduplication Strategy

To ensure zero duplicate trade ingestion across repeated or overlapping pagination scans:
1. **Primary Key:** `sourceTxHash` (Polygon transaction hash from `/trades`).
2. **Fallback Composite Key:** `walletAddress + marketId + outcome + side + sourceTimestamp + price + size`.
3. **Database Guard:** Unique index `idx_observed_trades_composite` enforcing idempotency at the database storage engine layer.
4. **Preservation:** Distinct trades executing with different sizes or distinct event IDs are never collapsed.

---

## 6. Historical Window & Completeness

- **Configurable Target Window:** Default is 30 days (`analyzedWindowDays: 30`).
- **Pagination Coverage:** The adapter pages backward until either:
  1. The earliest trade timestamp is older than `Date.now() - 30 days`.
  2. The provider returns an empty array or fewer items than the page size.
  3. The maximum page limit (50 pages / 5,000 trades) is reached.
- **Diagnostics Reporting:** If provider history ends prematurely (e.g. only 12 days available), the ingestion operation records the actual window received without synthesizing missing data.

---

## 7. Explicit Scan & Lifecycle States

Leaderboard and wallet scanning operations record an explicit lifecycle in `ingestion_operations`:
- `REQUESTED`
- `RUNNING`
- `COMPLETED`
- `COMPLETED_WITH_WARNINGS`
- `FAILED`
- `PARTIAL`

Operators can unambiguously distinguish *"zero records exist"* from *"upstream request timed out or returned HTTP 429"*.

---

## 8. Demo Mode vs. Live Read-Only Mode Separation

- **CLI flags:** `--mode=live` vs `--mode=fixture` (or `--mode=demo`).
- **Zero Silent Fallbacks:** If `--mode=live` fails, the runner throws an explicit error and exits with code 1. It **never** falls back silently to demo data.
- **UI Indicators:** Web dashboard and Android observability clients display prominent banners:
  - `LIVE READ-ONLY DATA` (Emerald green badge)
  - `DEMO DATA` (Amber warning badge)
  - `NO DATA` (Slate grey badge)

---

## 9. Security & Execution Boundary Invariants

- **Execution Mode:** Firmly locked to `ExecutionMode.PAPER`.
- **Zero Private Keys:** No mnemonic parsing, no private key storage, no Web3 wallet signers.
- **Zero Live Execution Surface:** HTTP client rejects any non-`GET` HTTP verb.
- **Sanitized Observability:** Loggers and error serializers redact potential tokens or secrets.

---

## 10. Unverified / TBD Capabilities

The following capabilities are left explicitly unsupported until official upstream documentation provides deterministic guarantees:
1. **WebSocket Real-Time Orderbook Streaming:** While Polymarket CLOB WebSocket endpoints exist, their reconnection semantics, ping intervals, and sequence-ordering guarantees are subject to change. Task 1.2 intentionally uses deterministic point-in-time HTTP polling (`GET /book`). WebSocket streaming remains isolated for future tasks.
2. **Off-chain CLOB Fills Matching Stream:** Off-chain taker matching events before Polygon on-chain settlement are not treated as settled facts until present in the Data API `/trades` or on-chain transaction logs.
