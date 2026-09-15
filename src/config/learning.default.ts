/**
 * Default Calibration & Rule Learning Configuration.
 * 
 * Safety & Provenance Guarantee:
 * - [PDF_EXPLICIT]: Simulated paper size bounds $5.00 min and $20.00 max are permanent.
 * - [IMPLEMENTATION BASELINE - CALIBRATION CONFIG]: All evidence floors, step bounds,
 *   cooldowns, and adaptation thresholds are explicitly marked baselines, NOT PDF-mandated.
 */

import { RuleLearningConfig } from '../types/domain.js';

export const DEFAULT_RULE_LEARNING_CONFIG: RuleLearningConfig = {
  // [IMPLEMENTATION BASELINE - CALIBRATION CONFIG] Evidence sample thresholds
  minEvidenceTradesStrong: 20,
  minEvidenceTradesModerate: 10,
  minEvidenceTradesWeak: 5,

  // [IMPLEMENTATION BASELINE - CALIBRATION CONFIG] Anti-overfitting guardrails
  maxParameterStepPercent: 0.20,      // Max 20% relative change per cycle
  parameterCooldownCycles: 1,         // Minimum 1 cycle cooldown for same parameter
  maxChangesPerCycle: 2,              // Max 2 parameters modified per calibration cycle
  trainWindowRatio: 0.70,             // 70% train / 30% out-of-sample validation split
  minValidationTrades: 3,             // Minimum trades in validation window
  minValidationImprovementPercent: 0.0, // Non-negative delta required for promotion

  // [IMPLEMENTATION BASELINE - CALIBRATION CONFIG] Controlled adaptation policies
  policies: {
    SPREAD_ADAPTATION: {
      policyName: 'SPREAD_ADAPTATION',
      enabled: true,
      minEvidenceTrades: 5,
      thresholdTrigger: 0.02,         // Lower spread if spread-heavy trades underperform by >= 2%
      stepSize: 0.005,                // Reduce maxAllowedSpread by $0.005 (0.5c)
      maxAdjustmentPerCycle: 0.010,   // Max $0.010 (1c) change per cycle
      description: 'Lowers max allowed spread when spread-heavy trades materially underperform comparable trades'
    },
    LIQUIDITY_ADAPTATION: {
      policyName: 'LIQUIDITY_ADAPTATION',
      enabled: true,
      minEvidenceTrades: 5,
      thresholdTrigger: 0.05,         // Raise liquidity if thin-book trades underperform
      stepSize: 100.0,                // Raise minTradeLiquidityUsd by $100
      maxAdjustmentPerCycle: 250.0,   // Max $250 increase per cycle
      description: 'Raises minimum book liquidity when low-liquidity trades underperform'
    },
    WALLET_QUALITY_ADAPTATION: {
      policyName: 'WALLET_QUALITY_ADAPTATION',
      enabled: true,
      minEvidenceTrades: 5,
      thresholdTrigger: 0.05,         // Raise qualification threshold if tracked wallets underperform
      stepSize: 2.5,                  // Raise walletTrackCutoffScore by 2.5 pts
      maxAdjustmentPerCycle: 5.0,     // Max 5.0 pts increase per cycle
      description: 'Raises wallet qualification cutoff score when tracked wallets persistently underperform'
    },
    CATEGORY_ADAPTATION: {
      policyName: 'CATEGORY_ADAPTATION',
      enabled: true,
      minEvidenceTrades: 5,
      thresholdTrigger: 0.05,         // Adjust category weighting if category edge is strong/divergent
      stepSize: 0.02,                 // Increase tradeWeightCategoryFit by 0.02
      maxAdjustmentPerCycle: 0.05,    // Max 0.05 increase per cycle
      description: 'Increases category fit weighting when domain-specific performance diverges'
    },
    LATE_ENTRY_ADAPTATION: {
      policyName: 'LATE_ENTRY_ADAPTATION',
      enabled: true,
      minEvidenceTrades: 5,
      thresholdTrigger: 0.02,         // Reduce price drift if late entries lose
      stepSize: 0.005,                // Reduce maxAllowedPriceDrift by $0.005
      maxAdjustmentPerCycle: 0.010,   // Max $0.010 reduction per cycle
      description: 'Reduces allowed post-entry price drift when late entries incur losses'
    },
    CONSISTENCY_ADAPTATION: {
      policyName: 'CONSISTENCY_ADAPTATION',
      enabled: true,
      minEvidenceTrades: 5,
      thresholdTrigger: 0.05,         // Increase consistency weighting if volatile high-ROI wallets lose
      stepSize: 0.05,                 // Increase walletWeightConsistency by 0.05
      maxAdjustmentPerCycle: 0.10,    // Max 0.10 increase per cycle
      description: 'Increases consistency weighting when high-ROI volatile wallets repeatedly underperform'
    }
  },

  // Inviolable guardrail boundaries
  guardrails: {
    simulatedBetMin: { min: 5.0, max: 5.0 },     // [PDF_EXPLICIT]
    simulatedBetMax: { min: 20.0, max: 20.0 },   // [PDF_EXPLICIT]
    maxAllowedSpread: { min: 0.005, max: 0.060 }, // [IMPLEMENTATION BASELINE]
    minTradeLiquidityUsd: { min: 100.0, max: 50000.0 }, // [IMPLEMENTATION BASELINE]
    maxAllowedPriceDrift: { min: 0.005, max: 0.050 }, // [IMPLEMENTATION BASELINE]
    walletTrackCutoffScore: { min: 50.0, max: 95.0 }, // [IMPLEMENTATION BASELINE]
    minPaperCopyScore: { min: 50.0, max: 95.0 },     // [IMPLEMENTATION BASELINE]
    walletWeightConsistency: { min: 0.10, max: 0.50 }, // [IMPLEMENTATION BASELINE]
    tradeWeightCategoryFit: { min: 0.05, max: 0.35 }   // [IMPLEMENTATION BASELINE]
  }
};
