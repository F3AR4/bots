# Decision Model & Explainability Engine

## 1. Decision Philosophy

In this copy-trading system, a trading decision is never a single opaque number or boolean flag. Every decision is an **immutable, fully auditable artifact** containing:
1. A categorical verdict (`paper_copy`, `watchlist`, `skip`).
2. An overall numerical `copyScore` and an associated `confidence` rating (if defined).
3. A granular breakdown of all contributing sub-scores.
4. An explicit list of positive factors (`reasonsJson`).
5. An explicit list of negative risk factors (`risksJson`).
6. A reference to the active `ruleVersion` under which the decision was reached.
7. High-resolution timestamps capturing both the wallet event time and the decision evaluation time.

---

## 2. The Tri-State Decision Space

```
                 [ Observed New Trade Event ]
                              │
                              ▼
               [ Step 1: Wallet Status Filter ]
                              │
             ┌────────────────┴────────────────┐
          Status != TRACK                  Status == TRACK
             │                                 │
             ▼                                 ▼
      [ Action: SKIP ]            [ Step 2: Copyability Gate ]
      (Weak / Ignored Wallet)                  │
                                 ┌─────────────┴─────────────┐
                               Fail                         Pass
                                 │                           │
                                 ▼                           ▼
                          [ Action: SKIP ]        [ Step 3: Multi-Factor Scoring ]
                        (Spread/Slippage/Late)               │
                                                             ▼
                                                [ Composite Copy Score ]
                                                             │
                                        ┌────────────────────┼────────────────────┐
                                        │                    │                    │
                                 Score >= MinCopy     MinWatch <= Score     Score < MinWatch
                                        │                    │                    │
                                        ▼                    ▼                    ▼
                                [ Action: PAPER_COPY ] [ Action: WATCHLIST ] [ Action: SKIP ]
                                 Simulate $5 - $20     Observe & Benchmark   Reject & Log
```

### 2.1 Decision Definitions
- **`paper_copy`** **[EXPLICIT]**: The trade setup meets or exceeds all minimum quality, copyability, and wallet thresholds. Creates an active simulated `PaperTrade` with capital allocation between \$5 and \$20.
- **`watchlist`** **[EXPLICIT]**: The trade setup is interesting but exhibits marginal attributes (e.g., borderline spread, wallet unproven in this specific category, or slightly elevated slippage). No capital is allocated, but the signal is monitored for benchmark evaluation against copied trades.
- **`skip`** **[EXPLICIT]**: The trade is unsuitable. Common disqualifiers include:
  - Entry detected too late (price has moved significantly).
  - Insufficient liquidity or prohibitive spread.
  - Wallet quality below threshold or penalized as a one-hit wonder.
  - Unfavorable market category fit or unclear thesis.

---

## 3. Scoring Dimensions & Weighting Structure

### 3.1 Sub-Score Breakdown
The decision model decomposes the trade signal into normalized sub-scores $\in [0, 100]$:

| Dimension | Source / Metric | Classification | Description |
| :--- | :--- | :--- | :--- |
| **`walletQualityScore`** | `WalletProfile.globalScore` | **[EXPLICIT]** | Blended score reflecting wallet consistency, ROI, and reliability. |
| **`roiScore`** | `WalletProfile.roi30d` | **[EXPLICIT]** | 30-day profit performance of the initiator. |
| **`consistencyScore`** | `WalletProfile.consistencyScore` | **[EXPLICIT]** | Trade win stability across diverse independent markets. |
| **`copyabilityScore`** | Slippage & Timing Metrics | **[EXPLICIT]** | Practical feasibility of replicating the position now. |
| **`categoryFitScore`** | Category Win Rate & Volume | **[EXPLICIT]** | Wallet's proven domain edge in this specific category. |
| **`entryTimingScore`** | Detection Latency | **[EXPLICIT]** | Penalizes lag between on-chain fill and bot signal detection. |
| **`spreadScore`** | Order Book Bid-Ask Spread | **[EXPLICIT]** | Penalizes wide spreads that erode expected edge. |
| **`liquidityScore`** | Top-of-Book USDC Depth | **[EXPLICIT]** | Rewards deep books capable of absorbing simulated size. |
| **`thesisScore`** | Setup Coherence / Rules | **[EXPLICIT]** | Market setup alignment with current active rule set. |

### 3.2 Parameter Audit: Explicit vs Implied vs Not Specified

```
Category Weights:
- walletWeight:           NOT SPECIFIED (TBD / Configurable, default: 0.25)
- copyabilityWeight:      NOT SPECIFIED (TBD / Configurable, default: 0.25)
- spreadWeight:           NOT SPECIFIED (TBD / Configurable, default: 0.15)
- liquidityWeight:        NOT SPECIFIED (TBD / Configurable, default: 0.15)
- categoryFitWeight:      NOT SPECIFIED (TBD / Configurable, default: 0.10)
- thesisWeight:           NOT SPECIFIED (TBD / Configurable, default: 0.10)

Decision Thresholds:
- minCopyScoreThreshold:  NOT SPECIFIED (TBD / Configurable in RuleSet, default: 75)
- minWatchScoreThreshold: NOT SPECIFIED (TBD / Configurable in RuleSet, default: 50)
- maxPriceDriftAllowed:   NOT SPECIFIED (TBD / Configurable in RuleSet, default: 0.03 = 3 cents)
- maxSpreadAllowed:       NOT SPECIFIED (TBD / Configurable in RuleSet, default: 0.04 = 4 cents)
- minLiquidityUsd:        NOT SPECIFIED (TBD / Configurable in RuleSet, default: $500)
```

---

## 4. Position Sizing Model

- **[EXPLICIT]** Simulated position size must range between **\$5.00** and **\$20.00**.
- **[EXPLICIT]** Higher confidence trades are granted larger simulated allocations.
- **[IMPLIED]** Sizing formula must be a continuous or stepped deterministic mapping from the decision's confidence metric:

$$\text{SimulatedSize} = \$5.00 + (\$20.00 - \$5.00) \times \text{ConfidenceFactor}$$

Where $\text{ConfidenceFactor} \in [0.0, 1.0]$. If confidence is not explicitly derived from an ML model, it maps linearly from the normalized excess score above the minimum copy threshold:

$$\text{ConfidenceFactor} = \min\left(1.0, \max\left(0.0, \frac{\text{copyScore} - \text{minCopyScoreThreshold}}{100 - \text{minCopyScoreThreshold}}\right)\right)$$

---

## 5. Explainability & Audit Trail

Every journal entry generated by the engine must produce an unambiguous explanation block:

```json
{
  "decision": "paper_copy",
  "copyScore": 84.5,
  "confidence": 0.68,
  "reasons": [
    "Wallet 0xabc... ranked #12 globally with 82% consistency score",
    "High category edge in Politics (78% win rate across 18 resolved markets)",
    "Spread is tight (0.8 cents / 1.2%) with $12,400 depth within 2 cents",
    "Detected within 8 seconds; price drift is $0.005"
  ],
  "risks": [
    "Market expires in 4 hours (short duration)",
    "Overall market volume is moderately low ($24k total)"
  ],
  "simulatedPositionSize": 15.20,
  "ruleVersion": "v1.0.0",
  "evaluatedAt": "2026-09-14T12:00:00.000Z"
}
```

This ensures that downstream users, dashboards, and automated retrospective reviewers can inspect the precise rationale behind every copy, watch, or skip action.
