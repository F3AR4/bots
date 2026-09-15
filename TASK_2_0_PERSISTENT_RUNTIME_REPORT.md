# TASK 2.0: PERSISTENT PAPER-TRADING RUNTIME / DAEMON REPORT

**Workspace:** `C:\BOTS`  
**Execution Mode:** STRICTLY PAPER ONLY  
**Release Target:** Long-Running Unattended 24h / 48h Background Engine  
**Verification Date:** 2026-09-15  

---

## 1. Executive Summary

Task 2.0 transforms the Polymarket copy-trading research and paper-trading system into a persistent, autonomous server-side background runtime. The runtime operates independently of browser sessions and mobile clients, maintaining continuous read-only market ingestion, trade detection, deterministic trade scoring, paper-copy decisions, bounded paper-trade position sizing ($5.00 – $20.00), mark-to-market hourly PnL snapshots, retrospective outcome reviews, and structured telemetry persistence.

Both the modern React web dashboard and future mobile applications act strictly as concurrent observers and controllers of this single underlying backend engine.

---

## 2. Runtime Architecture & State Machine

```
                            ┌────────────────────────────────────────┐
                            │    SINGLETON RUNTIME MANAGER (DAEMON)  │
                            │                                        │
                            │  [Scheduler]                           │
                            │   ├── LeaderboardJob (5m)              │
                            │   ├── WalletScanJob (10m)              │
                            │   ├── TradeMonitorJob (30s)            │
                            │   ├── MarketSnapshotJob (1m)           │
                            │   ├── PnlJob (1h mark-to-market)       │
                            │   ├── OutcomeReviewJob (30m)           │
                            │   ├── DailyReportJob (24h digest)      │
                            │   └── HealthTelemetryJob (15s)         │
                            │                                        │
                            │  [SQLite Persistence: WAL Mode]        │
                            │   ├── runtime_state (singleton)        │
                            │   └── runtime_telemetry (snapshots)    │
                            └───────────────────┬────────────────────┘
                                                │
                                  Control & Observability API
                                  ┌─────────────┴─────────────┐
                                  │                           │
                     ┌────────────┴────────────┐ ┌────────────┴────────────┐
                     │  MODERN WEB DASHBOARD   │ │   FUTURE MOBILE CLIENT  │
                     │  - Observer Cockpit     │ │  - Observer App         │
                     │  - Start/Stop Lifecycle │ │  - Start/Stop Control   │
                     │  - Zero Execution Logic │ │  - Zero Execution Logic │
                     └─────────────────────────┘ └─────────────────────────┘
```

### Lifecycle State Machine

The runtime transitions deterministically through well-defined lifecycle states:

```
    [STOPPED] ──────── Start Request ────────► [STARTING]
        ▲                                          │
        │                                          │ Init & Startup Cycle
        │                                          ▼
    [STOPPING] ◄─────── Stop Request ───────── [RUNNING]
        │                                          │
        │ Clean Shutdown                           │ Unrecoverable Error
        └───────────────────────────────────────► [ERROR]
```

- **STOPPED:** Runtime is inactive. No interval timers or background workers are firing.
- **STARTING:** Startup sequence in progress (validates database, runs initial trade & telemetry poll, arms scheduler intervals).
- **RUNNING:** Active daemon execution loop; scheduled intervals executing deterministically without overlap.
- **STOPPING:** Shutdown sequence in progress (cancels timer handles, awaits in-flight database transactions up to `shutdownTimeoutMs`, captures final telemetry snapshot).
- **ERROR:** Fatal unrecoverable runtime condition captured with structured diagnostics.
- **STALE:** Truthful observability status when `RUNNING` but no cycle has completed within the configured freshness window (`staleThresholdSeconds`).

---

## 3. Real Start / Stop Control API & Contracts

The runtime control contract is exposed over HTTP with full idempotency:

| Route | Method | Description | Idempotency Guarantee |
|---|---|---|---|
| `/api/v1/control/start` | `POST` | Starts the autonomous runtime daemon | Returns `{ success: true, state: 'RUNNING' }` immediately if already running |
| `/api/v1/control/stop` | `POST` | Gracefully terminates runtime daemon | Returns `{ success: true, state: 'STOPPED' }` immediately if already stopped |
| `/api/v1/control/status` | `GET` | Returns full runtime state & telemetry | Reads state directly from memory / SQLite |
| `/api/v1/monitor/status` | `GET` | Integrated operations observability | Returns full `ObservabilityStatus` model |
| `/api/v1/mobile/control/start` | `POST` | Mobile client start endpoint | Maps to same `RuntimeManager` singleton |
| `/api/v1/mobile/control/stop` | `POST` | Mobile client stop endpoint | Maps to same `RuntimeManager` singleton |

---

## 4. Deterministic Scheduler & Modular Pipeline Jobs

All background jobs are scheduled with configurable operational intervals (`src/runtime/runtime-config.ts`), preventing overlapping execution through in-flight lock tracking:

1. **LeaderboardJob (`leaderboard` - Default: 5m):**  
   Discovers top Polymarket wallets across 30-day volume/PnL rankings using read-only API ingestion.
2. **WalletScanJob (`wallet_scan` - Default: 10m):**  
   Executes `WalletResearchPipeline` to score wallets across ROI, consistency, copyability, and one-hit-wonder penalties.
3. **TradeMonitorJob (`trade_monitor` - Default: 30s):**  
   Scans tracked wallets for new trade events, normalizes payloads, evaluates market liquidity and entry timing, records immutable `DecisionJournal` rows, and creates bounded ($5.00 – $20.00) `PaperTrade` positions.
4. **MarketSnapshotJob (`market_snapshot` - Default: 1m):**  
   Refreshes orderbook prices, bid-ask spreads, and liquidity metrics for markets with active open paper positions.
5. **PnlJob (`pnl_update` - Default: 1h):**  
   Marks open paper positions to market, updates unrealized/realized PnL, and records hourly `pnl_snapshots` with duplicate-hour protection.
6. **OutcomeReviewJob (`outcome_review` - Default: 30m):**  
   Evaluates positions against milestone horizons (`T+1h`, `T+6h`, `T+24h`, and `resolution`), storing immutable `OutcomeReview` records.
7. **DailyReportJob (`daily_report` - Default: 24h):**  
   Generates daily performance digests (`DailyReport`) with daily PnL, cumulative PnL, win rates, and decision breakdowns.
8. **HealthTelemetryJob (`health_telemetry` - Default: 15s):**  
   Snapshots operational telemetry into `runtime_telemetry` for historical auditing.

---

## 5. Idempotency, Restart Recovery & Fail-Closed Invariants

- **Idempotent Paper Trades:** SQLite unique constraints (`idx_decision_journals_trade_id_uniq`, `idx_paper_trades_observed_trade_uniq`, `idx_observed_trades_dedup`) prevent duplicate paper trades even across crashes and polling loops.
- **Fail-Closed Safety:** If market data is stale or missing, the trade scorer outputs `skip` with an explicit reason in `DecisionJournal`. Zero fake data or optimistic fills are fabricated.
- **Crash Recovery:** On restart, the daemon reads `runtime_state` from SQLite, recovers historical counts and timestamps, and resumes from current state without re-executing historical trades.
- **Graceful Shutdown:** Attached `SIGINT` and `SIGTERM` signal handlers ensure active database transactions finish cleanly before the process exits.

---

## 6. CLI Operational Commands

The project now supports unified CLI control commands mapped to the same runtime daemon:

```bash
# Start background daemon
npm run bot:start

# Gracefully stop daemon
npm run bot:stop

# Query live status & telemetry
npm run bot:status

# Run persistent daemon in foreground
npm run bot:run
```

---

## 7. Web Frontend Control Integration

- `src/client/components/ui/EngineLifecycleControl.tsx` is connected to `/api/v1/control/start` and `/api/v1/control/stop` via TanStack Query mutations (`useStartEngine`, `useStopEngine`).
- Buttons dynamically transition to `Starting...` / `Stopping...` with spinner states and are disabled during transitions to prevent duplicate actions.
- Displays real-time lifecycle badges (`STOPPED`, `STARTING`, `RUNNING`, `STOPPING`, `ERROR`, `STALE`).

---

## 8. Safety & Security Verification

A full codebase safety audit confirms:
- **Zero Private Keys:** No private keys, mnemonic phrases, or secret key generation exists.
- **Zero Live Execution:** No endpoints exist for order placement, signing, transaction broadcasting, or token approval.
- **Permanent Execution Boundary:** `ExecutionBoundary.assertPaperMode()` is enforced at all runtime and API boundaries.
- **Logging Sanitization:** `RuntimeLogger` and `SecretSanitizer` redact sensitive patterns from console logs and serialized payloads.

---

## 9. Verification & Build Results

All integration checks, unit tests, and builds pass cleanly:

| Check | Command | Result | Notes |
|---|---|---|---|
| **Test Suite** | `npm test` | **PASS (178/178 tests passed)** | 21 test suites passing, 0 failed, 0 skipped |
| **Backend Types** | `npm run typecheck` | **PASS (0 errors)** | `tsc --noEmit` verified |
| **Frontend Types** | `npm run typecheck:client` | **PASS (0 errors)** | `tsc -p tsconfig.client.json --noEmit` verified |
| **Backend Build** | `npm run build` | **PASS** | Distributable compiled to `dist/` |
| **Frontend Build** | `npm run build:client` | **PASS** | Vite client bundle compiled to `dist/client/` |

---

## 10. Genuine Operational Limitations

1. **Local SQLite Concurrency:** SQLite in WAL mode allows concurrent readers with serialized writes. In high-frequency multi-process architectures, ensure the daemon is run as a single worker process per database instance.
2. **Upstream Rate Limiting:** Public Polymarket endpoints enforce rate limits. Configured retry and backoff parameters (`providerRetryAttempts = 3`, `providerRetryBackoffMs = 2000`) handle transient 429s.

---

## 11. Conclusion

Task 2.0 is complete. The persistent paper-trading runtime daemon is ready for continuous 24h / 48h unattended operation with full web and mobile control parity, strict paper safety, and complete observability.
