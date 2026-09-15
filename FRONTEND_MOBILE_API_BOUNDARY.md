# Frontend & Mobile Architectural Boundary Documentation
**Polymarket Copy-Trading Research & Paper-Trading Foundation System**
**Document Version:** 1.0.0  
**Phase:** Task 1.11 Operations & Observability Foundation  
**Safety Boundary:** STRICTLY PAPER ONLY — READ-ONLY OBSERVATION  

---

## 1. System Topology & Dual-Surface Architecture

The Polymarket copy-trading and paper-trading platform is architected around a single, authoritative server-side core. Both the **Web Dashboard** (React 19 + TypeScript + Vite) and the upcoming **Mobile Application** serve exclusively as **read-only observation surfaces**. Neither surface executes trading logic, duplicates state, or manages financial keys.

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   Paper Trading Core                   │
                    │             (Node.js / DatabaseSync SQLite)            │
                    │                                                        │
                    │  - Ingestion Engine (Polymarket Data API)              │
                    │  - Wallet Intelligence & 30d Historical Profiler       │
                    │  - Real-Time Trade Monitor & Detection Loop            │
                    │  - Synchronous Deterministic TradeScorer               │
                    │  - Bounded Paper Trading Engine ($5.00 - $20.00 bounds)│
                    │  - Hourly Mark-To-Market Valuation & PnL Snapshots     │
                    │  - Outcome Review & Milestone Learning System          │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                     Read-Only REST API
                                 24h/48h Observability Engine
                                ┌───────────────┴───────────────┐
                                │                               │
                                ▼                               ▼
                    ┌───────────────────────┐       ┌───────────────────────┐
                    │     Web Dashboard     │       │   Mobile Application  │
                    │  (React 19/Vite/TS)   │       │     (Future Client)   │
                    │                       │       │                       │
                    │ - Operations Console  │       │ - Operations Console  │
                    │ - Live Signals Feed   │       │ - Live Signals Stream │
                    │ - Paper Trades & PnL  │       │ - Paper Trades & PnL  │
                    │ - Decision Journal    │       │ - Decision Audit Log  │
                    │ - Wallet Research     │       │ - Push Alerts / State │
                    └───────────────────────┘       └───────────────────────┘
```

---

## 2. Invariant Architectural Principles

### 2.1 The Bot Runs Independently
- The paper-trading monitor is designed to run continuously for **24 or 48 hours** as an autonomous background daemon.
- It operates completely independently of whether an operator has the web dashboard open, a browser tab focused, or a mobile client connected.
- If all client surfaces disconnect, the server daemon continues collecting read-only observations, scoring setups, executing paper trades ($5-$20 bounds), updating mark-to-market valuations, and recording audit decisions.

### 2.2 Client Surfaces are Read-Only Observers
- Neither the web app nor the future phone app contains trading algorithms, copy rules, or scoring formulas.
- Neither surface maintains separate trade state or simulates execution client-side.
- Both surfaces query identical backend endpoints (`/api/v1/*` and `/api/v1/mobile/*`), ensuring byte-level consistency between desktop and mobile operator views.

### 2.3 Strict Safety Boundary
The system is permanently **PAPER ONLY**:
- **NO private key storage**
- **NO wallet signing**
- **NO live order submission**
- **NO transaction broadcasting**
- **NO token approvals**
- **NO autonomous real-money execution**
- **NO client-side trade execution**

---

## 3. Unified Read-Only API Contracts

The backend exposes unified endpoints consumed interchangeably by Web and Mobile:

| Endpoint | Mobile Alias | Purpose | Consumed By |
|---|---|---|---|
| `GET /api/v1/status` | `/api/v1/mobile/status` | System health, PnL overview, active RuleSet | Web & Mobile |
| `GET /api/v1/monitor/status` | `/api/v1/mobile/monitor` | 24h/48h daemon observability contract & timestamps | Web & Mobile |
| `GET /api/v1/signals` | `/api/v1/mobile/signals` | Real-time detected trades & scored copy signals | Web & Mobile |
| `GET /api/v1/signals/:id` | `/api/v1/signals/:id` | Detailed forensic signal view & provenance | Web & Mobile |
| `GET /api/v1/paper-trades` | `/api/v1/mobile/pnl` | Active mark-to-market positions & realized PnL | Web & Mobile |
| `GET /api/v1/paper-trades/:id`| `/api/v1/paper-trades/:id` | Full paper trade lifecycle & entry/exit timestamps | Web & Mobile |
| `GET /api/v1/decisions` | `/api/v1/decisions` | Decision audit trail explaining WHY trades were copied/skipped | Web & Mobile |
| `GET /api/v1/wallets` | `/api/v1/mobile/wallets` | Vetted wallet leaderboard & consistency ranks | Web & Mobile |
| `GET /api/v1/research/rankings` | — | Multi-dimensional wallet research evaluations | Web Dashboard |
| `GET /api/v1/research/wallets/:addr` | — | Forensic wallet intelligence & trade timeline | Web Dashboard |
| `GET /api/v1/ingestion/status` | `/api/v1/mobile/ingestion`| Polymarket data ingestion telemetry & health | Web & Mobile |
| `GET /api/v1/mobile/alerts` | `/api/v1/mobile/alerts` | Urgent alerts (degraded ingestion, stale data) | Mobile Client |

---

## 4. 24h / 48h Observability Data Contract

To support long-running autonomous runs, `/api/v1/monitor/status` and `/api/v1/mobile/monitor` return the formal `ObservabilityStatus` payload:

```json
{
  "ingestionStatus": "HEALTHY",
  "marketDataFreshness": "FRESH",
  "walletMonitorStatus": "RUNNING",
  "paperEngineStatus": "ACTIVE",
  "executionMode": "PAPER ONLY",
  "lastPollAt": "2026-09-15T05:50:00.000Z",
  "activeTrackedWallets": 5,
  "totalDetectedTrades": 142,
  "totalPaperTradesCreated": 18,
  "observability": {
    "monitorProcessStatus": "RUNNING",
    "lastSuccessfulMonitoringCycle": "2026-09-15T05:50:00.000Z",
    "lastSuccessfulLeaderboardScan": "2026-09-15T04:30:00.000Z",
    "lastSuccessfulWalletScan": "2026-09-15T04:30:00.000Z",
    "lastSuccessfulTradeObservation": "2026-09-15T05:48:12.000Z",
    "lastSuccessfulPnlUpdate": "2026-09-15T05:00:00.000Z",
    "lastSuccessfulOutcomeReview": "2026-09-15T05:00:00.000Z",
    "lastError": null,
    "lastErrorTimestamp": null,
    "currentDataFreshness": "FRESH",
    "trackedWalletCount": 5,
    "currentPaperTradeCount": 18,
    "currentPaperPnl": {
      "unrealized": 14.50,
      "realized": 42.10,
      "total": 56.60
    },
    "ingestionProviderHealth": "OPERATIONAL",
    "currentRuleSetId": "conservative_v1",
    "executionMode": "PAPER ONLY"
  }
}
```

### Truthful State Guarantees
1. **Zero Synthetic State:** If the monitoring loop has not polled within 120 seconds, `monitorProcessStatus` transitions to `STALE`. It will never display `RUNNING` simply because an HTTP connection succeeded.
2. **Fail-Closed Reporting:** Ingestion errors, API timeouts, or market state cross errors are immediately surfaced as real structured error states, never swallowed or substituted with simulated success.
