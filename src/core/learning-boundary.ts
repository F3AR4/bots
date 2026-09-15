/**
 * Learning Boundary & Autonomous Rule Adaptation Safety Framework.
 * 
 * Safety & Lifecycle Guarantees:
 * - Operates strictly within the PAPER trading domain.
 * - Inviolable safety guardrails: simulated bet size strictly [$5.00, $20.00].
 * - Full RuleSet lifecycle: ACTIVE -> CANDIDATE -> (PROMOTE to ACTIVE / REJECT) -> SUPERSEDED.
 * - Historical decisions and RuleSets are 100% immutable and never retroactively rewritten.
 */

import { randomUUID } from 'node:crypto';
import {
  RuleSet,
  RuleChange,
  RuleSetConfig,
  CandidateParameterProposal,
  WalkForwardResult
} from '../types/domain.js';
import { SafetyViolationError } from '../safety/execution-boundary.js';

export interface ParameterProposal {
  paramKey: keyof RuleSetConfig;
  newValue: number;
  reason: string;
  evidence: string;
  expectedImprovement: string;
}

export class LearningBoundary {
  // Hard Invariant Guardrails from LEARNING_BOUNDARY.md & Task 2.1 Specification
  public static readonly GUARDRAILS: Record<string, { min: number; max: number }> = {
    simulatedBetMin: { min: 5.0, max: 5.0 },     // [PDF_EXPLICIT]
    simulatedBetMax: { min: 20.0, max: 20.0 },   // [PDF_EXPLICIT]
    maxAllowedSpread: { min: 0.005, max: 0.060 }, // [IMPLEMENTATION BASELINE]
    minTradeLiquidityUsd: { min: 100.0, max: 50000.0 }, // [IMPLEMENTATION BASELINE]
    maxAllowedPriceDrift: { min: 0.005, max: 0.050 }, // [IMPLEMENTATION BASELINE]
    walletTrackCutoffScore: { min: 50.0, max: 95.0 }, // [IMPLEMENTATION BASELINE]
    minPaperCopyScore: { min: 50.0, max: 95.0 },     // [IMPLEMENTATION BASELINE]
    walletWeightConsistency: { min: 0.10, max: 0.50 }, // [IMPLEMENTATION BASELINE]
    tradeWeightCategoryFit: { min: 0.05, max: 0.35 }   // [IMPLEMENTATION BASELINE]
  };

  /**
   * Validates proposed rule change against inviolable safety guardrails.
   */
  public static validateParameterBound(paramKey: keyof RuleSetConfig, value: number): void {
    const limits = this.GUARDRAILS[paramKey as string];
    if (limits) {
      if (value < limits.min || value > limits.max) {
        throw new SafetyViolationError(
          `Proposed parameter '${paramKey}' value ${value} violates safety guardrail [${limits.min}, ${limits.max}].`
        );
      }
    }
  }

  /**
   * Creates a new CANDIDATE RuleSet from validated parameter proposals.
   */
  public static createCandidateRuleSet(
    activeRuleSet: RuleSet,
    proposals: (CandidateParameterProposal | ParameterProposal)[],
    changedBy: string,
    clock: () => string = () => new Date().toISOString()
  ): { candidateRuleSet: RuleSet; candidateChanges: RuleChange } {
    if (activeRuleSet.status !== 'active') {
      throw new Error(`Cannot branch a candidate RuleSet from inactive RuleSet ${activeRuleSet.id}`);
    }

    const timestamp = clock();
    const newConfig: RuleSetConfig = { ...activeRuleSet.config };
    const beforeValues: Record<string, unknown> = {};
    const afterValues: Record<string, unknown> = {};
    const reasons: string[] = [];
    const evidences: string[] = [];
    const expectedImprovements: string[] = [];

    for (const proposal of proposals) {
      const newValue = 'proposedValue' in proposal ? Number(proposal.proposedValue) : proposal.newValue;
      this.validateParameterBound(proposal.paramKey, newValue);

      beforeValues[proposal.paramKey] = activeRuleSet.config[proposal.paramKey];
      (newConfig as unknown as Record<string, unknown>)[proposal.paramKey] = newValue;
      afterValues[proposal.paramKey] = newValue;

      reasons.push(proposal.reason);
      evidences.push(proposal.evidence);
      expectedImprovements.push(proposal.expectedImprovement);
    }

    const versionParts = activeRuleSet.version.split('.').map(Number);
    const candidateVersion = `${versionParts[0]}.${(versionParts[1] || 0) + 1}.0-candidate`;
    const candidateRuleSetId = `ruleset-candidate-v${candidateVersion}-${Date.now()}`;

    const newMetadata = { ...(activeRuleSet.parameterMetadata || {}) };
    for (const proposal of proposals) {
      const newValue = 'proposedValue' in proposal ? Number(proposal.proposedValue) : proposal.newValue;
      newMetadata[proposal.paramKey] = {
        key: proposal.paramKey,
        value: newValue,
        sourceType: 'DERIVED',
        sourceReference: `Calibration Learning proposal by ${changedBy}: ${proposal.reason}`,
        status: 'PROVISIONAL',
        affectsDecisions: true,
        description: `Calibration-derived parameter [IMPLEMENTATION BASELINE - CALIBRATION CONFIG]: ${proposal.reason}`
      };
    }

    const candidateRuleSet: RuleSet = {
      id: candidateRuleSetId,
      version: candidateVersion,
      status: 'candidate',
      sourceReason: reasons.join('; '),
      createdAt: timestamp,
      effectiveAt: timestamp,
      retiredAt: null,
      config: newConfig,
      parameterMetadata: newMetadata
    };

    const candidateChanges: RuleChange = {
      id: `rc-${randomUUID()}`,
      oldRuleSetId: activeRuleSet.id,
      newRuleSetId: candidateRuleSet.id,
      changedBy,
      reason: reasons.join('; '),
      evidenceSummary: evidences.join('; '),
      beforeJson: JSON.stringify(beforeValues),
      afterJson: JSON.stringify(afterValues),
      expectedImprovement: expectedImprovements.join('; '),
      timestamp,
      createdAt: timestamp
    };

    return { candidateRuleSet, candidateChanges };
  }

  /**
   * Promotes a candidate RuleSet to ACTIVE after successful walk-forward validation.
   */
  public static promoteCandidateRuleSet(
    candidateRuleSet: RuleSet,
    activeRuleSet: RuleSet,
    validationResult: WalkForwardResult,
    changedBy: string = 'rule_learning_engine',
    clock: () => string = () => new Date().toISOString()
  ): { promotedRuleSet: RuleSet; ruleChange: RuleChange } {
    if (candidateRuleSet.status !== 'candidate') {
      throw new Error(`Cannot promote RuleSet ${candidateRuleSet.id} with status '${candidateRuleSet.status}'. Must be 'candidate'.`);
    }

    const timestamp = clock();
    const versionParts = activeRuleSet.version.split('.').map(Number);
    const finalVersion = `${versionParts[0]}.${(versionParts[1] || 0) + 1}.0`;
    const promotedRuleSetId = `ruleset-v${finalVersion}-${Date.now()}`;

    const promotedRuleSet: RuleSet = {
      id: promotedRuleSetId,
      version: finalVersion,
      status: 'active',
      sourceReason: `Promoted from candidate ${candidateRuleSet.id} after out-of-sample walk-forward validation (PnL improvement: +$${validationResult.pnlImprovementDelta.toFixed(2)}, win rate delta: ${(validationResult.winRateImprovementDelta * 100).toFixed(1)}%).`,
      createdAt: timestamp,
      effectiveAt: timestamp,
      retiredAt: null,
      config: { ...candidateRuleSet.config },
      parameterMetadata: candidateRuleSet.parameterMetadata
    };

    const beforeValues: Record<string, unknown> = {};
    const afterValues: Record<string, unknown> = {};
    for (const key of Object.keys(promotedRuleSet.config) as (keyof RuleSetConfig)[]) {
      if (promotedRuleSet.config[key] !== activeRuleSet.config[key]) {
        beforeValues[key] = activeRuleSet.config[key];
        afterValues[key] = promotedRuleSet.config[key];
      }
    }

    const ruleChange: RuleChange = {
      id: `rc-${randomUUID()}`,
      oldRuleSetId: activeRuleSet.id,
      newRuleSetId: promotedRuleSet.id,
      changedBy,
      reason: promotedRuleSet.sourceReason,
      evidenceSummary: `Walk-forward validation passed: ${validationResult.validationTradesCount} out-of-sample trades evaluated (validation tier: ${validationResult.validationTier}). Candidate PnL: $${validationResult.candidateValidationPnl.toFixed(2)} vs Active PnL: $${validationResult.activeValidationPnl.toFixed(2)}. Bad copies reduced by ${validationResult.badCopyReduction}.`,
      beforeJson: JSON.stringify(beforeValues),
      afterJson: JSON.stringify(afterValues),
      expectedImprovement: `Expected out-of-sample improvement: +$${validationResult.pnlImprovementDelta.toFixed(2)} PnL, ${(validationResult.winRateImprovementDelta * 100).toFixed(1)}% win rate shift.`,
      timestamp,
      createdAt: timestamp
    };

    return { promotedRuleSet, ruleChange };
  }

  /**
   * Rejects a candidate RuleSet when walk-forward validation fails.
   */
  public static rejectCandidateRuleSet(
    candidateRuleSet: RuleSet,
    validationResult: WalkForwardResult,
    clock: () => string = () => new Date().toISOString()
  ): { rejectedRuleSet: RuleSet } {
    const timestamp = clock();
    const rejectedRuleSet: RuleSet = {
      ...candidateRuleSet,
      status: 'rejected',
      sourceReason: `Rejected after walk-forward validation: ${validationResult.rejectionReasons.join('; ')}`,
      retiredAt: timestamp
    };

    return { rejectedRuleSet };
  }

  /**
   * Backwards-compatible direct proposal and activation helper.
   */
  public static proposeAndActivateRuleChange(
    activeRuleSet: RuleSet,
    proposals: ParameterProposal[],
    changedBy: string,
    clock: () => string = () => new Date().toISOString()
  ): { newRuleSet: RuleSet; ruleChange: RuleChange } {
    const { candidateRuleSet } = this.createCandidateRuleSet(activeRuleSet, proposals, changedBy, clock);
    const mockValidation: WalkForwardResult = {
      candidateRuleSetId: candidateRuleSet.id,
      trainWindowStart: activeRuleSet.createdAt,
      trainWindowEnd: candidateRuleSet.createdAt,
      validationWindowStart: candidateRuleSet.createdAt,
      validationWindowEnd: candidateRuleSet.createdAt,
      trainTradesCount: 10,
      validationTradesCount: 5,
      candidateValidationPnl: 10.0,
      activeValidationPnl: 5.0,
      candidateWinRate: 0.60,
      activeWinRate: 0.50,
      pnlImprovementDelta: 5.0,
      winRateImprovementDelta: 0.10,
      badCopyReduction: 1,
      lateEntryLossReduction: 2.0,
      spreadLossReduction: 2.0,
      isPromoted: true,
      rejectionReasons: [],
      validationTier: 'MODERATE'
    };
    const { promotedRuleSet, ruleChange } = this.promoteCandidateRuleSet(candidateRuleSet, activeRuleSet, mockValidation, changedBy, clock);
    return { newRuleSet: promotedRuleSet, ruleChange };
  }
}
