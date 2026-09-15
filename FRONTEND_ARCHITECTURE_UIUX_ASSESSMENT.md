# FRONTEND ARCHITECTURE & UI/UX REDESIGN ASSESSMENT
**Polymarket Copy-Trading Research & Paper-Trading Foundation System**
**Document Version:** 1.0.0  
**Status:** Architecture Blueprint & Assessment Only (Task 1.8)  
**Execution Boundary:** STRICTLY PAPER TRADING ONLY — Read-Only Network Ingestion  
**Workspace:** `C:\BOTS`

---

## 1. Executive Summary

This document provides a production-grade architectural assessment, user-experience audit, and technology blueprint for modernizing the frontend of the Polymarket Copy-Trading Research & Paper-Trading System (`C:\BOTS`). 

Following the successful completion and verification of Task 1.7, the system possesses a fully operational, integrated paper-trading pipeline:
1. Read-only market data and trader activity are ingested from public Polymarket endpoints into a normalized SQLite repository (`data/copy_trading.db`).
2. 30-day statistical wallet profiling computes win rates, profit-loss ratios, trade frequencies, and category concentration.
3. Realistic copyability simulation filters out uncopyable anomalies (evaluating liquidity depth, bid-ask spread slippage, and execution latency thresholds).
4. Real-time detection flags incoming trades, scores them against active rule sets ($5–$20 conservative sizing), and opens paper-trade positions with continuous mark-to-market PnL tracking and benchmark cohort comparison.
5. A single-process Node.js HTTP server (`src/web/server.ts`) serves 27 read-only REST endpoints alongside a monolithic vanilla HTML5/CSS3/ES6 single-page dashboard (`src/web/public/index.html`).

### Key Verdict
While the current vanilla JavaScript dashboard is functionally complete, bug-free, and remarkably lightweight (121 KB, 0 npm dependencies, <15ms initial paint), it suffers from architectural limitations that will impede future iteration:
- A single 2,292-line file containing intertwined CSS, HTML markup, DOM-manipulation logic, and raw fetch calls.
- Lack of compile-time TypeScript type safety between API response payloads and rendering code.
- Imperative string concatenation for HTML tables and cards (`innerHTML`), introducing maintenance friction and layout fragility.
- Tab-based navigation with no browser URL history, deep linking, or persistent filter state.
- No declarative state management, caching, or automatic background re-validation.

### Recommended Direction
We recommend adopting a **Vite + React 19 + TypeScript + Tailwind CSS v4 + TanStack Query + Lucide Icons + Recharts / Lightweight Charts** architecture. 

Next.js is **explicitly not recommended**: introducing Next.js would duplicate the Node.js server layer, introduce needless server-action/SSR complexity, and complicate hosting for an application that runs as a dedicated local quantitative operator station backed by a high-performance local SQLite database.

**Safety Invariant:** All changes assessed herein preserve the invariant: **STRICTLY PAPER ONLY**. No private keys, wallet signers, transaction builders, or write-capable order endpoints are introduced. Strategy calculation, scoring, and sizing remain 100% server-side.

---

## 2. Current Frontend Audit

### A. Current Frontend Architecture
The current frontend is implemented as a single, standalone static HTML file:
- **Location:** `src/web/public/index.html` (2,292 lines, 121,359 bytes).
- **Structure:** Monolithic file combining `<style>` (lines 10–615), HTML structure (lines 616–1235), and `<script>` application logic (lines 1236–2291).
- **Dependencies:** Google Fonts CDN (`Outfit`, `JetBrains Mono`). Zero external JavaScript libraries, frameworks, or CSS preprocessors.
- **Rendering Model:** Client-side imperative DOM manipulation via `document.getElementById`, `innerHTML` string interpolation, and manual template generation.

### B. Current Backend / API Architecture
- **Server:** Node.js native `http.createServer` in `src/web/server.ts` (628 lines).
- **Port:** Default `3000` (configurable via `process.env.PORT`).
- **Database Access:** Direct synchronous Better-SQLite3 connection via singleton `getDatabaseManager()` and 11 strongly typed repository classes.
- **Endpoint Structure:** Pure JSON REST API with 27 `GET` endpoints partitioned across `/api/v1/` and `/api/v1/mobile/`.
- **Write Operations:** None. There are zero `POST`, `PUT`, `PATCH`, or `DELETE` HTTP route handlers. All database mutations occur through background CLI runner commands (`src/cli/runner.ts`).
- **Static File Serving:** Built-in static fallback that resolves `index.html` for root or SPA routing with correct MIME types.

### C. API Contract Surface Available to the Frontend
The server exposes 27 endpoints:
- System & Monitoring: `/api/v1/status`, `/api/v1/monitor/status`, `/api/v1/ingestion/status`
- Wallets & Leaderboard: `/api/v1/wallets`, `/api/v1/wallets/:address`, `/api/v1/research/rankings`
- Copyability & Research: `/api/v1/research/copyability/summary`, `/api/v1/research/copyability/evaluations`, `/api/v1/research/copyability/evaluations/:id`, `/api/v1/research/copyability/wallets`, `/api/v1/research/copyability/categories`, `/api/v1/research/copyability/latency`
- Signals & Trade Monitoring: `/api/v1/signals/latest`, `/api/v1/signals`, `/api/v1/signals/:id`
- Paper Trades & Mark-to-Market: `/api/v1/paper-trades`, `/api/v1/paper-trades/:id`
- Decision Journal: `/api/v1/decisions`
- Performance & Cohort Benchmarks: `/api/v1/performance`
- Rules & Governance: `/api/v1/rules`
- Reports: `/api/v1/reports`
- Mobile Companions: `/api/v1/mobile/status`, `/api/v1/mobile/signals`, `/api/v1/mobile/paper-trades`, `/api/v1/mobile/alerts`, `/api/v1/mobile/ingestion`

### D. Current State Management Approach
- **Global In-Memory State:** Ephemeral window variables (`currentRuleSet`, `allWalletsCache`, `allSignalsCache`).
- **Persistence:** None. Page refreshes reset all view state, filters, and active tab to `overview`.
- **Reactivity:** Ad-hoc manual re-renders. When a tab is switched via `switchTab(tabId)`, the corresponding loader function (e.g., `loadPerformanceData()`, `loadRankings()`) is invoked manually.
- **Synchronization:** Polling via `setInterval(pollStatus, 5000)` running continuously for the top-bar and overview KPIs.

### E. Current Data-Fetching Approach
- Native `fetch()` calls wrapped in imperative `async/await` functions.
- Error handling uses `try/catch` with `console.error` and basic inline text fallbacks (`<div class="empty-state">Failed to load data</div>`).
- No query deduplication, retry exponential backoff, request cancellation (AbortController), or payload caching.

### F. Current Chart / Table / Rendering Approach
- **Charts:** Zero canvas or SVG charting libraries. Charts are approximated using CSS flexbox bar percentages (`<div class="score-bar"><div class="score-fill" style="width: ${pct}%"></div></div>`) and CSS-styled progress bars.
- **Tables:** Raw HTML `<table>` strings constructed via JavaScript `map().join('')` and injected via `innerHTML`.
- **Virtualization:** None. Tables render all rows (up to 50–100 items) directly into the DOM.

### G. Current Responsive Behavior
- Implemented with CSS media queries (`@media (max-width: 1024px)` and `@media (max-width: 768px)`).
- Metric grids transition from 4 columns to 2 columns to 1 column.
- Navigation tabs wrap horizontally.
- Tables receive `overflow-x: auto` wrappers to allow horizontal scrolling on narrow screens.
- Mobile viewports experience high vertical length and crowded tabular data.

### H. Current Accessibility Posture
- Semantic headings (`<h1>`, `<h2>`) are partially present.
- Buttons lack `aria-label` and `aria-expanded` attributes on interactive tabs.
- Status indicators (e.g., green for track, amber for watch, red for ignore) rely heavily on color differentiation, although accompanying text badges ("TRACK", "WATCH", "IGNORE") mitigate total color blindness.
- Tables lack `scope="col"` attributes on `<th>` elements.
- No keyboard focus traps or `aria-modal` attributes on detail overlays.

### I. Current Error / Loading / Empty-State Behavior
- **Loading:** Simple animated CSS spinner `<div class="spinner"></div>` or placeholder text (`Loading...`).
- **Empty States:** Dedicated `<div class="empty-state">` containers explaining that CLI commands (e.g., `npm run monitor:trades`) must be executed to populate data.
- **Error States:** Fallback error text displayed inside tables or cards upon HTTP failure.

### J. Current Visual / Design-System Structure
- Dark-theme palette (`--bg-main: #0a0e17`, `--bg-surface: #111827`, `--bg-card: rgba(17, 24, 39, 0.85)`).
- Fonts: `Outfit` (sans-serif display/headings) and `JetBrains Mono` (tabular numbers, wallet addresses, currency values).
- High visual polish with glassmorphic cards (`backdrop-filter: blur(12px)`), subtle borders (`#1f293d`), and distinct safety banners.

### K. Current Performance Characteristics
- **Bundle Size:** 121 KB total HTML/CSS/JS payload. Zero npm client assets.
- **Time to First Byte (TTFB):** <5ms on localhost.
- **First Contentful Paint (FCP):** <30ms.
- **Memory Footprint:** <15 MB in Chrome/Edge.
- **Bottlenecks:** Large table updates cause full DOM node teardown and recreation due to `innerHTML` replacement.

### L. Current Testability
- Existing automated test suite has 124 tests (`npm test`) covering domain engines, repositories, CLI runners, and API HTTP routes (`tests/web-server.test.ts`).
- Zero automated UI/E2E tests (no Playwright, Cypress, or Vitest DOM tests). Testing the UI currently requires manual browser inspection.

### M. Current Deployment Model
- Self-contained Node.js process: `npm run web` starts `src/web/server.ts` via `tsx`.
- Production bundle: `npm run build` generates `dist/` and runs via `node dist/web/server.js`.
- All assets are served locally from disk; no external CDN or cloud hosting required.

---

## 3. Current Backend / API Boundary

A fundamental requirement of this quantitative paper-trading system is the strict architectural boundary between backend domain intelligence and frontend presentation.

```
+-----------------------------------------------------------------------------+
|                          BACKEND DOMAIN (C:\BOTS)                           |
|                                                                             |
|  [Polymarket Public Data] -> [Ingestion Engine] -> [SQLite (copy_trading.db)]|
|                                     |                                       |
|  [Wallet Intelligence] <------------+------------> [Realistic Copyability]  |
|  - 30d stats, win rate, PnL                        - Slippage, spread, book |
|                                                                             |
|  [Real-Time Monitor] --------------> [RuleSet Evaluator (Active RuleSet)]    |
|  - Ingestion poller                                - Sizing ($5-$20 bounds) |
|                                                    - Hard risk filters      |
|                                                             |               |
|  [Decision Journal] <---------------------------------------+               |
|  - paper_copy / watchlist / skip                            |               |
|                                                             v               |
|  [Paper Trade Execution] ----------> [Mark-to-Market PnL Engine]            |
|  - Position creation (DB only)      - Benchmark Cohort Comparison           |
|                                                                             |
|  [REST API Server (src/web/server.ts)]                                      |
|  - 27 Read-Only Endpoints                                                  |
|  - Strict PAPER-ONLY Assertions                                             |
+-----------------------------------------------------------------------------+
                                      |
                        HTTP GET JSON | (Read-Only)
                                      v
+-----------------------------------------------------------------------------+
|                         FRONTEND PRESENTATION LAYER                         |
|                                                                             |
|  - Operator Observability Console                                           |
|  - Real-Time KPI Visualization                                              |
|  - Multi-Dimensional Filtering, Sorting, and Search                        |
|  - Wallet Profile & Trade Forensics Inspector                               |
|  - Paper-Only Safety Verification & Freshness Badges                        |
|                                                                             |
|  * ABSOLUTE PROHIBITION:                                                    |
|    - NO strategy math or scoring formulas                                   |
|    - NO paper sizing calculations                                           |
|    - NO position state mutation                                             |
|    - NO private keys, signers, or order submission                          |
+-----------------------------------------------------------------------------+
```

### Invariants Maintained at the Boundary:
1. **Zero Client-Side Calculation:** The frontend receives pre-computed scores (`copyScore`, `compositeScore`), pre-calculated slippage, pre-computed mark-to-market PnL (`unrealizedPnl`, `realizedPnl`), and official benchmark cohort numbers.
2. **Immutable Strategy Governance:** RuleSet parameters are viewed and inspected in the UI, but RuleSet validation, activation, and enforcement are executed exclusively by `RuleSetRepository` and `RuleSetManager`.
3. **Read-Only Guarantee:** The web server strictly asserts `ExecutionBoundary.assertPaperMode()` upon initialization and only handles HTTP `GET` and `OPTIONS` requests.

---

## 4. Product UX Audit: 10 Existing Dashboard Views

| # | View | Primary Objective | Most Important Info | Current Density | Freshness & Provenance | Major Opportunities for Improvement |
|---|------|-------------------|---------------------|-----------------|------------------------|-------------------------------------|
| 1 | **Overview** | Executive summary of active operations, PnL, and latest signals. | Total Paper PnL, Win Rate, Active RuleSet, Ingestion Health, Latest Signal. | Medium | Top bar displays `PAPER ONLY` & `LIVE READ-ONLY DATA`; 5s polling. | Unify metric cards; replace static text cards with interactive micro-sparklines; link latest signals directly to paper-trade details. |
| 2 | **Wallet Rankings** | Identify and analyze top candidate wallets from leaderboard scans. | Composite Rank, 30d Win Rate, Profit/Loss, Trade Count, Category, Status. | High (Table) | Displays lookback period and scan date. No column sorting. | Add multi-column sorting (win rate, volume, score); wallet address search; slide-over drawer for deep-dive wallet forensics. |
| 3 | **Copyability Research** | Verify execution feasibility (slippage, latency, order book depth). | Realistic Copyability Score, Fill Slippage %, Book Depth Ratio, Latency Tier. | High (Cards + Table) | Shows simulated copy scenarios; distinguishes realistic fills from raw observed fills. | Add interactive slippage distribution histogram; filter by market category; display side-by-side comparison of raw vs realistic fill prices. |
| 4 | **Live Signals** | Real-time stream of detected wallet trades and copy evaluations. | Signal Action (`paper_copy`, `watchlist`, `skip`), Wallet, Market, Evaluated Score. | High (List/Table) | Timestamped detection; indicates source poller. | Live visual pulse for new signals; sound toggle; filter by decision type; quick inspect button. |
| 5 | **Paper Trades** | Monitor simulated open positions, price marks, and closed trade PnL. | Position Size ($), Entry Price, Current Price, Unrealized PnL, Exit Status. | High (Table) | Mark-to-market timestamps; explicit paper execution flag. | Group by Open vs Closed; color-coded PnL badges; interactive position duration indicator; export to CSV. |
| 6 | **Decision Journal** | Audit trail of every trade evaluation and why it was accepted or rejected. | Rejection/Acceptance Reason, RuleSet Version, Score Breakdown, Market Conditions. | High (Cards) | Shows evaluated timestamp and exact RuleSet ID. | Search by rejection rule (e.g., "Min Win Rate Failed"); filter by wallet; collapsible JSON payload viewer. |
| 7 | **Performance** | Evaluate trading bot performance against benchmark cohorts. | Bot PnL vs Blind Leaderboard Copy, Avoided Losers, Missed Winners, Win Rate. | High (Table + KPIs) | Clear distinction between realized outcomes and insufficient-data states. | Add cumulative equity curve chart; visual cohort comparison bar charts; breakdown by market category. |
| 8 | **Rules** | Inspect active governance parameters, risk filters, and sizing limits. | Min Wallet Score, Max Position Sizing ($20), Min Liquidity, Max Spread (5%). | Low (Key-Value Grid) | Shows active RuleSet hash, created timestamp, and version name. | Add rule version history comparison; highlight conservative paper safety bounds; parameter provenance tooltip explaining PDF source. |
| 9 | **Reports** | Review daily and weekly performance rollups and health summaries. | Daily Realized PnL, New Discovered Wallets, Trade Volume, Anomaly Flags. | Medium (Cards) | Date-stamped reports generated by CLI cron. | Calendar date-picker; visual diff between consecutive days; printable/exportable research brief. |
| 10 | **Ingestion** | Verify upstream Polymarket API connection, rate limits, and scan freshness. | API Status, Last Scan Time, Scanned Wallet Count, Error Logs, Market Snapshots. | Medium (Cards + Logs) | Age counter in seconds; degraded/operational status badge. | Real-time endpoint latency ping; detailed endpoint error categorization; visual pipeline cycle status graph. |

---

## 5. Frontend Stack Assessment

We evaluated four realistic implementation architectures against 20 quantitative and qualitative dimensions.

| Evaluation Criterion | Option A: Vanilla HTML/JS (Current) | Option B: React 19 + TypeScript + Vite (Recommended) | Option C: Next.js + React + TS (App Router) | Option D: SvelteKit / TanStack Start |
|----------------------|-------------------------------------|-----------------------------------------------------|---------------------------------------------|---------------------------------------|
| **Maintainability** | Poor (2.3k lines monolithic file) | Excellent (modular component hierarchy) | Good (opinionated file conventions) | Good (modular components) |
| **Component Reuse** | None (string concatenation) | High (shadcn/ui, headless primitives) | High (React components) | High (Svelte components) |
| **Type Safety** | None (runtime duck typing) | Strict (shares domain types with backend) | Strict (shares domain types) | Strict (shares domain types) |
| **Data Fetching** | Imperative `fetch` | Declarative TanStack Query (caching/retry) | React Server Components / SWR | TanStack Query / Loaders |
| **Routing & Deep Linking**| None (in-memory tab switching) | Clean client-side SPA routing (TanStack Router/wouter)| File-system routing with SSR | File-system routing |
| **State Management** | Global window variables | Zustand + React Context + URL search params | React Context + URL search params | Svelte Stores / Signals |
| **Data Visualization** | Basic CSS bars | Recharts / Lightweight Charts / D3 | Recharts / Chart.js | LayerChart / D3 |
| **Accessibility (a11y)**| Manual, error-prone | High (Radix UI / Headless UI primitives) | High (Radix UI primitives) | High (Melt UI) |
| **Responsive Design** | Custom CSS media queries | Tailwind CSS v4 responsive utilities | Tailwind CSS responsive utilities | Tailwind CSS responsive utilities |
| **Testing** | Difficult (requires full browser) | Unit (Vitest) + Component (RTL) + E2E (Playwright) | Jest/Vitest + Playwright | Vitest + Playwright |
| **Developer Velocity** | Slow for complex interactions | High (rich ecosystem, instant HMR) | Moderate (Next.js compilation overhead) | High |
| **Bundle / Runtime Complexity**| Minimal (121 KB HTML) | Low (~180 KB gzipped SPA bundle) | Heavy (multi-MB runtime, Node SSR engine) | Low (~140 KB gzipped bundle) |
| **Deployment Complexity**| Trivial (served as static file) | Trivial (built to `dist/`, served by existing Node server) | High (requires separate Node Next.js daemon) | Moderate |
| **Node Backend Compatibility**| 100% native | 100% native (served from `src/web/server.ts`) | Duplicative (two competing Node servers) | Duplicative or requires static export |
| **Migration Risk** | Zero (already built) | Low (can run side-by-side during migration) | High (restructuring API & SSR boundaries) | Medium |
| **Rollback Strategy** | Instant | Instant (toggle static asset directory) | Moderate | Instant |
| **Operator Workstation Suitability**| Moderate (functional but basic) | Outstanding (density, speed, drawers, shortcuts) | Good | Good |
| **Future Scale** | Poor (high technical debt) | Excellent (scales to complex analytics) | Overkill for local research workstation | Good |
| **Paper-Only Safety Preservation**| Maintained | Maintained (zero write capabilities) | Maintained | Maintained |

---

## 6. Recommended Stack & Architectural Rationale

### Recommendation: React 19 + TypeScript + Vite + Tailwind CSS v4
We strongly recommend **Option B (Vite + React 19 + TypeScript)**.

#### Why Not Next.js?
Next.js is a premier framework for public-facing consumer web applications, e-commerce, and high-SEO websites. However, for an internal quantitative research workstation and paper-trading command center, Next.js introduces significant liabilities:
1. **Redundant Server Layer:** The system already possesses a rock-solid, production-tested Node.js backend (`src/web/server.ts`) with direct Better-SQLite3 synchronous bindings. Next.js would introduce a secondary Node.js server, creating confusion over where API routes, caching, and background workers reside.
2. **SSR Inutility:** This dashboard is an authenticated, local operator workstation. Search Engine Optimization (SEO), OpenGraph social cards, and initial HTML scraping are completely irrelevant. Client-side rendering (CSR) with Vite provides sub-second HMR and instant local responses.
3. **Operational Simplicity:** A Vite build produces static HTML, CSS, and JS files placed in `dist/client/`. The existing Node.js server (`src/web/server.ts`) can serve these static assets directly from a single port (`3000`), preserving the single-command startup (`npm run web`).

#### Recommended Libraries:
- **Build Tool:** Vite 6 (ultra-fast compilation, zero-overhead ES modules).
- **Core:** React 19 + TypeScript 5.7 (full type sharing with `src/types/domain.ts`).
- **Styling:** Tailwind CSS v4 (analytical design system tokens, CSS variables, utility-first consistency).
- **Icons:** `lucide-react` (clean, technical, financial and operational iconography).
- **Component Primitives:** `@radix-ui/react-*` (uncompromising accessibility for dialogs, dropdowns, tabs, tooltips).
- **State & Server Cache:** `@tanstack/react-query` (automatic background revalidation, query deduplication, loading/error states) + `zustand` (client-side UI filters, active drawer state).
- **Routing:** `wouter` or `@tanstack/react-router` (lightweight, hash or HTML5 history routing with URL-addressable filters).
- **Charts:** `recharts` (declarative, SVG-based, highly responsive quantitative charting) or `lightweight-charts` (TradingView's high-performance canvas engine for financial price/equity curves).

---

## 7. Proposed Frontend Information Architecture

Rather than a flat 10-tab bar that overflows on laptop viewports, the application should be structured into **four primary functional modules** with URL-addressable sub-routes, persistent global filters, and slide-over inspector drawers.

```
+----------------------------------------------------------------------------------------------------+
| TOP BAR: [PAPER TRADING ONLY] | Polymarket Research Console | Data Mode: LIVE READ-ONLY | 10:44:53 |
+----------------------------------------------------------------------------------------------------+
| SIDEBAR NAV      | MAIN WORKSPACE CONTENT AREA                                                     |
|                  |                                                                                 |
| 1. OVERVIEW      | +-----------------------------------------------------------------------------+ |
|    - Command     | | COMMAND CENTER KPI STRIP (P&L | Win Rate | Active Wallets | Ingestion Health)| |
|      Center      | +-----------------------------------------------------------------------------+ |
|                  |                                                                                 |
| 2. RESEARCH      | [Active Route: /research/wallets]                                               |
|    - Wallets     | FILTER BAR: [Search Address...] [Category: All v] [Min Win Rate: 55% v]         |
|    - Copyability | +-----------------------------------------------------------------------------+ |
|                  | | RANK | WALLET      | 30D WIN % | 30D PNL   | COPY SCORE | ACTION             | |
| 3. OPERATIONS    | | #1   | 0x8d12...9a | 68.4%     | +$14,210  | 88.5       | [Inspect Drawer]   | |
|    - Live Signals| | #2   | 0x3f4a...12 | 61.2%     | +$8,940   | 84.1       | [Inspect Drawer]   | |
|    - Paper Trades| +-----------------------------------------------------------------------------+ |
|    - Journal     |                                                                                 |
|                  | +------------------------------------+ +--------------------------------------+ |
| 4. PERFORMANCE   | | CUMULATIVE PAPER PNL CURVE         | | COHORT COMPARISON SUMMARY            | |
|    - Analytics   | | [Recharts Equity Chart]            | | Bot Paper: +$45.80 (64.2%)           | |
|    - Reports     | |                                    | | Blind Copy: -$112.40 (41.0%)         | |
|                  | +------------------------------------+ +--------------------------------------+ |
| 5. SYSTEM        |                                                                                 |
|    - Rules       | [DRAWER OVERLAY - When Wallet or Trade is clicked]                             |
|    - Ingestion   | Detailed 30d Trade History | Liquidity Depth | Rejection Reason Forensics       |
+----------------------------------------------------------------------------------------------------+
```

### Route & Hierarchy Mapping:

1. **Command Center (`/overview`):**
   - High-signal executive dashboard displaying the core operational vitals.
   - Quick-action jump links to degraded subsystems or newly flagged paper trades.

2. **Research Module (`/research`):**
   - `/research/wallets`: Comprehensive wallet intelligence leaderboard with multi-column sorting and filtering.
   - `/research/copyability`: Execution feasibility simulation, slippage metrics, order book depth distributions, and latency curves.
   - `/research/wallets/:address`: Deep-dive wallet profile (opened via URL or slide-over drawer).

3. **Operations Module (`/operations`):**
   - `/operations/signals`: Live detection feed with real-time audio/visual pulse for new signals.
   - `/operations/trades`: Paper-trade positions table (separated into *Active Mark-to-Market* and *Closed/Resolved*).
   - `/operations/journal`: Decision audit trail detailing why trades were executed (`paper_copy`) or rejected (`watchlist`, `skip`).

4. **Performance & Analytics Module (`/performance`):**
   - `/performance/benchmarks`: Benchmark cohort comparison (Bot vs Blind Leaderboard vs Watchlist vs Skipped).
   - `/performance/reports`: Daily and weekly historical research digests.

5. **System Governance Module (`/system`):**
   - `/system/rules`: Active RuleSet parameters, sizing limits ($5–$20 bounds), and parameter provenance audit.
   - `/system/ingestion`: Polymarket API connection health, poller status, latency indicators, and error telemetry.

---

## 8. Visual Design System Proposal

The visual design language must communicate the rigor of a quantitative institutional research terminal: high signal-to-noise ratio, meticulous typographic hierarchy, dark-theme ergonomics for extended observation sessions, and absolute clarity regarding paper-mode safety.

### A. Color Palette (Strict HSL Calibration)

```css
:root {
  /* Surface & Background Hierarchy */
  --bg-app:        hsl(222, 47%, 7%);    /* #0a0e17 - Deep obsidian */
  --bg-surface:    hsl(222, 40%, 10%);   /* #101726 - Primary surface */
  --bg-card:       hsl(222, 38%, 13%);   /* #162032 - Elevated cards */
  --bg-card-hover: hsl(222, 38%, 16%);   /* Interactive card hover */
  
  /* Borders & Dividers */
  --border-subtle: hsl(222, 25%, 20%);   /* Hairline borders */
  --border-strong: hsl(222, 25%, 32%);   /* Focused/active borders */

  /* Typography */
  --text-primary:   hsl(210, 40%, 98%);  /* Pristine white */
  --text-secondary: hsl(215, 20%, 70%);  /* Muted slate */
  --text-muted:     hsl(215, 16%, 47%);  /* Supporting annotations */

  /* Quantitative Status & Provenance (Always paired with text) */
  --pnl-positive:   hsl(158, 64%, 52%);  /* Emerald Green */
  --pnl-negative:   hsl(354, 70%, 54%);  /* Coral Red */
  --status-track:   hsl(160, 84%, 39%);  /* Verification Green */
  --status-watch:   hsl(38, 92%, 50%);   /* Amber Warning */
  --status-ignore:  hsl(350, 89%, 60%);  /* Crimson Muted */
  
  /* Paper Trading Brand Identity */
  --paper-purple:   hsl(265, 89%, 66%);  /* Royal Paper Indigo */
  --paper-glow:     hsla(265, 89%, 66%, 0.15);
}
```

### B. Typography Hierarchy
- **UI & Display:** Inter or Outfit (clean, modern sans-serif with high x-height for readability).
- **Tabular & Quantitative:** `JetBrains Mono` or `Fira Code`. Every dollar value, percentage, wallet address, hash, and timestamp must use tabular numerical lining (`font-variant-numeric: tabular-nums`).

### C. Layout Grid & Card Strategy
- Fixed 12-column responsive grid with 16px/24px gutters.
- Visual container hierarchy: App Shell -> Module Workspace -> Section Card -> Compact Data Row.
- High-density spacing tokens (4px, 8px, 12px, 16px, 24px).

### D. Badges & Provenance Indicators
Every datum on screen must communicate its pedigree:
- **`[PAPER ONLY]`:** Fixed high-contrast badge in header; purple border on all simulated trade cards.
- **`[LIVE READ-ONLY]`:** Green dot + label indicating live Polymarket public API telemetry.
- **`[DEMO / FIXTURE]`:** Amber striped badge indicating local synthetic testing data.
- **`[INSUFFICIENT DATA]`:** Neutral gray pill indicating sample size is too small to calculate statistical significance.

---

## 9. Motion & Interaction Assessment

### Motion Philosophy
Motion in a quantitative terminal must be **subordinate to information comprehension**. Gratuitous 3D transforms, bouncy springs, and decorative page transitions are strictly prohibited.

### Justified Motion Applications:
1. **New Signal Arrival:** A subtle 400ms background highlight fade (`hsla(160, 84%, 39%, 0.2) -> transparent`) on a table row when a new trade is detected by the poller.
2. **Slide-Over Inspector Drawer:** Smooth 250ms ease-out slide from the right screen edge when inspecting a wallet or trade record, preserving context without leaving the active table.
3. **Data Refresh Pulse:** A discreet 1.5s rotational sweep on the top-bar sync icon during background HTTP polling.
4. **Accordion & Collapsible Filters:** Crisp 150ms height expansion when revealing advanced multi-factor filters.

### Prohibited Motion:
- Staggered card entry animations that delay data scanning.
- Continuous looped animations (except subtle loading spinners).
- Motion that shifts layout coordinates under an operator's cursor.
- Respect `prefers-reduced-motion: reduce` by disabling all non-instantaneous transitions.

---

## 10. Data Visualization Assessment

Quantitative operators comprehend distributions, slippage penalties, and performance equity far faster through targeted visualizations than dense tables alone.

### Required Visualizations:
1. **Cumulative Paper Equity Curve (Line Chart):**
   - Mark-to-market daily and trade-by-trade cumulative PnL.
   - Dual-series: Bot Paper Portfolio vs Blind Leaderboard Copy benchmark.
2. **Score Composition Breakdown (Stacked Horizontal Bar):**
   - Visualizing how a candidate wallet achieved its score: Win Rate Weight (40%) + Profit Factor (25%) + Trade Activity (20%) + Consistency (15%).
3. **Slippage & Depth Scatter Plot:**
   - Trade size ($) on X-axis vs Fill Slippage (bps) on Y-axis to clearly reveal liquidity decay.
4. **Cohort Win Rate Comparison (Grouped Bar Chart):**
   - Side-by-side win rate and average PnL for `paper_copy`, `blind_leaderboard`, `watchlist`, and `skipped`.
5. **Ingestion Latency Histogram:**
   - Distribution of trade detection lag (seconds from Polymarket blockchain confirmation to local paper signal creation).

### Charting Library Recommendation:
- **Primary:** `recharts` (SVG, React-native, accessible DOM elements, customizable tooltips, zero canvas overhead).
- **Alternative for High-Frequency Price Ticks:** `lightweight-charts` by TradingView (HTML5 Canvas engine, exceptional for zoom/pan time-series).

---

## 11. Design System & Component Architecture

We propose a modular component hierarchy organized into domain-agnostic UI primitives and domain-specific financial components:

```
src/client/
|-- components/
|   |-- ui/                        # Low-level accessible primitives (Radix + Tailwind)
|   |   |-- Button.tsx
|   |   |-- Badge.tsx
|   |   |-- Card.tsx
|   |   |-- DataTable.tsx
|   |   |-- Dialog.tsx
|   |   |-- Drawer.tsx
|   |   |-- Input.tsx
|   |   |-- Select.tsx
|   |   |-- Tooltip.tsx
|   |   +-- Tabs.tsx
|   |
|   |-- layout/                    # Global workstation shell
|   |   |-- AppShell.tsx
|   |   |-- Sidebar.tsx
|   |   |-- TopBar.tsx
|   |   +-- PaperOnlyBanner.tsx
|   |
|   |-- domain/                    # Copy-trading research components
|   |   |-- DataFreshnessBadge.tsx
|   |   |-- ProvenanceBadge.tsx
|   |   |-- HealthIndicator.tsx
|   |   |-- KpiCard.tsx
|   |   |-- ScoreBreakdownBar.tsx
|   |   |-- WalletTableRow.tsx
|   |   |-- WalletProfileDrawer.tsx
|   |   |-- TradeTableRow.tsx
|   |   |-- SignalCard.tsx
|   |   |-- DecisionJournalCard.tsx
|   |   |-- PaperTradePositionCard.tsx
|   |   |-- EquityCurveChart.tsx
|   |   |-- CohortComparisonTable.tsx
|   |   |-- RuleSetViewer.tsx
|   |   +-- IngestionHealthPanel.tsx
|   |
|   +-- feedback/                  # State communication
|       |-- EmptyState.tsx
|       |-- ErrorState.tsx
|       +-- TableSkeleton.tsx
```

---

## 12. Responsive & Multi-Screen Strategy

The workstation must adapt fluidly between large multi-monitor research setups (4K/1440p), standard laptops (1080p), and mobile viewing (tablets & smartphones).

### Breakpoint Breakdown:
1. **Ultra-Wide & Desktop (>= 1440px):**
   - Dual-pane layout: Data tables occupy 65% width; detail inspection panel or real-time signal stream permanently docked on the right 35%.
2. **Standard Laptop (1024px – 1439px):**
   - Full-width tabular view; inspection panels transition to overlay slide-over drawers.
3. **Tablet (768px – 1023px):**
   - Sidebar collapses into an icon-only rail or top navigation bar.
   - Tables hide secondary columns (e.g., Raw TX Hash, Gas Estimate), retaining Primary Wallet, Win Rate, and Action buttons.
4. **Mobile (< 768px):**
   - Critical read-only observation mode.
   - Tables transform into stacked, touch-friendly metric cards.
   - Bottom navigation bar provides instant thumb access to Overview, Signals, Trades, and Ingestion Health.
   - Note: The dedicated Android companion app (`android/`) maintains its native Kotlin/Jetpack Compose architecture; this responsive web design ensures any mobile browser can access the operator console without friction.

---

## 13. Accessibility Strategy (a11y)

The research workstation will adhere to **WCAG 2.1 Level AA** standards:
1. **Non-Color-Dependent Signifiers:** Every status (Win/Loss, Track/Watch/Ignore, Operational/Degraded) must feature an accompanying text label and distinct icon (e.g., Checkmark, Alert Triangle, Minus Circle). Color alone never conveys state.
2. **Keyboard Navigability:** Full keyboard support across all tables and drawers (`Tab`, `Shift+Tab`, `Arrow` keys for grid navigation, `Esc` to dismiss slide-over drawers).
3. **Screen Reader Semantics:** Data tables utilize proper `<caption>`, `<thead scope="col">`, and `aria-sort` attributes on sortable column headers.
4. **Contrast Ratios:** All body text meets a minimum contrast ratio of 4.5:1 against the dark background; large numerals and headers exceed 7:1.
5. **Focus Management:** Visible, high-contrast focus rings (`outline: 2px solid var(--border-strong)`) on all interactive buttons, inputs, and row selectors.

---

## 14. Performance Strategy

A professional trading console must remain responsive even during rapid market updates and large historical datasets.

1. **Virtualization for Large Tables:** Integrate `@tanstack/react-virtual` for the Wallet Rankings and Historical Trades tables. This limits DOM nodes to only those visible in the viewport, ensuring 60fps scrolling across 10,000+ records.
2. **Intelligent Caching & Polling (TanStack Query):**
   - `/api/v1/status`: 5-second polling interval while window is focused; paused when backgrounded.
   - `/api/v1/rules`: Stale time of 10 minutes (rules change infrequently).
   - `/api/v1/research/rankings`: Stale time of 60 seconds.
3. **Bundle Optimization:** Route-based code splitting using React `lazy()` and `Suspense`. Heavy visualization libraries (`recharts`) are loaded asynchronously only when the user navigates to `/performance` or opens an equity chart.
4. **Zero Main-Thread Freezes:** Avoid heavy data manipulations on the UI thread; filtering and sorting of large arrays are memoized via `useMemo` or processed through Web Workers if datasets exceed 50,000 items.

---

## 15. API Consumption Map & Contract Inventory

The following table maps every existing GET endpoint to its proposed frontend view, data freshness expectations, and UI state requirements:

| Endpoint | Purpose | Current Consumer | Proposed Page/Component | Data Freshness | Loading State | Empty State | Error State | Provenance Required |
|---|---|---|---|---|---|---|---|---|
| `/api/v1/status` | System overview, active ruleset, PnL | Top bar & Overview | `TopBar` & `Overview/KpiStrip` | 5s Polling | Skeleton KPIs | "No Bot State" | Error Banner | Yes (`PAPER ONLY`) |
| `/api/v1/monitor/status` | Poller health & trade queue | Overview | `System/IngestionHealth` | 5s Polling | Pulse Spinner | "Poller Idle" | "Poller Offline" | Yes (Poller mode) |
| `/api/v1/ingestion/status` | Polymarket API & scan health | Ingestion tab | `System/IngestionHealth` | 10s Polling | Shimmer Card | "No Ingestions" | "API Degraded" | Yes (Live vs Demo) |
| `/api/v1/wallets` | Discovered candidate wallets | Rankings tab | `Research/WalletTable` | On-demand / 60s | Table Skeleton | "Run scan:wallets" | Retry Toast | Yes (Scan ID) |
| `/api/v1/wallets/:address` | Deep-dive 30d wallet stats | Wallet detail overlay | `WalletProfileDrawer` | On-demand | Drawer Skeleton | "Wallet Unknown" | Drawer Error | Yes (Lookback window)|
| `/api/v1/research/rankings` | Leaderboard composite scores | Rankings tab | `Research/Leaderboard` | On-demand / 60s | Table Skeleton | "No Rankings" | Retry Button | Yes (Scan provenance)|
| `/api/v1/research/copyability/summary` | Global realistic copy feasibility | Copyability tab | `Research/Copyability` | On-demand | Shimmer Cards | "No Evaluations" | Error Card | Yes (RuleSet hash) |
| `/api/v1/research/copyability/evaluations`| Individual trade copy feasibility | Copyability tab | `Research/CopyabilityTable` | On-demand | Table Skeleton | "No Scenarios" | Retry Button | Yes (Realistic vs Raw)|
| `/api/v1/research/copyability/evaluations/:id`| Single copyability scenario | Detail overlay | `CopyabilityModal` | On-demand | Modal Spinner | "Not Found" | Modal Error | Yes (Spread & Depth) |
| `/api/v1/research/copyability/wallets`| Wallet copyability aggregates | Copyability tab | `Research/Copyability` | On-demand | Table Skeleton | "No Wallets" | Retry Button | Yes |
| `/api/v1/research/copyability/categories`| Slippage by market category | Copyability tab | `Research/CategoryChart` | On-demand | Chart Skeleton | "No Categories" | Chart Error | Yes |
| `/api/v1/research/copyability/latency` | Execution latency breakdown | Copyability tab | `Research/LatencyHistogram`| On-demand | Chart Skeleton | "No Data" | Chart Error | Yes |
| `/api/v1/signals/latest` | Most recent detected trade signal | Overview tab | `Overview/LatestSignal` | 5s Polling | Card Shimmer | "No Live Signals"| Warning Card | Yes (Timestamp) |
| `/api/v1/signals` | Historical signal feed | Live Signals tab | `Operations/SignalStream` | 5s Polling | Table Skeleton | "Run monitor:trades"| Error Toast | Yes (Evaluated Rule) |
| `/api/v1/signals/:id` | Detailed signal forensics | Signal inspect | `SignalDetailDrawer` | On-demand | Drawer Skeleton | "Signal Missing" | Drawer Error | Yes (Input criteria) |
| `/api/v1/paper-trades` | Active & closed paper positions | Paper Trades tab | `Operations/PaperTrades` | 5s Polling | Table Skeleton | "No Paper Trades"| Retry Button | Yes (`PAPER ONLY`) |
| `/api/v1/paper-trades/:id` | Paper trade lifecycle & marks | Trade inspect | `PaperTradeDrawer` | On-demand | Drawer Skeleton | "Trade Missing" | Drawer Error | Yes (Mark history) |
| `/api/v1/decisions` | Audit journal of evaluations | Decision Journal | `Operations/DecisionJournal`| 10s Polling | Card Skeletons | "Run score:trades"| Retry Button | Yes (Reject reason) |
| `/api/v1/performance` | Bot PnL & benchmark cohorts | Performance tab | `Performance/Benchmark` | 10s Polling | Metric Skeletons| "Insufficient Data"| Error Banner | Yes (Realized only) |
| `/api/v1/rules` | Active RuleSet governance | Rules tab | `System/RuleSetViewer` | 60s Stale | Grid Skeleton | "No RuleSet Active"| Warning Card | Yes (RuleSet Hash) |
| `/api/v1/reports` | Daily & weekly research briefs | Reports tab | `Performance/Reports` | On-demand | Card Skeletons | "Run report:daily"| Retry Button | Yes (Generated time) |
| `/api/v1/mobile/*` (5 endpoints) | Compact mobile payloads | Android app | Android App Only | As needed | Mobile Shimmer | Mobile Fallback | Mobile Error | Yes |

#### Identified API Gaps for Future Backend Tasks:
1. **Server-Side Pagination & Filtering:** Currently, `/api/v1/wallets` and `/api/v1/signals` return fixed slices (e.g., top 100). As the SQLite database grows, adding `?limit=50&offset=0&sortBy=winRate` query parameters will improve performance.
2. **WebSocket / SSE Stream for Signals:** Replacing 5-second polling with a lightweight Server-Sent Events (SSE) stream (`/api/v1/events`) will reduce HTTP overhead and deliver instantaneous signal detection.

---

## 16. Phased Migration Strategy & Rollback Plan

To ensure continuous, uninterrupted research operations, the modernization will proceed through a non-destructive, phased rollout. The existing `index.html` dashboard will remain fully functional and untouched until the replacement is verified.

```
PHASE 0: Architecture & Design System (Task 1.8 - Completed)
   |
PHASE 1: Project Scaffold (Vite + React 19 + TypeScript in src/client/)
   |
PHASE 2: Shared Data Layer & API Hooks (TanStack Query + Typed Contracts)
   |
PHASE 3: Application Shell & Paper-Only Banner (TopBar, Nav, Status)
   |
PHASE 4: Overview Command Center (Real-time KPIs & Signal Cards)
   |
PHASE 5: Research Module (Wallets Leaderboard & Copyability Engine)
   |
PHASE 6: Operations Module (Live Signals, Paper Trades, Decision Journal)
   |
PHASE 7: Performance & Governance (Benchmark Cohorts, Rules, Reports, Ingestion)
   |
PHASE 8: Responsive Polish & Keyboard Navigation
   |
PHASE 9: Accessibility & End-to-End Test Suite Hardening
   |
PHASE 10: Dual-Verification Parity Signoff & Legacy Cutover
```

### Rollback Strategy:
- The existing `src/web/public/index.html` will be preserved as `src/web/public/index.legacy.html`.
- If any regression occurs during the modern rollout, a single environment variable (`USE_LEGACY_DASHBOARD=true`) or route switch in `src/web/server.ts` instantly reverts the server to serving the original vanilla dashboard with zero downtime.

---

## 17. Comprehensive Testing Strategy

The modernized frontend will incorporate four distinct testing layers without disturbing existing backend tests:

1. **Unit Tests (Vitest):**
   - Formatters: currency formatting, percentage math, address truncation, timestamp relative time calculations.
   - Domain invariants: verify that paper PnL calculations correctly handle null/insufficient-data states.
2. **Component Tests (React Testing Library):**
   - Test rendering of `ScoreBreakdownBar`, `DataFreshnessBadge`, and `PaperOnlyBanner`.
   - Ensure `EmptyState` renders CLI command instructions when arrays are empty.
   - Verify that rejection reasons in `DecisionJournalCard` display exact rule failure codes.
3. **Accessibility Audits (Axe Core):**
   - Automated accessibility sweeps testing color contrast, ARIA landmarks, and keyboard focus states.
4. **End-to-End Smoke Tests (Playwright):**
   - Verify navigation across all four modules.
   - Validate that opening the Wallet Profile drawer successfully fetches `/api/v1/wallets/:address`.
   - Verify that the `[PAPER TRADING ONLY]` safety banner is permanently visible across all viewports.
   - **Safety Invariant Test:** Assert that the DOM contains zero inputs for private keys, zero buttons containing "Buy", "Sell", or "Sign", and zero Web3 provider connection scripts.

---

## 18. Paper-Only Safety Requirements

The frontend architecture enforces strict safety guarantees to ensure it remains purely a research and simulation tool:

1. **Anti-Affordance Design:** The UI must never render elements that resemble an execution terminal for live capital (e.g., no order entry pads, no leverage sliders, no "Submit Order" buttons, no gas limit inputs).
2. **Permanent Safety Banner:** A persistent top-bar banner displaying:
   `EXECUTION: STRICTLY PAPER ONLY | NETWORK: READ-ONLY PUBLIC DATA | LIVE CAPITAL DISABLED`
3. **Color Coding Convention:**
   - Real money / live execution colors (such as flashing broker greens or trading terminal buttons) are avoided.
   - Paper trading positions are demarcated with distinctive lavender/indigo badges (`[SIMULATED PAPER TRADE]`).
4. **Architectural Immutability:** No write APIs exist on the server, and the frontend client contains zero cryptographic signing libraries (`ethers`, `viem`, `web3.js`).

---

## 19. Data Integrity & Transparency Requirements

A scientific research platform must communicate uncertainty with precision:

1. **Sample Size Warnings:** When a wallet has fewer than 20 recorded trades, the win rate must be flagged with `[LOW SAMPLE SIZE (<20)]`.
2. **No Data Fabrication:** If market data snapshots or closed trade outcomes are unavailable, the UI must display `INSUFFICIENT DATA` or `PENDING RESOLUTION` rather than `0.00%` or `$0.00`.
3. **Provenance Badges:** Every trade record must state whether it originated from:
   - `REAL READ-ONLY POLYMARKET API`
   - `REPLAY SCENARIO`
   - `SYNTHETIC FIXTURE`
4. **Realistic vs Observed Prices:** In the Copyability module, the UI must explicitly display both the *Observed Leaderboard Execution Price* and the *Simulated Realistic Copy Price (after slippage & spread)* side-by-side.

---

## 20. Risks, Tradeoffs, and Mitigations

| Risk | Impact | Likelihood | Mitigation Strategy |
|---|---|---|---|
| **Scope Creep into Live Trading** | Critical | Low | Hard architectural boundary; zero signing keys; strict automated security tests in CI. |
| **Increased Build Complexity** | Medium | Low | Use Vite instead of Next.js. Keep client build output as simple static files served by existing Node server. |
| **Data Synchronization Lag** | Low | Medium | Utilize TanStack Query window-focus revalidation and clear data freshness age badges. |
| **Performance Degradation with Large Datasets** | Medium | Low | Virtualize table rows with `@tanstack/react-virtual`; paginate API queries. |
| **Breakage of Existing Workflow** | High | Low | Maintain dual-running capability; keep `index.html` functional until final signoff. |

---

## 21. Future Implementation Roadmap Summary

The concrete multi-phase implementation plan is detailed in `FRONTEND_IMPLEMENTATION_ROADMAP.md`. It outlines:
- **Phase 0:** Architecture & Design System (Current Task 1.8 - Complete).
- **Phase 1–3:** Vite Scaffold, Typed Data Layer, and Workstation Shell.
- **Phase 4–7:** Module implementations (Command Center, Research, Operations, Performance, Governance).
- **Phase 8–10:** Responsive Polish, a11y hardening, and verified dual-run cutover.

---

## 22. Explicitly Deferred Work

To maintain strict project boundaries, the following capabilities are **explicitly deferred** to subsequent tasks:
1. **Task 2.0 (Autonomous Observation Loop):** Background continuous daemon execution.
2. **Task 2.1 (Empirical Parameter Calibration):** Automated parameter tuning and backtest optimization.
3. **Live Execution / Order Placement:** Any write-capable trading endpoints, wallet signing, private key handling, or real-money transactions.
4. **Database Schema Modifications:** Any schema alterations beyond read-only UI indexing.
5. **Strategy & Sizing Modifications:** Moving or altering scoring formulas, risk rules, or sizing bounds.

---
*Assessment authored for `C:\BOTS` in compliance with Task 1.8 specifications.*
