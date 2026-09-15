# FRONTEND IMPLEMENTATION ROADMAP
**Polymarket Copy-Trading Research & Paper-Trading Foundation System**
**Document Version:** 1.0.0  
**Status:** Implementation Blueprint & Phased Roadmap (Post Task 1.8)  
**Execution Boundary:** STRICTLY PAPER TRADING ONLY — Read-Only Network Ingestion  
**Workspace:** `C:\BOTS`

---

## 1. Roadmap Overview & Strategic Objectives

This document translates the architectural assessment in `FRONTEND_ARCHITECTURE_UIUX_ASSESSMENT.md` into an actionable, phased implementation roadmap. 

### Core Tenets:
1. **Zero Downtime / Dual Running:** The existing vanilla JavaScript dashboard (`src/web/public/index.html`) must remain 100% operational throughout all implementation phases until the modern replacement passes strict parity and security verification.
2. **Strict Paper Trading Invariant:** Under no circumstances will live execution, private keys, wallet signers, transaction builders, or order placement endpoints be introduced.
3. **No Frontend Domain Logic:** Sizing ($5–$20 bounds), scoring algorithms, win rate calculations, slippage formulas, and mark-to-market PnL remain 100% server-side in the domain engine. The frontend is exclusively an analytical presentation and observability interface.
4. **Target Stack:** Vite 6 + React 19 + TypeScript 5.7 + Tailwind CSS v4 + TanStack Query v5 + Lucide Icons + Recharts.

---

## 2. Master Phase Schedule & Work Breakdown

```
+----------------------------------------------------------------------------------------------------+
|                                    PHASED MIGRATION TIMELINE                                       |
+----------------------------------------------------------------------------------------------------+
| Phase 0: Architecture & Assessment (Task 1.8)            [ COMPLETE ]                              |
| Phase 1: Vite + React + TypeScript Project Scaffold       [ Estimated: Milestone 1 ]                |
| Phase 2: Typed API Client & Data Layer (TanStack Query)  [ Estimated: Milestone 2 ]                |
| Phase 3: Application Shell, Navigation & Paper Banner    [ Estimated: Milestone 3 ]                |
| Phase 4: Command Center Overview Module                  [ Estimated: Milestone 4 ]                |
| Phase 5: Quantitative Research Module (Wallets & Copy)    [ Estimated: Milestone 5 ]                |
| Phase 6: Operations Module (Signals, Trades, Journal)     [ Estimated: Milestone 6 ]                |
| Phase 7: Performance & System Governance Module          [ Estimated: Milestone 7 ]                |
| Phase 8: Multi-Screen Responsive & Ergonomic Polish      [ Estimated: Milestone 8 ]                |
| Phase 9: Accessibility (a11y) & Automated E2E Hardening  [ Estimated: Milestone 9 ]                |
| Phase 10: Dual-Run Parity Signoff & Legacy Cutover        [ Final Milestone ]                       |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Detailed Phase Specifications

### Phase 0: Architecture & Design System Assessment
- **Status:** **COMPLETE** (Deliverable of Task 1.8).
- **Key Deliverables:**
  - `FRONTEND_ARCHITECTURE_UIUX_ASSESSMENT.md`
  - `FRONTEND_IMPLEMENTATION_ROADMAP.md`
- **Gate Criteria:** Comprehensive repository audit, stack recommendation with Next.js trade-off analysis, visual design specifications, component hierarchy, and safety boundary definition.

---

### Phase 1: Vite + React + TypeScript Project Scaffold
- **Objective:** Establish the modern build pipeline inside `C:\BOTS` without conflicting with existing backend server code.
- **Key Tasks:**
  1. Initialize `src/client/` directory for modern frontend source code.
  2. Configure `vite.config.ts` to output production static assets to `dist/client/`.
  3. Configure TypeScript (`tsconfig.client.json`) with path aliases (`@/` -> `src/client/`).
  4. Install core dependencies: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `tailwindcss@4`, `@tailwindcss/vite`, `clsx`, `tailwind-merge`.
  5. Configure development proxy in Vite to forward `/api/` requests to `http://localhost:3000`.
  6. Add development script `npm run dev:client` and build script `npm run build:client` to `package.json`.
- **Validation & Risk Gate:**
  - `npm run build:client` succeeds with zero errors.
  - Existing `npm test`, `npm run typecheck`, and `npm run web` remain 100% green and unaltered.
  - Existing `src/web/public/index.html` continues to be served at `http://localhost:3000`.

---

### Phase 2: Typed API Client & Data Layer (TanStack Query)
- **Objective:** Create a type-safe client-side data fetching layer that directly shares TypeScript domain definitions with the backend.
- **Key Tasks:**
  1. Install `@tanstack/react-query` and `@tanstack/react-query-devtools`.
  2. Create typed API response schemas in `src/client/types/api.ts` referencing `src/types/domain.ts`.
  3. Build centralized API fetch client (`src/client/api/client.ts`) with robust error handling and HTTP status mapping.
  4. Implement TanStack Query custom hooks:
     - `useSystemStatus()` (`/api/v1/status`)
     - `useIngestionHealth()` (`/api/v1/ingestion/status`)
     - `useWalletRankings()` (`/api/v1/research/rankings`)
     - `useWalletProfile(address)` (`/api/v1/wallets/:address`)
     - `useCopyabilitySummary()` (`/api/v1/research/copyability/summary`)
     - `useSignalsFeed()` (`/api/v1/signals`)
     - `usePaperTrades()` (`/api/v1/paper-trades`)
     - `useDecisionJournal()` (`/api/v1/decisions`)
     - `usePerformanceMetrics()` (`/api/v1/performance`)
     - `useActiveRuleSet()` (`/api/v1/rules`)
  5. Configure intelligent background refetch intervals (5s for signals/trades; 60s for rules/rankings).
- **Validation & Risk Gate:**
  - Unit tests verify query hook serialization and error boundary handling.
  - Zero TypeScript `any` types in the client data layer.

---

### Phase 3: Application Shell, Navigation & Paper-Only Safety Banner
- **Objective:** Construct the foundational visual layout, dark-theme design tokens, navigation sidebar, and prominent paper-mode safety indicators.
- **Key Tasks:**
  1. Implement Tailwind CSS v4 design tokens in `src/client/index.css` matching the analytical HSL color system defined in the assessment.
  2. Install `lucide-react` for technical iconography.
  3. Build core accessible layout components:
     - `PaperOnlyBanner`: Persistent top strip with strict safety notice (`STRICTLY PAPER TRADING ONLY`).
     - `TopBar`: Real-time clock, data mode pill (`LIVE READ-ONLY DATA`), system sync indicator.
     - `SidebarNav`: 4 primary modules (Overview, Research, Operations, Performance, System) with active route highlighting.
     - `AppShell`: Responsive container managing desktop sidebar and mobile drawer transitions.
  4. Set up client-side router (`wouter` or `@tanstack/react-router`) with deep linking support.
- **Validation & Risk Gate:**
  - Visual verification that `[PAPER ONLY]` banner is un-dismissible and visible on all screen sizes.
  - Keyboard navigation works across all sidebar menu items (`Tab`, `Enter`).

---

### Phase 4: Command Center Overview Module
- **Objective:** Build the executive summary dashboard providing instant operational awareness.
- **Key Tasks:**
  1. Build `KpiCard` component with tabular numeric formatting (`JetBrains Mono`).
  2. Implement Command Center grid:
     - Total Paper PnL (realized vs unrealized)
     - Win Rate with `INSUFFICIENT DATA` fallback handling
     - Active RuleSet identifier and conservative limits
     - Ingestion pipeline health status
  3. Build `LatestSignalCard` displaying real-time detected trade with color-coded decision badge.
  4. Build `QuickPaperPositions` preview table showing latest simulated trades.
- **Validation & Risk Gate:**
  - Dynamic KPI values match `/api/v1/status` and `/api/v1/performance` outputs identically to the legacy dashboard.

---

### Phase 5: Quantitative Research Module (Wallets & Copyability)
- **Objective:** Deliver deep-dive wallet intelligence and execution feasibility simulation views.
- **Key Tasks:**
  1. Build `WalletTable` with multi-column sorting (win rate, profit/loss, volume, composite score).
  2. Implement `FilterBar`: address search, category selection, minimum win rate slider.
  3. Implement `WalletProfileDrawer`: slide-over inspector displaying 30-day performance breakdown, category distribution, and trade history without leaving the table.
  4. Implement `CopyabilityDashboard`:
     - Summary KPI cards (Realistic Copyability Score, Average Fill Slippage bps, Book Depth Ratio).
     - Side-by-side evaluation table comparing observed execution price with realistic fill price.
     - Slippage breakdown chart by market category.
- **Validation & Risk Gate:**
  - Virtualized rendering smoothly displays 100+ candidate wallets with zero scroll stutter.
  - Highlighting correctly identifies low-sample-size wallets (<20 trades).

---

### Phase 6: Operations Module (Signals, Paper Trades, Decision Journal)
- **Objective:** Provide high-signal monitoring of incoming trades, simulated portfolio marks, and decision audit logs.
- **Key Tasks:**
  1. Build `SignalStreamTable`:
     - Color-coded decision badges (`PAPER_COPY`, `WATCHLIST`, `SKIP`).
     - Subtle 400ms flash on new signal arrival.
     - Detailed signal inspector modal.
  2. Build `PaperTradesTable`:
     - Grouped views: *Active Positions (Mark-to-Market)* vs *Closed/Resolved Trades*.
     - Interactive unrealized PnL column dynamically styled (green/red).
     - Paper trade details drawer showing execution price, current mark, and exit reason.
  3. Build `DecisionJournalView`:
     - Filterable audit trail by rejection rule (e.g., "Min Win Rate Failed", "Wide Spread").
     - Collapsible evaluation payload viewer.
- **Validation & Risk Gate:**
  - Automated test asserts that paper trades are explicitly labeled `[SIMULATED]` and contain zero live execution affordances.

---

### Phase 7: Performance & System Governance Module
- **Objective:** Visualize benchmark cohort comparisons, RuleSet governance, and system telemetry.
- **Key Tasks:**
  1. Build `CumulativeEquityChart`:
     - Recharts line graph comparing Bot Paper Copy vs Blind Leaderboard Copy.
  2. Build `BenchmarkCohortTable`:
     - Side-by-side comparison of `paper_copy`, `blind_leaderboard`, `watchlist`, and `skipped`.
     - Metrics: Win Rate, Total PnL, Avoided Losers, Missed Winners, Bad Copies.
  3. Build `RuleSetViewer`:
     - Interactive parameter inspection with tooltips detailing provenance from the initial strategy specification.
     - Rule change timeline component.
  4. Build `IngestionTelemetryView`:
     - Real-time upstream Polymarket API latency ping.
     - Recent scan history and error logs.
- **Validation & Risk Gate:**
  - Verified cohort metrics match `/api/v1/performance` domain calculation exactly.

---

### Phase 8: Multi-Screen Responsive & Ergonomic Polish
- **Objective:** Optimize interface ergonomics across desktop, laptop, tablet, and mobile browsers.
- **Key Tasks:**
  1. Implement collapsible sidebar rail for laptop and tablet viewports.
  2. Build mobile-optimized stacked metric cards for small screens (<768px).
  3. Add bottom navigation bar for mobile thumb navigation.
  4. Implement keyboard shortcuts (`/` to search, `Esc` to close drawers, `1-5` for module navigation).
- **Validation & Risk Gate:**
  - Flawless visual rendering and interaction on viewports ranging from 375px (iPhone) to 3840px (4K).

---

### Phase 9: Accessibility (a11y) & Automated E2E Hardening
- **Objective:** Achieve full WCAG 2.1 Level AA compliance and establish comprehensive automated UI test coverage.
- **Key Tasks:**
  1. Conduct automated Axe Core accessibility scans on all views.
  2. Audit color-contrast ratios, focus rings, ARIA labels, and table header scopes.
  3. Author Playwright end-to-end test suite:
     - Full navigation flow through all 4 modules.
     - Drawer interaction and deep-linking verification.
     - Filter and sorting persistence across page navigation.
     - **Security Invariant Suite:** Verify total absence of private key fields, order buttons, or live trading controls.
- **Validation & Risk Gate:**
  - 100% passing Playwright smoke tests.
  - Zero critical or serious accessibility violations.

---

### Phase 10: Dual-Run Parity Signoff & Legacy Cutover
- **Objective:** Verify absolute functional parity between modern and legacy dashboards, followed by seamless cutover.
- **Key Tasks:**
  1. Run legacy dashboard (`src/web/public/index.html`) and modern dashboard side-by-side on separate test ports.
  2. Verify numerical parity across all 27 API endpoints and rendered views.
  3. Configure `src/web/server.ts` to serve the modern build from `dist/client/` by default.
  4. Rename legacy dashboard to `src/web/public/index.legacy.html` as an emergency fallback.
  5. Verify that `npm run web` starts the modern workstation effortlessly.
- **Validation & Final Acceptance:**
  - Formal signoff confirming parity, performance, safety, and zero regression of backend tests.

---

## 4. Rollback & Contingency Plan

If any critical defect or performance issue is detected during or after deployment:
1. **Instant Fallback:** Set environment variable `SERVE_LEGACY_DASHBOARD=true` in `.env` or startup command.
2. **Server Logic:** `src/web/server.ts` will check this flag and immediately route incoming requests to `src/web/public/index.legacy.html`.
3. **Recovery Time Objective (RTO):** < 5 seconds (single process restart).

---

## 5. Explicitly Deferred Capabilities

The following capabilities are excluded from the frontend roadmap and remain scheduled for future backend-focused tasks:
- **Task 2.0:** Autonomous multi-wallet trade detection daemon loop.
- **Task 2.1:** Statistical parameter calibration and backtesting automation.
- **Live Trading Capabilities:** Strictly outside the scope of the research system.

---
*Roadmap authored for `C:\BOTS` in compliance with Task 1.8 specifications.*
