# Data Requirements: Polymarket Copy-Trading System

## 1. Data Philosophy & Ingestion Principles

1. **Zero Data Fabrication**: If an external API is down, rate-limited, or returns empty data, the system must record the exact error state and halt or retry. It must never invent simulated or fabricated prices and pass them off as live market data.
2. **Deterministic Time Disambiguation**: Every market event and trade must preserve distinct timestamps:
   - `sourceTime`: Timestamp assigned by the upstream exchange/chain.
   - `ingestionTime`: Timestamp when the bot's adapter fetched the payload.
   - `processingTime`: Timestamp when the scoring engine evaluated the payload.
   - `availabilityTime`: Timestamp after which the data was genuinely visible to decisions.
3. **Immutability of Historical Records**: Once an observed trade, decision journal entry, or market snapshot is committed, it is read-only. Retrospective analysis must write to separate outcome review tables.
4. **Adapter Decoupling**: Upstream schemas from Polymarket, Bullpen, or third-party indexers must be normalized into internal Domain Transfer Objects (DTOs) before reaching strategy engines.

---

## 2. Upstream Data Sources & Adapters

### 2.1 Leaderboard Adapter
- **Primary Source**: Polymarket Leaderboard API or Bullpen API.
- **Payload Schema**:
  - `rank`: Integer (1 to 500)
  - `walletAddress`: Hex address (`0x...`)
  - `pseudonym` / `label`: Optional string
  - `volume30d`: Numeric USD volume
  - `pnl30d`: Numeric USD profit/loss
  - `tradeCount`: Integer
- **Frequency**: Scheduled scan (e.g., daily or on-demand).

### 2.2 Wallet Activity & Historical Trades Adapter
- **Primary Source**: Polymarket Data API / Gamma API / Indexer for wallet transaction histories.
- **Payload Schema**:
  - Historical trade events across last 30 days
  - Timestamps, market IDs, condition IDs, token IDs, side (BUY/SELL), outcome (YES/NO), price, size, cash volume, transaction hash.
- **Purpose**: Calculate ROI, consistency, trade count, category strengths, win rate on resolved markets, and one-hit-wonder penalty metrics.

### 2.3 Real-Time Trade Monitor Adapter
- **Primary Source**: Polymarket CLOB WebSocket / User trade stream or high-frequency polling on `TRACK` wallets.
- **Target Latency**: Near real-time (< 5 seconds preferred, subject to public API rate limits).
- **Extracted Fields**:
  - `walletAddress`: Address of tracked actor
  - `marketId`: Polymarket market slug / condition ID
  - `outcome`: Outcome token index / name
  - `side`: BUY or SELL
  - `walletEntryPrice`: Price executed by the tracked wallet
  - `size`: Amount of shares or USDC
  - `timestamp`: On-chain or exchange timestamp
  - `rawTradeJson`: Full verbatim payload preserved for auditing

### 2.4 Market Depth & Pricing Adapter
- **Primary Source**: Polymarket CLOB API (`GET /book`, `GET /price`, `GET /midpoint`) & Gamma Markets API.
- **Required Snapshot Elements**:
  - `yesPrice`, `noPrice`
  - `bestBid`, `bestAsk`
  - `spread`: Calculated as $\text{bestAsk} - \text{bestBid}$ or $(\text{bestAsk} - \text{bestBid}) / \text{midPrice}$
  - `liquidity`: Top-of-book depth and near-the-money book depth (USDC)
  - `volume24h`: 24-hour turnover
  - `timeToResolution`: Expected resolution timestamp minus current timestamp
  - `status`: Active, closed, or resolved

### 2.5 Market Resolution & Outcome Adapter
- **Primary Source**: Polymarket Gamma API (`/markets/{id}`) and UMA Oracle resolution events.
- **Captured Data**:
  - `resolved`: Boolean flag
  - `winner`: The winning outcome (e.g., YES, NO, or specific multi-choice index)
  - `payoutPrice`: Final settlement price (typically $1.00 for winner, $0.00 for loser)
  - `resolutionTime`: Timestamp of official oracle settlement

---

## 3. Data Integrity & Error Handling

### 3.1 Failure Modes
- **HTTP 429 / Rate Limiting**: Exponential backoff with jitter; record `API_RATE_LIMIT` event in health logs.
- **HTTP 5xx / Endpoint Outage**: Record `API_DOWN` status in system health table; halt automated paper copy execution until connectivity resumes.
- **Malformed Response**: Log raw payload to dead-letter log; flag trade as `UNPARSED_OBSERVATION` rather than silently dropping.

### 3.2 Demo & Seed Data Isolation
- To support offline testing and UI development without active internet/API credentials:
  - Seed fixtures must reside in `src/data/fixtures/`.
  - All synthetic records must explicitly populate `isDemo: true` or have `DEMO_` prefix in identifiers.
  - UI headers must prominently display a `[DEMO DATA MODE]` badge when offline datasets are rendered.

### 3.3 Security & Secret Redaction
- No private keys, mnemonic phrases, or secret signing credentials are ever collected or processed.
- Optional API keys (e.g., Telegram Bot Token, third-party RPC endpoints) must be loaded strictly from process environment variables (`process.env`).
- Logging pipelines must intercept and sanitize strings matching API key patterns before writing to console, file, or SQLite database.
