# Project Architecture: Polymarket Copy-Trading System

## 1. System Architecture Overview

The system is structured as a two-tier, highly decoupled application in TypeScript:
- **Layer 1: The Autonomous Operator Engine**: Runs scheduled routines, data ingestion, wallet quality evaluation, real-time trade monitoring, deterministic decision scoring, paper order execution, hourly PnL mark-to-market calculations, retrospective outcome reviews, and self-improving rule adaptation.
- **Layer 2: The Observability & Analytics Web Application**: Built on Next.js, React, and Tailwind CSS. Deployable locally and on Vercel, providing real-time transparency into wallet quality, decision journals, simulated portfolios, and rule version histories.
- **Mobile Observability Extension**: Android client interface communicating via read-only REST endpoints for mobile monitoring and alerts.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Layer 2: Presentation & Observability                │
│  ┌─────────────────────────────────┐   ┌────────────────────────────┐  │
│  │     Next.js Web Dashboard       │   │ Android Observability App  │  │
│  │ (Overview, Rankings, Journal,   │   │ (Alerts, PnL, Status)      │  │
│  │  Performance, Rules, Reports)   │   │ [Strictly Read-Only]       │  │
│  └─────────────────┬───────────────┘   └─────────────┬──────────────┘  │
└────────────────────┼─────────────────────────────────┼─────────────────┘
                     │           Read-Only API         │
┌────────────────────┼─────────────────────────────────┼─────────────────┐
│                    ▼                                 ▼                 │
│                   Layer 1: Operator Core & Domain Engine               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Service Orchestration & CLI Runners:                             │  │
│  │ - scan:leaderboard     - monitor:trades    - paper:update-pnl     │  │
│  │ - scan:wallets         - score:trades      - review:outcomes     │  │
│  │ - update:rules         - report:daily      - test                │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Core Domain Engines:                                             │  │
│  │ ┌──────────────────────┐  ┌─────────────────┐  ┌──────────────┐  │  │
│  │ │ Wallet Quality Model │  │ Penalty Engine  │  │ Decision     │  │  │
│  │ │ & Consistency Scorer │  │ (One-Hit-Wonder)│  │ Journalizer  │  │  │
│  │ └──────────────────────┘  └─────────────────┘  └──────────────┘  │  │
│  │ ┌──────────────────────┐  ┌─────────────────┐  ┌──────────────┐  │  │
│  │ │ Paper Trading Engine │  │ Benchmark Cohort│  │ Rule Learning│  │  │
│  │ │ ($5 - $20 Simulator) │  │ Analyzer Engine │  │ & Adaptation │  │  │
│  │ └──────────────────────┘  └─────────────────┘  └──────────────┘  │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ Data Adapter Boundary:                                           │  │
│  │ [Leaderboard Adapter] [Market Depth Adapter] [Trade Feed Adapter]│  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Persistence & Data Layer                        │
│   SQLite Database (Drizzle ORM) | Durable Audit Tables | Fixtures      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
c:\BOTS\
├── src/
│   ├── adapters/                     # Upstream external service boundaries
│   │   ├── leaderboard.adapter.ts    # Polymarket & Bullpen leaderboard integration
│   │   ├── market.adapter.ts         # CLOB book & Gamma metadata integration
│   │   ├── trade.adapter.ts          # Public trade monitor & fill detector
│   │   └── resolution.adapter.ts     # Resolution & payout listener
│   ├── core/                         # Domain logic & trading engines
│   │   ├── wallet-scorer.ts          # 30d ROI, consistency, & quality scoring
│   │   ├── penalty-engine.ts         # One-hit-wonder & illiquidity penalty
│   │   ├── copyability.ts            # Latency, spread, and slippage evaluator
│   │   ├── trade-scorer.ts           # Multi-factor trade evaluation & decision
│   │   ├── paper-engine.ts           # $5-$20 simulated execution & lifecycle
│   │   ├── pnl-tracker.ts            # Hourly mark-to-market position updates
│   │   ├── outcome-reviewer.ts       # T+1h, 6h, 24h & resolution audits
│   │   ├── benchmark-engine.ts       # Bot vs Blind vs Watch vs Skip tracking
│   │   └── rule-updater.ts           # Autonomous paper rule adaptation
│   ├── db/                           # Persistence layer
│   │   ├── schema.ts                 # Drizzle/Prisma schema definition
│   │   ├── client.ts                 # Database client connection
│   │   └── migrations/               # Versioned migration files
│   ├── reporting/                    # Daily digests, summaries & alerts
│   │   ├── daily-report.ts           # End-of-day aggregator
│   │   └── telegram-notifier.ts      # Minimal alert dispatcher
│   ├── cli/                          # Command runners corresponding to PDF
│   │   ├── scan-leaderboard.ts
│   │   ├── scan-wallets.ts
│   │   ├── monitor-trades.ts
│   │   ├── score-trades.ts
│   │   ├── update-pnl.ts
│   │   ├── review-outcomes.ts
│   │   ├── update-rules.ts
│   │   └── generate-report.ts
│   └── app/                          # Next.js App Router UI
│       ├── page.tsx                  # Overview dashboard
│       ├── rankings/page.tsx         # Wallet rankings (Global & Category)
│       ├── wallet/[id]/page.tsx      # Wallet deep-dive profile
│       ├── signals/page.tsx          # Real-time trade signals
│       ├── paper-trades/page.tsx     # Simulated positions & hourly PnL
│       ├── journal/page.tsx          # Decision journal & reasoning
│       ├── performance/page.tsx      # Benchmarks, missed winners/avoided losers
│       ├── rules/page.tsx            # Rule versions & autonomous change history
│       ├── reports/page.tsx          # Daily & weekly report archive
│       └── api/                      # REST endpoints for UI & Android app
├── tests/                            # Comprehensive automated & adversarial test suite
│   ├── wallet-scoring.test.ts
│   ├── penalty-engine.test.ts
│   ├── trade-scoring.test.ts
│   ├── paper-trading.test.ts
│   ├── benchmark.test.ts
│   ├── rule-adaptation.test.ts
│   └── safety-invariants.test.ts
├── public/                           # Static assets
├── .env.example                      # Template for non-secret configuration
├── package.json                      # Scripts & dependencies
└── tsconfig.json                     # TypeScript strict configuration
```

---

## 3. Technology Stack Justification

1. **TypeScript / Node.js**: Ensures full type safety across domain entities, adapters, and UI components. Aligns with the PDF specification.
2. **Next.js (App Router) + React + Tailwind CSS**: Provides rapid server-side rendering, responsive table views, charts, and seamless local or Vercel deployment.
3. **SQLite with Drizzle ORM**:
   - Zero external operational dependencies for local development.
   - Ultra-fast transactional queries for trade events and PnL snapshots.
   - Drizzle provides lightweight SQL-like type safety with near-zero overhead.
4. **Adapter Pattern**: Strategy logic interacts only with internal interfaces (`LeaderboardAdapter`, `MarketDepthAdapter`), making the underlying Polymarket or third-party endpoint completely swappable without touching scoring or execution algorithms.

---

## 4. Mobile (Android) Integration Strategy

- The Android application acts as a remote **read-only observability portal**.
- Consumes JSON payloads from `/api/v1/mobile/...`:
  - `/api/v1/mobile/status` (bot health, active rule version, active tracked wallet count)
  - `/api/v1/mobile/pnl` (current total PnL, today's PnL, win rate)
  - `/api/v1/mobile/signals` (latest trade signals and decisions)
  - `/api/v1/mobile/alerts` (critical alerts: high-confidence signals, drawdowns, major rule updates)
- Strictly zero signing keys or trading execution capabilities are bundled in the mobile package.
