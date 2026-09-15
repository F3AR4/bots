/**
 * Empirical Calibration & Controlled Rule Learning Pipeline.
 * 
 * Safety & Invariant Guarantees:
 * - End-to-end deterministic execution.
 * - Single authority for rule learning within the PAPER trading domain.
 * - Records immutable LearningEvents, RuleSets, and RuleChanges with full parameter provenance.
 * - Historical decisions are NEVER retroactively rewritten.
 */

import { DatabaseSync } from 'node:sqlite';
import {
  RuleSet,
  RuleChange,
  LearningEvent,
  LearningEventStatus,
  FourCohortBenchmarkResult,
  WalkForwardResult,
  RuleLearningConfig,
  CandidateParameterProposal,
  EvidenceTier
} from '../types/domain.js';
import { CalibrationDatasetBuilder } from './calibration-dataset.js';
import { BenchmarkEngine } from './benchmark-engine.js';
import { RuleLearningEngine } from './rule-learning-engine.js';
import { WalkForwardValidator } from './walk-forward-validator.js';
import { LearningBoundary } from './learning-boundary.js';
import { RuleSetRepository } from '../db/repositories/ruleset.repo.js';
import { LearningRepository } from '../db/repositories/learning.repo.js';
import { DEFAULT_RULESET } from '../config/ruleset.default.js';
import { DEFAULT_RULE_LEARNING_CONFIG } from '../config/learning.default.js';
import { ExecutionBoundary } from '../safety/execution-boundary.js';
import { randomUUID } from 'node:crypto';

export interface CalibrationCycleOptions {
  windowStart?: string;
  windowEnd?: string;
  category?: string;
  dryRun?: boolean;
  changedBy?: string;
  config?: RuleLearningConfig;
}

export interface CalibrationCycleResult {
  learningEventId: string;
  status: LearningEventStatus;
  evidenceTier: EvidenceTier;
  sampleCount: number;
  inputRuleSetId: string;
  candidateRuleSetId: string | null;
  outputRuleSetId: string | null;
  cohortResult: FourCohortBenchmarkResult;
  proposedChanges: CandidateParameterProposal[];
  acceptedChanges: CandidateParameterProposal[];
  rejectedChanges: { proposal: CandidateParameterProposal; reason: string }[];
  validationResult: WalkForwardResult | null;
  ruleChange: RuleChange | null;
  summary: string;
  timestamp: string;
}

export class CalibrationPipeline {
  private rulesetRepo: RuleSetRepository;
  private learningRepo: LearningRepository;
  private datasetBuilder: CalibrationDatasetBuilder;
  private learningEngine: RuleLearningEngine;
  private validator: WalkForwardValidator;
  private config: RuleLearningConfig;

  constructor(private db: DatabaseSync, config: RuleLearningConfig = DEFAULT_RULE_LEARNING_CONFIG) {
    ExecutionBoundary.assertPaperMode();
    this.config = config;
    this.rulesetRepo = new RuleSetRepository(db);
    this.learningRepo = new LearningRepository(db);
    this.datasetBuilder = new CalibrationDatasetBuilder(db);
    this.learningEngine = new RuleLearningEngine(config);
    this.validator = new WalkForwardValidator(config);
  }

  /**
   * Executes a deterministic empirical calibration and controlled rule learning cycle.
   */
  public runCalibrationCycle(options: CalibrationCycleOptions = {}): CalibrationCycleResult {
    ExecutionBoundary.assertPaperMode();
    const timestamp = new Date().toISOString();
    const changedBy = options.changedBy || 'autonomous_calibration_pipeline';
    const dryRun = Boolean(options.dryRun);

    // 1. Fetch current active RuleSet
    let activeRuleSet = this.rulesetRepo.getActiveRuleSet();
    if (!activeRuleSet) {
      activeRuleSet = DEFAULT_RULESET;
      if (!dryRun) {
        this.rulesetRepo.saveRuleSet(activeRuleSet);
      }
    }

    // 2. Build deterministic calibration dataset (strictly no look-ahead)
    const dataset = this.datasetBuilder.buildDataset({
      windowStart: options.windowStart,
      windowEnd: options.windowEnd,
      ruleSetId: activeRuleSet.id,
      category: options.category,
      config: this.config
    });

    // 3. Calculate 4-cohort benchmark metrics
    const cohortResult = BenchmarkEngine.evaluateFourCohorts(
      dataset.samples,
      this.config,
      'OBSERVED_EMPIRICAL'
    );

    const eventId = `le-${randomUUID()}`;

    // 4. Handle Insufficient Data
    if (dataset.evidenceTier === 'INSUFFICIENT' || dataset.samples.length < this.config.minEvidenceTradesWeak) {
      const learningEvent: LearningEvent = {
        id: eventId,
        timestamp,
        inputRuleSetId: activeRuleSet.id,
        candidateRuleSetId: null,
        outputRuleSetId: null,
        status: 'INSUFFICIENT_DATA',
        calibrationWindowStart: dataset.windowStart,
        calibrationWindowEnd: dataset.windowEnd,
        trainWindowStart: dataset.windowStart,
        trainWindowEnd: dataset.windowEnd,
        validationWindowStart: dataset.windowEnd,
        validationWindowEnd: dataset.windowEnd,
        observationsCount: dataset.totalObserved,
        excludedObservationsCount: dataset.totalExcluded,
        exclusionsJson: JSON.stringify(dataset.excludedSamples),
        cohortMetricsJson: JSON.stringify(cohortResult),
        proposedChangesJson: '[]',
        acceptedChangesJson: '[]',
        rejectedChangesJson: '[]',
        evidenceTier: dataset.evidenceTier,
        reason: `Insufficient trade observations (${dataset.samples.length} accepted samples vs ${this.config.minEvidenceTradesWeak} minimum floor).`,
        expectedImprovement: 'No adaptation performed; awaiting additional empirical paper trading observations.',
        validationResultJson: null,
        provenanceJson: JSON.stringify({
          executionMode: 'PAPER ONLY',
          calibrationCadence: 'scheduled_batch',
          configProvenance: '[IMPLEMENTATION BASELINE - CALIBRATION CONFIG]'
        }),
        configVersion: 'v1.0.0',
        createdAt: timestamp
      };

      if (!dryRun) {
        this.learningRepo.saveLearningEvent(learningEvent);
      }

      return {
        learningEventId: eventId,
        status: 'INSUFFICIENT_DATA',
        evidenceTier: dataset.evidenceTier,
        sampleCount: dataset.samples.length,
        inputRuleSetId: activeRuleSet.id,
        candidateRuleSetId: null,
        outputRuleSetId: null,
        cohortResult,
        proposedChanges: [],
        acceptedChanges: [],
        rejectedChanges: [],
        validationResult: null,
        ruleChange: null,
        summary: `Insufficient evidence: ${dataset.samples.length} trade samples. No rule changes proposed.`,
        timestamp
      };
    }

    // 5. Gather recently modified parameters for cooldown checks
    const recentEvents = this.learningRepo.listLearningEvents(10);
    const recentModifiedParams = new Set<string>();
    for (const evt of recentEvents) {
      if (evt.status === 'PROMOTED') {
        try {
          const accepted = JSON.parse(evt.acceptedChangesJson) as CandidateParameterProposal[];
          for (const p of accepted) recentModifiedParams.add(p.paramKey);
        } catch {
          // ignore
        }
      }
    }

    // 6. Propose candidate parameter adaptations
    const analysis = this.learningEngine.analyzeAndPropose(
      activeRuleSet,
      dataset,
      cohortResult,
      recentModifiedParams
    );

    if (analysis.proposals.length === 0) {
      const learningEvent: LearningEvent = {
        id: eventId,
        timestamp,
        inputRuleSetId: activeRuleSet.id,
        candidateRuleSetId: null,
        outputRuleSetId: null,
        status: 'NO_CHANGES_NEEDED',
        calibrationWindowStart: dataset.windowStart,
        calibrationWindowEnd: dataset.windowEnd,
        trainWindowStart: dataset.windowStart,
        trainWindowEnd: dataset.windowEnd,
        validationWindowStart: dataset.windowEnd,
        validationWindowEnd: dataset.windowEnd,
        observationsCount: dataset.totalObserved,
        excludedObservationsCount: dataset.totalExcluded,
        exclusionsJson: JSON.stringify(dataset.excludedSamples),
        cohortMetricsJson: JSON.stringify(cohortResult),
        proposedChangesJson: '[]',
        acceptedChangesJson: '[]',
        rejectedChangesJson: JSON.stringify(analysis.rejectedProposals),
        evidenceTier: dataset.evidenceTier,
        reason: 'Current strategy rules are performing within acceptable baseline tolerance. No adaptations triggered.',
        expectedImprovement: 'Active RuleSet retained.',
        validationResultJson: null,
        provenanceJson: JSON.stringify({
          executionMode: 'PAPER ONLY',
          policyDiagnostics: analysis.policyDiagnostics,
          configProvenance: '[IMPLEMENTATION BASELINE - CALIBRATION CONFIG]'
        }),
        configVersion: 'v1.0.0',
        createdAt: timestamp
      };

      if (!dryRun) {
        this.learningRepo.saveLearningEvent(learningEvent);
      }

      return {
        learningEventId: eventId,
        status: 'NO_CHANGES_NEEDED',
        evidenceTier: dataset.evidenceTier,
        sampleCount: dataset.samples.length,
        inputRuleSetId: activeRuleSet.id,
        candidateRuleSetId: null,
        outputRuleSetId: null,
        cohortResult,
        proposedChanges: [],
        acceptedChanges: [],
        rejectedChanges: analysis.rejectedProposals,
        validationResult: null,
        ruleChange: null,
        summary: analysis.summary,
        timestamp
      };
    }

    // 7. Create Candidate RuleSet
    const { candidateRuleSet, candidateChanges } = LearningBoundary.createCandidateRuleSet(
      activeRuleSet,
      analysis.proposals,
      changedBy,
      () => timestamp
    );

    if (!dryRun) {
      this.rulesetRepo.saveRuleSet(candidateRuleSet);
    }

    // 8. Walk-Forward Out-Of-Sample Validation
    const validationResult = this.validator.validate(activeRuleSet, candidateRuleSet, dataset);

    let outputRuleSetId: string | null = null;
    let ruleChangeResult: RuleChange | null = null;
    let eventStatus: LearningEventStatus = 'REJECTED';

    if (validationResult.isPromoted) {
      // 9a. Promotion: Promote candidate to active, mark old as superseded
      eventStatus = 'PROMOTED';
      const { promotedRuleSet, ruleChange } = LearningBoundary.promoteCandidateRuleSet(
        candidateRuleSet,
        activeRuleSet,
        validationResult,
        changedBy,
        () => timestamp
      );

      outputRuleSetId = promotedRuleSet.id;
      ruleChangeResult = ruleChange;

      if (!dryRun) {
        // Save promoted RuleSet
        this.rulesetRepo.saveRuleSet(promotedRuleSet);
        // Retire / Supersede old active RuleSet
        this.rulesetRepo.updateRuleSetStatus(activeRuleSet.id, 'superseded', timestamp);
        // Save immutable RuleChange audit
        this.rulesetRepo.saveRuleChange(ruleChange);
      }
    } else {
      // 9b. Rejection: Mark candidate as rejected (never delete)
      eventStatus = 'REJECTED';
      const { rejectedRuleSet } = LearningBoundary.rejectCandidateRuleSet(
        candidateRuleSet,
        validationResult,
        () => timestamp
      );

      if (!dryRun) {
        this.rulesetRepo.updateRuleSetStatus(candidateRuleSet.id, 'rejected', timestamp);
      }
    }

    // 10. Record Complete Learning Event Audit Record
    const learningEvent: LearningEvent = {
      id: eventId,
      timestamp,
      inputRuleSetId: activeRuleSet.id,
      candidateRuleSetId: candidateRuleSet.id,
      outputRuleSetId,
      status: eventStatus,
      calibrationWindowStart: dataset.windowStart,
      calibrationWindowEnd: dataset.windowEnd,
      trainWindowStart: validationResult.trainWindowStart,
      trainWindowEnd: validationResult.trainWindowEnd,
      validationWindowStart: validationResult.validationWindowStart,
      validationWindowEnd: validationResult.validationWindowEnd,
      observationsCount: dataset.totalObserved,
      excludedObservationsCount: dataset.totalExcluded,
      exclusionsJson: JSON.stringify(dataset.excludedSamples),
      cohortMetricsJson: JSON.stringify(cohortResult),
      proposedChangesJson: JSON.stringify(analysis.proposals),
      acceptedChangesJson: eventStatus === 'PROMOTED' ? JSON.stringify(analysis.proposals) : '[]',
      rejectedChangesJson: eventStatus === 'REJECTED' ? JSON.stringify(analysis.proposals) : '[]',
      evidenceTier: dataset.evidenceTier,
      reason: eventStatus === 'PROMOTED'
        ? `Promoted new RuleSet ${outputRuleSetId}: ${analysis.proposals.map(p => p.reason).join('; ')}`
        : `Candidate RuleSet ${candidateRuleSet.id} rejected: ${validationResult.rejectionReasons.join('; ')}`,
      expectedImprovement: analysis.proposals.map(p => p.expectedImprovement).join('; '),
      validationResultJson: JSON.stringify(validationResult),
      provenanceJson: JSON.stringify({
        executionMode: 'PAPER ONLY',
        policyDiagnostics: analysis.policyDiagnostics,
        changedBy,
        configProvenance: '[IMPLEMENTATION BASELINE - CALIBRATION CONFIG]'
      }),
      configVersion: 'v1.0.0',
      createdAt: timestamp
    };

    if (!dryRun) {
      this.learningRepo.saveLearningEvent(learningEvent);
    }

    const summary = eventStatus === 'PROMOTED'
      ? `Calibration successful: Promoted candidate RuleSet to active ${outputRuleSetId} with ${analysis.proposals.length} parameter update(s). Walk-forward validation passed (+PnL delta: $${validationResult.pnlImprovementDelta.toFixed(2)}).`
      : `Calibration completed: Candidate RuleSet ${candidateRuleSet.id} was rejected by walk-forward validation (${validationResult.rejectionReasons.join('; ')}).`;

    return {
      learningEventId: eventId,
      status: eventStatus,
      evidenceTier: dataset.evidenceTier,
      sampleCount: dataset.samples.length,
      inputRuleSetId: activeRuleSet.id,
      candidateRuleSetId: candidateRuleSet.id,
      outputRuleSetId,
      cohortResult,
      proposedChanges: analysis.proposals,
      acceptedChanges: eventStatus === 'PROMOTED' ? analysis.proposals : [],
      rejectedChanges: analysis.rejectedProposals,
      validationResult,
      ruleChange: ruleChangeResult,
      summary,
      timestamp
    };
  }
}
