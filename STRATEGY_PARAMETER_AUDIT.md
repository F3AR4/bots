# TASK 1.4: STRATEGY-PARAMETER INTEGRITY AUDIT TABLE

**Project**: Polymarket Copy-Trading Research + Paper-Trading System  
**Workspace**: `C:\BOTS`  
**Execution Mode**: `STRICTLY PAPER ONLY`  
**Network Mode**: `READ ONLY`  
**Date**: September 14, 2026  

---

## 1. Executive Summary & Source of Truth Principle

The supplied PDF document is the sole source of truth for all strategy rules.
- **Explicit PDF Strategy Parameters**: Strictly bounded to simulated execution bet sizing (`$5.00` min, `$20.00` max) and simulated execution mode (`PAPER ONLY`).
- **Provisional Implementation Baselines**: Scoring dimension weights (25/25/20/15/10/5), status thresholds (70 TRACK / 45 WATCH), penalty deductions (30/25/20/15/20/20/15), $10,000 ROI normalization target, 80% one-hit-wonder concentration threshold, 3 category resolved trades requirement, and evidence tier thresholds (75/50/25) are **provisional implementation baselines**. They are **NOT** specified by the PDF.
- **Audit Invariant**: No invented or empirical baseline may be presented in code comments, documentation, UI labels, or API metadata as "PDF-defined" or "source-specified".

---

## 2. Comprehensive Strategy Parameter Audit Table

| Parameter | Current Value | Location | Classification | Source | Affects Decisions | Versioned | Immutable Historically | UI Labels Correctly |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `simulatedBetMin` | `$5.00` | `src/config/ruleset.default.ts:15` | `PDF_EXPLICIT` | PDF Logic Spec (Page 3 / Section 3.2) | Yes | Yes | Yes | Yes (`[PDF EXPLICIT]`) |
| `simulatedBetMax` | `$20.00` | `src/config/ruleset.default.ts:16` | `PDF_EXPLICIT` | PDF Logic Spec (Page 3 / Section 3.2) | Yes | Yes | Yes | Yes (`[PDF EXPLICIT]`) |
| `minDiscoveryLiquidityUsd` | `$500.00` | `src/config/ruleset.default.ts:19` | `IMPLEMENTATION_BASELINE` | Research discovery floor baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `minResolvedTradesCount` | `5` | `src/config/ruleset.default.ts:20` | `IMPLEMENTATION_BASELINE` | Research statistical stability baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `minCategoryResolvedTradesCount` | `3` | `src/config/ruleset.default.ts:21` | `IMPLEMENTATION_BASELINE` | Category edge qualification sample size | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `maxSingleMarketEdgeTrades` | `2` | `src/config/ruleset.default.ts:22` | `IMPLEMENTATION_BASELINE` | Single-market dominance threshold | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `singleTradeProfitConcentrationThreshold` | `0.80 (80%)` | `src/config/ruleset.default.ts:25` | `IMPLEMENTATION_BASELINE` | One-hit-wonder concentration trigger | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `minLiquidityQualityUsd` | `$1,000.00` | `src/config/ruleset.default.ts:26` | `IMPLEMENTATION_BASELINE` | Wallet average liquidity penalty trigger | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `maxHistoricalSpread` | `$0.05` | `src/config/ruleset.default.ts:27` | `IMPLEMENTATION_BASELINE` | Wide historical spread penalty trigger | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `penaltySingleTradeConcentrationDeduction` | `30.0 pts` | `src/config/ruleset.default.ts:28` | `IMPLEMENTATION_BASELINE` | One-hit-wonder deduction baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `penaltyIlliquidActivityDeduction` | `25.0 pts` | `src/config/ruleset.default.ts:29` | `IMPLEMENTATION_BASELINE` | Illiquid trading deduction baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `penaltyInsufficientResolvedTradesDeduction` | `20.0 pts` | `src/config/ruleset.default.ts:30` | `IMPLEMENTATION_BASELINE` | Thin history deduction baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `penaltyWideHistoricalSpreadDeduction` | `15.0 pts` | `src/config/ruleset.default.ts:31` | `IMPLEMENTATION_BASELINE` | Wide spread deduction baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `penaltySingleMarketEdgeDeduction` | `20.0 pts` | `src/config/ruleset.default.ts:32` | `IMPLEMENTATION_BASELINE` | Single-market concentration deduction | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `penaltyUnfollowablePricingDeduction` | `20.0 pts` | `src/config/ruleset.default.ts:33` | `IMPLEMENTATION_BASELINE` | Extreme adverse pricing deduction | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `penaltyExcessivePostEntryMovementDeduction` | `15.0 pts` | `src/config/ruleset.default.ts:34` | `IMPLEMENTATION_BASELINE` | Post-entry adverse drift deduction | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `extremePriceLowerBound` | `$0.05` | `src/config/ruleset.default.ts:37` | `IMPLEMENTATION_BASELINE` | Deep tail probability lower bound | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `extremePriceUpperBound` | `$0.95` | `src/config/ruleset.default.ts:38` | `IMPLEMENTATION_BASELINE` | Near-certainty probability upper bound | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `unfollowablePricingThreshold` | `0.50 (50%)` | `src/config/ruleset.default.ts:39` | `IMPLEMENTATION_BASELINE` | Fraction of extreme trades triggering penalty | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `adverseDriftThreshold` | `0.40 (40%)` | `src/config/ruleset.default.ts:40` | `IMPLEMENTATION_BASELINE` | Fraction of adverse drift triggering penalty | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `fallbackUnobservedLiquidityUsd` | `$5,000.00` | `src/config/ruleset.default.ts:41` | `IMPLEMENTATION_BASELINE` | Neutral unobserved market depth fallback | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `fallbackUnobservedSpread` | `$0.02` | `src/config/ruleset.default.ts:42` | `IMPLEMENTATION_BASELINE` | Neutral unobserved market spread fallback | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `roiTargetBenchmarkUsd` | `$10,000.00` | `src/config/ruleset.default.ts:45` | `IMPLEMENTATION_BASELINE` | 100-pt ROI normalization benchmark | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `defaultWalletEntryTimingScore` | `80.0 pts` | `src/config/ruleset.default.ts:46` | `IMPLEMENTATION_BASELINE` | Neutral wallet entry timing fallback | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `defaultTradeEntryTimingScore` | `85.0 pts` | `src/config/ruleset.default.ts:47` | `IMPLEMENTATION_BASELINE` | Neutral trade entry timing fallback | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `defaultThesisScore` | `80.0 pts` | `src/config/ruleset.default.ts:48` | `IMPLEMENTATION_BASELINE` | Neutral thesis alignment fallback | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `walletWeightRoi` | `0.25 (25%)` | `src/config/ruleset.default.ts:51` | `IMPLEMENTATION_BASELINE` | Dimension weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `walletWeightConsistency` | `0.25 (25%)` | `src/config/ruleset.default.ts:52` | `IMPLEMENTATION_BASELINE` | Dimension weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `walletWeightCopyability` | `0.20 (20%)` | `src/config/ruleset.default.ts:53` | `IMPLEMENTATION_BASELINE` | Dimension weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `walletWeightCategoryEdge` | `0.15 (15%)` | `src/config/ruleset.default.ts:54` | `IMPLEMENTATION_BASELINE` | Dimension weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `walletWeightLiquidity` | `0.10 (10%)` | `src/config/ruleset.default.ts:55` | `IMPLEMENTATION_BASELINE` | Dimension weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `walletWeightEntryTiming` | `0.05 (5%)` | `src/config/ruleset.default.ts:56` | `IMPLEMENTATION_BASELINE` | Dimension weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `walletTrackCutoffScore` | `70.0 pts` | `src/config/ruleset.default.ts:59` | `IMPLEMENTATION_BASELINE` | TRACK qualification threshold baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `walletWatchCutoffScore` | `45.0 pts` | `src/config/ruleset.default.ts:60` | `IMPLEMENTATION_BASELINE` | WATCH qualification threshold baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `minTradeLiquidityUsd` | `$250.00` | `src/config/ruleset.default.ts:63` | `IMPLEMENTATION_BASELINE` | Top-of-book copy minimum depth baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `maxAllowedSpread` | `$0.04` | `src/config/ruleset.default.ts:64` | `IMPLEMENTATION_BASELINE` | Copy trade execution max spread baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `maxAllowedPriceDrift` | `$0.03` | `src/config/ruleset.default.ts:65` | `IMPLEMENTATION_BASELINE` | Copy trade max price drift baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `minPaperCopyScore` | `65.0 pts` | `src/config/ruleset.default.ts:68` | `IMPLEMENTATION_BASELINE` | Simulated execution qualification baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `minWatchlistScore` | `50.0 pts` | `src/config/ruleset.default.ts:69` | `IMPLEMENTATION_BASELINE` | Watchlist copy benchmark baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `tradeWeightWalletQuality` | `0.25 (25%)` | `src/config/ruleset.default.ts:72` | `IMPLEMENTATION_BASELINE` | Trade evaluation factor weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `tradeWeightCategoryFit` | `0.20 (20%)` | `src/config/ruleset.default.ts:73` | `IMPLEMENTATION_BASELINE` | Trade evaluation factor weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `tradeWeightPriceMovement` | `0.15 (15%)` | `src/config/ruleset.default.ts:74` | `IMPLEMENTATION_BASELINE` | Trade evaluation factor weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `tradeWeightSpread` | `0.15 (15%)` | `src/config/ruleset.default.ts:75` | `IMPLEMENTATION_BASELINE` | Trade evaluation factor weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `tradeWeightLiquidity` | `0.10 (10%)` | `src/config/ruleset.default.ts:76` | `IMPLEMENTATION_BASELINE` | Trade evaluation factor weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `tradeWeightEntryTiming` | `0.10 (10%)` | `src/config/ruleset.default.ts:77` | `IMPLEMENTATION_BASELINE` | Trade evaluation factor weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `tradeWeightThesis` | `0.05 (5%)` | `src/config/ruleset.default.ts:78` | `IMPLEMENTATION_BASELINE` | Trade evaluation factor weight baseline | Yes | Yes | Yes | Yes (`[PROVISIONAL BASELINE]`) |
| `evidenceTierHighThreshold` | `75.0 pts` | `src/config/ruleset.default.ts:81` | `IMPLEMENTATION_BASELINE` | Research data-quality evidence tier threshold | No (Quality Only) | Yes | Yes | Yes (`[DATA QUALITY CONVENTION]`) |
| `evidenceTierModerateThreshold` | `50.0 pts` | `src/config/ruleset.default.ts:82` | `IMPLEMENTATION_BASELINE` | Research data-quality evidence tier threshold | No (Quality Only) | Yes | Yes | Yes (`[DATA QUALITY CONVENTION]`) |
| `evidenceTierLowThreshold` | `25.0 pts` | `src/config/ruleset.default.ts:83` | `IMPLEMENTATION_BASELINE` | Research data-quality evidence tier threshold | No (Quality Only) | Yes | Yes | Yes (`[DATA QUALITY CONVENTION]`) |
| `evidenceMinTradesHigh` | `10 trades` | `src/config/ruleset.default.ts:84` | `IMPLEMENTATION_BASELINE` | High evidence minimum trade sample count | No (Quality Only) | Yes | Yes | Yes (`[DATA QUALITY CONVENTION]`) |
| `evidenceMinTradesModerate` | `5 trades` | `src/config/ruleset.default.ts:85` | `IMPLEMENTATION_BASELINE` | Moderate evidence minimum trade sample count | No (Quality Only) | Yes | Yes | Yes (`[DATA QUALITY CONVENTION]`) |
| `evidenceMinTradesLow` | `3 trades` | `src/config/ruleset.default.ts:86` | `IMPLEMENTATION_BASELINE` | Low evidence minimum trade sample count | No (Quality Only) | Yes | Yes | Yes (`[DATA QUALITY CONVENTION]`) |

---

## 3. Separation of Diagnostics vs Strategy Decisions

| Diagnostic Fact (Empirical Measurement) | Strategy Decision (Policy Trigger) | Trigger Threshold Origin |
| :--- | :--- | :--- |
| `largestWinProfitRatio = X%` | Apply 30 pt concentration penalty if `X >= 80%` | `IMPLEMENTATION_BASELINE` (Page 2 requires penalizing concentration, but 80% is baseline) |
| `resolvedTradesCount = N` | Apply 20 pt thin history penalty if `N < 5` | `IMPLEMENTATION_BASELINE` (Page 2 requires sample size, but 5 is baseline) |
| `averageLiquidityUsd = $L` | Apply 25 pt illiquidity penalty if `$L < $1,000` | `IMPLEMENTATION_BASELINE` (Page 2 requires copyable liquidity, $1k is baseline) |
| `averageSpread = $S` | Apply 15 pt wide spread penalty if `$S > $0.05` | `IMPLEMENTATION_BASELINE` (Page 2 requires copyable spread, $0.05 is baseline) |
| `categoryResolvedTrades = C` | Qualify category win-rate as specialized edge if `C >= 3` | `IMPLEMENTATION_BASELINE` (Statistical sample minimum baseline) |
| `compositeScore = S` | Classify status as `TRACK` if `S >= 70`, `WATCH` if `S >= 45` | `IMPLEMENTATION_BASELINE` (Triage boundary baseline) |
| `evidenceScore = E` | Assign research tier `HIGH` (>=75), `MODERATE` (>=50), `LOW` (>=25) | `DATA QUALITY CONVENTION` (Research confidence, does not alter skill score) |
