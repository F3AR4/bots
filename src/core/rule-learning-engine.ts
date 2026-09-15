/**
 * Deterministic Rule Learning Engine.
 * 
 * Safety & Invariant Guarantees:
 * - Deterministic input-to-output: same database state + RuleSet + config = identical proposed changes.
 * - Enforces anti-overfitting guardrails (max step bounds, parameter cooldowns, evidence floors).
 * - Implements 6 parameterized learning policies.
 * - Never mutates existing RuleSets; emits candidate parameter proposals for walk-forward validation.
 */

import {
  RuleSet,
  RuleSetConfig,
  CalibrationDataset,
  FourCohortBenchmarkResult,
  RuleLearningConfig,
  CandidateParameterProposal,
  LearningPolicyName,
  EvidenceTier
} from '../types/domain.js';
import { DEFAULT_RULE_LEARNING_CONFIG } from '../config/learning.default.js';

export interface RuleLearningAnalysisResult {
  activeRuleSetId: string;
  evidenceTier: EvidenceTier;
  sampleCount: number;
  cohortResult: FourCohortBenchmarkResult;
  proposals: CandidateParameterProposal[];
  rejectedProposals: { proposal: CandidateParameterProposal; reason: string }[];
  policyDiagnostics: Record<LearningPolicyName, {
    evaluated: boolean;
    triggered: boolean;
    reason: string;
    metrics: Record<string, number | string>;
  }>;
  summary: string;
}

export class RuleLearningEngine {
  constructor(private config: RuleLearningConfig = DEFAULT_RULE_LEARNING_CONFIG) {}

  /**
   * Deterministically analyzes calibration dataset and generates candidate parameter changes.
   */
  public analyzeAndPropose(
    activeRuleSet: RuleSet,
    dataset: CalibrationDataset,
    cohortResult: FourCohortBenchmarkResult,
    recentModifiedParams: Set<string> = new Set()
  ): RuleLearningAnalysisResult {
    const policyDiagnostics: Record<LearningPolicyName, {
      evaluated: boolean;
      triggered: boolean;
      reason: string;
      metrics: Record<string, number | string>;
    }> = {
      SPREAD_ADAPTATION: { evaluated: false, triggered: false, reason: '', metrics: {} },
      LIQUIDITY_ADAPTATION: { evaluated: false, triggered: false, reason: '', metrics: {} },
      WALLET_QUALITY_ADAPTATION: { evaluated: false, triggered: false, reason: '', metrics: {} },
      CATEGORY_ADAPTATION: { evaluated: false, triggered: false, reason: '', metrics: {} },
      LATE_ENTRY_ADAPTATION: { evaluated: false, triggered: false, reason: '', metrics: {} },
      CONSISTENCY_ADAPTATION: { evaluated: false, triggered: false, reason: '', metrics: {} }
    };

    const rawProposals: CandidateParameterProposal[] = [];
    const rejectedProposals: { proposal: CandidateParameterProposal; reason: string }[] = [];

    // Insufficient evidence check
    if (dataset.evidenceTier === 'INSUFFICIENT' || dataset.samples.length < this.config.minEvidenceTradesWeak) {
      return {
        activeRuleSetId: activeRuleSet.id,
        evidenceTier: 'INSUFFICIENT',
        sampleCount: dataset.samples.length,
        cohortResult,
        proposals: [],
        rejectedProposals: [],
        policyDiagnostics,
        summary: `Insufficient evidence: ${dataset.samples.length} trade samples (minimum required: ${this.config.minEvidenceTradesWeak}). No rule changes proposed.`
      };
    }

    const resolvedSamples = dataset.samples.filter(s => s.outcome !== null && s.outcome !== 'UNRESOLVED');

    // Policy 1: Spread Adaptation
    if (this.config.policies.SPREAD_ADAPTATION.enabled) {
      const spreadPolicy = this.config.policies.SPREAD_ADAPTATION;
      policyDiagnostics.SPREAD_ADAPTATION.evaluated = true;

      const spreadCutoff = activeRuleSet.config.maxAllowedSpread * 0.75;
      const wideSpreadSamples = resolvedSamples.filter(s => s.spread >= spreadCutoff);
      const tightSpreadSamples = resolvedSamples.filter(s => s.spread < spreadCutoff);

      if (wideSpreadSamples.length >= spreadPolicy.minEvidenceTrades) {
        const wideWins = wideSpreadSamples.filter(s => s.outcome === 'WIN').length;
        const wideWinRate = wideWins / wideSpreadSamples.length;
        const tightWins = tightSpreadSamples.length > 0 ? tightSpreadSamples.filter(s => s.outcome === 'WIN').length : 0;
        const tightWinRate = tightSpreadSamples.length > 0 ? tightWins / tightSpreadSamples.length : 0.5;

        const widePnl = wideSpreadSamples.reduce((acc, s) => acc + (s.paperTrade?.realizedPnl ?? s.realizedPnl ?? 0), 0);
        const tightPnl = tightSpreadSamples.reduce((acc, s) => acc + (s.paperTrade?.realizedPnl ?? s.realizedPnl ?? 0), 0);

        policyDiagnostics.SPREAD_ADAPTATION.metrics = {
          wideSpreadSamples: wideSpreadSamples.length,
          wideWinRate: Math.round(wideWinRate * 1000) / 1000,
          tightWinRate: Math.round(tightWinRate * 1000) / 1000,
          widePnl: Math.round(widePnl * 100) / 100,
          tightPnl: Math.round(tightPnl * 100) / 100
        };

        if (wideWinRate < tightWinRate - spreadPolicy.thresholdTrigger || widePnl < 0) {
          policyDiagnostics.SPREAD_ADAPTATION.triggered = true;
          const currentSpread = activeRuleSet.config.maxAllowedSpread;
          const proposedSpread = Math.max(
            this.config.guardrails.maxAllowedSpread.min,
            Math.round((currentSpread - spreadPolicy.stepSize) * 1000) / 1000
          );

          if (proposedSpread < currentSpread) {
            rawProposals.push({
              paramKey: 'maxAllowedSpread',
              beforeValue: currentSpread,
              proposedValue: proposedSpread,
              reason: `Spread-heavy paper trades underperformed (win rate ${(wideWinRate * 100).toFixed(1)}% vs ${(tightWinRate * 100).toFixed(1)}% tight, PnL $${widePnl.toFixed(2)}).`,
              evidence: `Observed ${wideSpreadSamples.length} wide-spread trades (spread >= $${spreadCutoff.toFixed(3)}) vs ${tightSpreadSamples.length} tight trades.`,
              evidenceTier: dataset.evidenceTier,
              expectedImprovement: `Lowering max spread from $${currentSpread.toFixed(3)} to $${proposedSpread.toFixed(3)} reduces adverse bid-ask drag on entries.`,
              affectedDimension: 'tradeWeightSpread',
              policyName: 'SPREAD_ADAPTATION'
            });
            policyDiagnostics.SPREAD_ADAPTATION.reason = 'Triggered lowering of maxAllowedSpread';
          }
        } else {
          policyDiagnostics.SPREAD_ADAPTATION.reason = 'Wide spread trades performed adequately';
        }
      } else {
        policyDiagnostics.SPREAD_ADAPTATION.reason = `Insufficient wide-spread sample count (${wideSpreadSamples.length} < ${spreadPolicy.minEvidenceTrades})`;
      }
    }

    // Policy 2: Liquidity Adaptation
    if (this.config.policies.LIQUIDITY_ADAPTATION.enabled) {
      const liqPolicy = this.config.policies.LIQUIDITY_ADAPTATION;
      policyDiagnostics.LIQUIDITY_ADAPTATION.evaluated = true;

      const liqCutoff = activeRuleSet.config.minTradeLiquidityUsd * 1.5;
      const thinSamples = resolvedSamples.filter(s => s.liquidity <= liqCutoff);
      const deepSamples = resolvedSamples.filter(s => s.liquidity > liqCutoff);

      if (thinSamples.length >= liqPolicy.minEvidenceTrades) {
        const thinWins = thinSamples.filter(s => s.outcome === 'WIN').length;
        const thinWinRate = thinWins / thinSamples.length;
        const deepWins = deepSamples.length > 0 ? deepSamples.filter(s => s.outcome === 'WIN').length : 0;
        const deepWinRate = deepSamples.length > 0 ? deepWins / deepSamples.length : 0.5;

        const thinPnl = thinSamples.reduce((acc, s) => acc + (s.paperTrade?.realizedPnl ?? s.realizedPnl ?? 0), 0);

        policyDiagnostics.LIQUIDITY_ADAPTATION.metrics = {
          thinSamples: thinSamples.length,
          thinWinRate: Math.round(thinWinRate * 1000) / 1000,
          deepWinRate: Math.round(deepWinRate * 1000) / 1000,
          thinPnl: Math.round(thinPnl * 100) / 100
        };

        if (thinWinRate < deepWinRate - liqPolicy.thresholdTrigger || thinPnl < 0) {
          policyDiagnostics.LIQUIDITY_ADAPTATION.triggered = true;
          const currentLiq = activeRuleSet.config.minTradeLiquidityUsd;
          const proposedLiq = Math.min(
            this.config.guardrails.minTradeLiquidityUsd.max,
            Math.round(currentLiq + liqPolicy.stepSize)
          );

          if (proposedLiq > currentLiq) {
            rawProposals.push({
              paramKey: 'minTradeLiquidityUsd',
              beforeValue: currentLiq,
              proposedValue: proposedLiq,
              reason: `Low-liquidity trades underperformed (win rate ${(thinWinRate * 100).toFixed(1)}% vs ${(deepWinRate * 100).toFixed(1)}% deep, PnL $${thinPnl.toFixed(2)}).`,
              evidence: `Observed ${thinSamples.length} low-liquidity trades (depth <= $${liqCutoff.toFixed(0)}) with sub-par execution.`,
              evidenceTier: dataset.evidenceTier,
              expectedImprovement: `Raising min liquidity from $${currentLiq.toFixed(0)} to $${proposedLiq.toFixed(0)} filters out illiquid order books.`,
              affectedDimension: 'tradeWeightLiquidity',
              policyName: 'LIQUIDITY_ADAPTATION'
            });
            policyDiagnostics.LIQUIDITY_ADAPTATION.reason = 'Triggered raising of minTradeLiquidityUsd';
          }
        } else {
          policyDiagnostics.LIQUIDITY_ADAPTATION.reason = 'Thin liquidity trades performed adequately';
        }
      } else {
        policyDiagnostics.LIQUIDITY_ADAPTATION.reason = `Insufficient low-liquidity sample count (${thinSamples.length} < ${liqPolicy.minEvidenceTrades})`;
      }
    }

    // Policy 3: Wallet Quality Adaptation
    if (this.config.policies.WALLET_QUALITY_ADAPTATION.enabled) {
      const wqPolicy = this.config.policies.WALLET_QUALITY_ADAPTATION;
      policyDiagnostics.WALLET_QUALITY_ADAPTATION.evaluated = true;

      const paperCopySamples = resolvedSamples.filter(s => s.decision === 'paper_copy');
      if (paperCopySamples.length >= wqPolicy.minEvidenceTrades) {
        const copyWins = paperCopySamples.filter(s => s.outcome === 'WIN').length;
        const copyWinRate = copyWins / paperCopySamples.length;
        const copyPnl = paperCopySamples.reduce((acc, s) => acc + (s.paperTrade?.realizedPnl ?? 0), 0);

        policyDiagnostics.WALLET_QUALITY_ADAPTATION.metrics = {
          paperCopySamples: paperCopySamples.length,
          copyWinRate: Math.round(copyWinRate * 1000) / 1000,
          copyPnl: Math.round(copyPnl * 100) / 100
        };

        if (copyWinRate < 0.45 || copyPnl < 0) {
          policyDiagnostics.WALLET_QUALITY_ADAPTATION.triggered = true;
          const currentCutoff = activeRuleSet.config.walletTrackCutoffScore;
          const proposedCutoff = Math.min(
            this.config.guardrails.walletTrackCutoffScore.max,
            Math.round((currentCutoff + wqPolicy.stepSize) * 10) / 10
          );

          if (proposedCutoff > currentCutoff) {
            rawProposals.push({
              paramKey: 'walletTrackCutoffScore',
              beforeValue: currentCutoff,
              proposedValue: proposedCutoff,
              reason: `Tracked wallets underperformed recent expectations (win rate ${(copyWinRate * 100).toFixed(1)}%, PnL $${copyPnl.toFixed(2)}).`,
              evidence: `Observed ${paperCopySamples.length} resolved paper copies with deteriorating edge.`,
              evidenceTier: dataset.evidenceTier,
              expectedImprovement: `Raising TRACK cutoff from ${currentCutoff.toFixed(1)} to ${proposedCutoff.toFixed(1)} tightens wallet admission filter.`,
              affectedDimension: 'walletTrackCutoffScore',
              policyName: 'WALLET_QUALITY_ADAPTATION'
            });
            policyDiagnostics.WALLET_QUALITY_ADAPTATION.reason = 'Triggered raising of walletTrackCutoffScore';
          }
        } else {
          policyDiagnostics.WALLET_QUALITY_ADAPTATION.reason = 'Tracked wallets performed within expectations';
        }
      } else {
        policyDiagnostics.WALLET_QUALITY_ADAPTATION.reason = `Insufficient paper copies (${paperCopySamples.length} < ${wqPolicy.minEvidenceTrades})`;
      }
    }

    // Policy 4: Category Adaptation
    if (this.config.policies.CATEGORY_ADAPTATION.enabled) {
      const catPolicy = this.config.policies.CATEGORY_ADAPTATION;
      policyDiagnostics.CATEGORY_ADAPTATION.evaluated = true;

      // Group samples by category
      const catMap = new Map<string, typeof resolvedSamples>();
      for (const s of resolvedSamples) {
        const list = catMap.get(s.category) || [];
        list.push(s);
        catMap.set(s.category, list);
      }

      let bestCat = '';
      let bestWinRate = 0;
      let worstCat = '';
      let worstWinRate = 1.0;

      for (const [cat, items] of catMap.entries()) {
        if (items.length >= catPolicy.minEvidenceTrades) {
          const catWins = items.filter(s => s.outcome === 'WIN').length;
          const rate = catWins / items.length;
          if (rate > bestWinRate) {
            bestWinRate = rate;
            bestCat = cat;
          }
          if (rate < worstWinRate) {
            worstWinRate = rate;
            worstCat = cat;
          }
        }
      }

      if (bestCat && worstCat && bestCat !== worstCat && (bestWinRate - worstWinRate) >= catPolicy.thresholdTrigger) {
        policyDiagnostics.CATEGORY_ADAPTATION.triggered = true;
        policyDiagnostics.CATEGORY_ADAPTATION.metrics = {
          bestCategory: bestCat,
          bestWinRate: Math.round(bestWinRate * 1000) / 1000,
          worstCategory: worstCat,
          worstWinRate: Math.round(worstWinRate * 1000) / 1000
        };

        const currentWeight = activeRuleSet.config.tradeWeightCategoryFit;
        const proposedWeight = Math.min(
          this.config.guardrails.tradeWeightCategoryFit.max,
          Math.round((currentWeight + catPolicy.stepSize) * 100) / 100
        );

        if (proposedWeight > currentWeight) {
          rawProposals.push({
            paramKey: 'tradeWeightCategoryFit',
            beforeValue: currentWeight,
            proposedValue: proposedWeight,
            reason: `Category divergence observed: ${bestCat} (${(bestWinRate * 100).toFixed(1)}% win rate) vs ${worstCat} (${(worstWinRate * 100).toFixed(1)}%).`,
            evidence: `Category performance spread of ${((bestWinRate - worstWinRate) * 100).toFixed(1)}% indicates strong domain specialization.`,
            evidenceTier: dataset.evidenceTier,
            expectedImprovement: `Increasing category fit weight from ${currentWeight.toFixed(2)} to ${proposedWeight.toFixed(2)} prioritizes verified domain edge.`,
            affectedDimension: 'tradeWeightCategoryFit',
            policyName: 'CATEGORY_ADAPTATION'
          });
          policyDiagnostics.CATEGORY_ADAPTATION.reason = 'Triggered increasing tradeWeightCategoryFit';
        }
      } else {
        policyDiagnostics.CATEGORY_ADAPTATION.reason = 'No significant category performance divergence observed';
      }
    }

    // Policy 5: Late-Entry Adaptation
    if (this.config.policies.LATE_ENTRY_ADAPTATION.enabled) {
      const latePolicy = this.config.policies.LATE_ENTRY_ADAPTATION;
      policyDiagnostics.LATE_ENTRY_ADAPTATION.evaluated = true;

      const driftThreshold = activeRuleSet.config.maxAllowedPriceDrift * 0.60;
      const lateSamples = resolvedSamples.filter(s => {
        const drift = s.observedTrade.detectedPrice - s.observedTrade.walletEntryPrice;
        return drift >= driftThreshold;
      });
      const promptSamples = resolvedSamples.filter(s => {
        const drift = s.observedTrade.detectedPrice - s.observedTrade.walletEntryPrice;
        return drift < driftThreshold;
      });

      if (lateSamples.length >= latePolicy.minEvidenceTrades) {
        const lateWins = lateSamples.filter(s => s.outcome === 'WIN').length;
        const lateWinRate = lateWins / lateSamples.length;
        const promptWins = promptSamples.length > 0 ? promptSamples.filter(s => s.outcome === 'WIN').length : 0;
        const promptWinRate = promptSamples.length > 0 ? promptWins / promptSamples.length : 0.5;

        const latePnl = lateSamples.reduce((acc, s) => acc + (s.paperTrade?.realizedPnl ?? s.realizedPnl ?? 0), 0);

        policyDiagnostics.LATE_ENTRY_ADAPTATION.metrics = {
          lateSamples: lateSamples.length,
          lateWinRate: Math.round(lateWinRate * 1000) / 1000,
          promptWinRate: Math.round(promptWinRate * 1000) / 1000,
          latePnl: Math.round(latePnl * 100) / 100
        };

        if (lateWinRate < promptWinRate - latePolicy.thresholdTrigger || latePnl < 0) {
          policyDiagnostics.LATE_ENTRY_ADAPTATION.triggered = true;
          const currentDrift = activeRuleSet.config.maxAllowedPriceDrift;
          const proposedDrift = Math.max(
            this.config.guardrails.maxAllowedPriceDrift.min,
            Math.round((currentDrift - latePolicy.stepSize) * 1000) / 1000
          );

          if (proposedDrift < currentDrift) {
            rawProposals.push({
              paramKey: 'maxAllowedPriceDrift',
              beforeValue: currentDrift,
              proposedValue: proposedDrift,
              reason: `Late entry trades underperformed (win rate ${(lateWinRate * 100).toFixed(1)}% vs ${(promptWinRate * 100).toFixed(1)}% prompt, PnL $${latePnl.toFixed(2)}).`,
              evidence: `Observed ${lateSamples.length} late entries with drift >= $${driftThreshold.toFixed(3)}.`,
              evidenceTier: dataset.evidenceTier,
              expectedImprovement: `Tightening allowed price drift from $${currentDrift.toFixed(3)} to $${proposedDrift.toFixed(3)} avoids stale price chases.`,
              affectedDimension: 'tradeWeightPriceMovement',
              policyName: 'LATE_ENTRY_ADAPTATION'
            });
            policyDiagnostics.LATE_ENTRY_ADAPTATION.reason = 'Triggered tightening maxAllowedPriceDrift';
          }
        } else {
          policyDiagnostics.LATE_ENTRY_ADAPTATION.reason = 'Late entries performed adequately';
        }
      } else {
        policyDiagnostics.LATE_ENTRY_ADAPTATION.reason = `Insufficient late-entry samples (${lateSamples.length} < ${latePolicy.minEvidenceTrades})`;
      }
    }

    // Policy 6: Consistency Adaptation
    if (this.config.policies.CONSISTENCY_ADAPTATION.enabled) {
      const constPolicy = this.config.policies.CONSISTENCY_ADAPTATION;
      policyDiagnostics.CONSISTENCY_ADAPTATION.evaluated = true;

      const volatileSamples = resolvedSamples.filter(s => {
        const consScore = s.decisionFactors?.consistency ?? 50;
        return consScore < 50;
      });
      const consistentSamples = resolvedSamples.filter(s => {
        const consScore = s.decisionFactors?.consistency ?? 50;
        return consScore >= 50;
      });

      if (volatileSamples.length >= constPolicy.minEvidenceTrades) {
        const volWins = volatileSamples.filter(s => s.outcome === 'WIN').length;
        const volWinRate = volWins / volatileSamples.length;
        const conWins = consistentSamples.length > 0 ? consistentSamples.filter(s => s.outcome === 'WIN').length : 0;
        const conWinRate = consistentSamples.length > 0 ? conWins / consistentSamples.length : 0.5;

        policyDiagnostics.CONSISTENCY_ADAPTATION.metrics = {
          volatileSamples: volatileSamples.length,
          volatileWinRate: Math.round(volWinRate * 1000) / 1000,
          consistentWinRate: Math.round(conWinRate * 1000) / 1000
        };

        if (volWinRate < conWinRate - constPolicy.thresholdTrigger) {
          policyDiagnostics.CONSISTENCY_ADAPTATION.triggered = true;
          const currentWeight = activeRuleSet.config.walletWeightConsistency;
          const proposedWeight = Math.min(
            this.config.guardrails.walletWeightConsistency.max,
            Math.round((currentWeight + constPolicy.stepSize) * 100) / 100
          );

          if (proposedWeight > currentWeight) {
            rawProposals.push({
              paramKey: 'walletWeightConsistency',
              beforeValue: currentWeight,
              proposedValue: proposedWeight,
              reason: `Volatile wallets underperformed consistent wallets (win rate ${(volWinRate * 100).toFixed(1)}% vs ${(conWinRate * 100).toFixed(1)}%).`,
              evidence: `Observed ${volatileSamples.length} trades from wallets with low consistency score (<50).`,
              evidenceTier: dataset.evidenceTier,
              expectedImprovement: `Increasing consistency weight from ${currentWeight.toFixed(2)} to ${proposedWeight.toFixed(2)} favors reliable track records.`,
              affectedDimension: 'walletWeightConsistency',
              policyName: 'CONSISTENCY_ADAPTATION'
            });
            policyDiagnostics.CONSISTENCY_ADAPTATION.reason = 'Triggered increasing walletWeightConsistency';
          }
        } else {
          policyDiagnostics.CONSISTENCY_ADAPTATION.reason = 'Volatile wallets performed adequately';
        }
      } else {
        policyDiagnostics.CONSISTENCY_ADAPTATION.reason = `Insufficient volatile wallet samples (${volatileSamples.length} < ${constPolicy.minEvidenceTrades})`;
      }
    }

    // Apply Overfitting Guardrails:
    // 1. Filter out cooldown parameters
    // 2. Validate bounds
    // 3. Limit to maxChangesPerCycle
    const acceptedProposals: CandidateParameterProposal[] = [];

    for (const p of rawProposals) {
      if (recentModifiedParams.has(p.paramKey)) {
        rejectedProposals.push({
          proposal: p,
          reason: `Parameter '${p.paramKey}' is in cooldown.`
        });
        continue;
      }

      // Hard guardrail check
      const limits = this.config.guardrails[p.paramKey];
      if (limits) {
        if (p.proposedValue < limits.min || p.proposedValue > limits.max) {
          rejectedProposals.push({
            proposal: p,
            reason: `Proposed value ${p.proposedValue} breaches guardrail [${limits.min}, ${limits.max}].`
          });
          continue;
        }
      }

      // Max step relative check
      const maxDelta = Math.abs(p.beforeValue * this.config.maxParameterStepPercent);
      const actualDelta = Math.abs(p.proposedValue - p.beforeValue);
      if (actualDelta > maxDelta * 1.5 && maxDelta > 0) {
        rejectedProposals.push({
          proposal: p,
          reason: `Step size ${actualDelta} exceeds maximum allowed step ${maxDelta.toFixed(4)}.`
        });
        continue;
      }

      if (acceptedProposals.length < this.config.maxChangesPerCycle) {
        acceptedProposals.push(p);
      } else {
        rejectedProposals.push({
          proposal: p,
          reason: `Exceeded max changes per calibration cycle (${this.config.maxChangesPerCycle}).`
        });
      }
    }

    const summary = acceptedProposals.length > 0
      ? `Generated ${acceptedProposals.length} candidate parameter change(s) from ${dataset.samples.length} empirical samples.`
      : `No rule changes proposed (${rejectedProposals.length} rejected by guardrails/cooldown).`;

    return {
      activeRuleSetId: activeRuleSet.id,
      evidenceTier: dataset.evidenceTier,
      sampleCount: dataset.samples.length,
      cohortResult,
      proposals: acceptedProposals,
      rejectedProposals,
      policyDiagnostics,
      summary
    };
  }
}
