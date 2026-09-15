/**
 * CLI Runner for Calibration & Rule Learning Commands (Task 2.1).
 * 
 * Safety Guarantee:
 * - Permanent PAPER ONLY notice displayed.
 * - Distinguishes observed empirical vs historical hypothetical data.
 * - Reports calibration window, RuleSet version, and evidence tier.
 * - Zero live execution or signing capabilities.
 */

import { getDatabaseManager } from '../db/connection.js';
import { CalibrationPipeline } from '../core/calibration-pipeline.js';
import { RuleSetRepository } from '../db/repositories/ruleset.repo.js';
import { LearningRepository } from '../db/repositories/learning.repo.js';
import { ExecutionBoundary } from '../safety/execution-boundary.js';
import { DEFAULT_RULESET } from '../config/ruleset.default.js';

export async function runCalibrateCli(command: string, args: string[] = []): Promise<void> {
  ExecutionBoundary.assertPaperMode();
  const dbManager = getDatabaseManager();
  const db = dbManager.getDatabase();

  const rulesetRepo = new RuleSetRepository(db);
  const learningRepo = new LearningRepository(db);
  const pipeline = new CalibrationPipeline(db);

  console.log('================================================================');
  console.log(' CYBER LAB: EMPIRICAL CALIBRATION & RULE LEARNING (PAPER ONLY)');
  console.log(' Safety Invariant: STRICTLY PAPER ONLY ($5.00 - $20.00 position bounds)');
  console.log('================================================================\n');

  switch (command) {
    case 'calibrate': {
      const isDryRun = args.includes('--dry-run');
      console.log(`[INFO] Executing calibration cycle${isDryRun ? ' (DRY RUN)' : ''}...`);
      const result = pipeline.runCalibrationCycle({
        dryRun: isDryRun,
        changedBy: 'cli_calibrate_runner'
      });

      console.log('\n--- CALIBRATION CYCLE RESULT ---');
      console.log(`Status:              ${result.status}`);
      console.log(`Evidence Tier:       ${result.evidenceTier}`);
      console.log(`Samples Analyzed:    ${result.sampleCount}`);
      console.log(`Input RuleSet:       ${result.inputRuleSetId}`);
      console.log(`Candidate RuleSet:   ${result.candidateRuleSetId || 'None'}`);
      console.log(`Output RuleSet:      ${result.outputRuleSetId || 'None (Active Retained)'}`);
      console.log(`Summary:             ${result.summary}`);

      console.log('\n--- FOUR-COHORT BENCHMARK SUMMARY ---');
      const c = result.cohortResult;
      console.log(`Data Mode:           ${c.dataMode}`);
      console.log(`Paper vs Blind Delta: +$${c.comparisonSummary.paperVsBlindPnlDelta.toFixed(2)}`);
      console.log(`Bad Copy Rate:       ${(c.comparisonSummary.badCopyRate * 100).toFixed(1)}%`);
      console.log(`Good Skip Rate:      ${(c.comparisonSummary.goodSkipRate * 100).toFixed(1)}%`);
      console.log(`Paper Trades PnL:    $${c.paperCopy.totalPnl.toFixed(2)} (${c.paperCopy.sampleCount} trades, win rate: ${c.paperCopy.winRate !== null ? (c.paperCopy.winRate * 100).toFixed(1) + '%' : 'N/A'})`);
      console.log(`Blind Copy PnL:      $${c.blindLeaderboard.totalPnl.toFixed(2)} (${c.blindLeaderboard.sampleCount} trades)`);
      console.log(`Watchlist Trades:    ${c.watchlist.sampleCount} trades (Avoided Loss: $${c.watchlist.avoidedLossValue.toFixed(2)})`);
      console.log(`Skipped Trades:      ${c.skipped.sampleCount} trades (Avoided Loss: $${c.skipped.avoidedLossValue.toFixed(2)})`);

      if (result.proposedChanges.length > 0) {
        console.log('\n--- PROPOSED PARAMETER CHANGES ---');
        for (const p of result.proposedChanges) {
          console.log(`• [${p.policyName}] ${String(p.paramKey)}: ${String(p.beforeValue)} -> ${String(p.proposedValue)}`);
          console.log(`  Reason: ${p.reason}`);
          console.log(`  Expected: ${p.expectedImprovement}`);
        }
      }

      if (result.validationResult) {
        console.log('\n--- WALK-FORWARD VALIDATION ---');
        console.log(`Validation Samples:  ${result.validationResult.validationTradesCount} trades (Tier: ${result.validationResult.validationTier})`);
        console.log(`Candidate PnL:       $${result.validationResult.candidateValidationPnl.toFixed(2)}`);
        console.log(`Active PnL:          $${result.validationResult.activeValidationPnl.toFixed(2)}`);
        console.log(`PnL Improvement:     +$${result.validationResult.pnlImprovementDelta.toFixed(2)}`);
        console.log(`Promoted to Active:  ${result.validationResult.isPromoted ? 'YES (PROMOTED)' : 'NO (REJECTED)'}`);
        if (!result.validationResult.isPromoted) {
          console.log(`Rejection Reasons:   ${result.validationResult.rejectionReasons.join('; ')}`);
        }
      }
      break;
    }

    case 'calibrate:report': {
      const latestEvent = learningRepo.getLatestLearningEvent();
      const activeRuleSet = rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;
      console.log(`Active RuleSet:      ${activeRuleSet.version} (${activeRuleSet.id})`);
      console.log(`Status:              ${activeRuleSet.status}`);
      console.log(`Effective At:        ${activeRuleSet.effectiveAt}`);
      console.log(`Total Cycles Run:    ${learningRepo.countLearningEvents()}`);

      if (latestEvent) {
        console.log('\n--- LATEST LEARNING EVENT ---');
        console.log(`Event ID:            ${latestEvent.id}`);
        console.log(`Timestamp:           ${latestEvent.timestamp}`);
        console.log(`Status:              ${latestEvent.status}`);
        console.log(`Evidence Tier:       ${latestEvent.evidenceTier}`);
        console.log(`Reason:              ${latestEvent.reason}`);
        console.log(`Expected Imp.:       ${latestEvent.expectedImprovement}`);
      } else {
        console.log('\nNo calibration events recorded yet.');
      }
      break;
    }

    case 'rules:history': {
      const allRulesets = rulesetRepo.listAllRuleSets();
      const changes = rulesetRepo.listRuleChanges();
      console.log(`Total RuleSet Versions: ${allRulesets.length}`);
      console.log('\n--- RULESET VERSION LINEAGE ---');
      for (const r of allRulesets) {
        console.log(`• [${r.status.toUpperCase()}] Version ${r.version} (${r.id})`);
        console.log(`  Effective: ${r.effectiveAt} | Created: ${r.createdAt}`);
        console.log(`  Source Reason: ${r.sourceReason}`);
      }

      if (changes.length > 0) {
        console.log('\n--- AUDITED RULE CHANGES ---');
        for (const c of changes) {
          console.log(`• Change ${c.id}: ${c.oldRuleSetId} -> ${c.newRuleSetId}`);
          console.log(`  Changed By: ${c.changedBy} at ${c.timestamp}`);
          console.log(`  Reason: ${c.reason}`);
          console.log(`  Evidence: ${c.evidenceSummary}`);
          console.log(`  Expected Improvement: ${c.expectedImprovement}`);
        }
      }
      break;
    }

    case 'rules:candidates': {
      const candidates = rulesetRepo.getCandidateRuleSets();
      const rejected = rulesetRepo.getRejectedRuleSets();
      console.log(`Candidate RuleSets: ${candidates.length}`);
      console.log(`Rejected RuleSets:  ${rejected.length}`);

      if (candidates.length > 0) {
        console.log('\n--- ACTIVE CANDIDATES ---');
        for (const c of candidates) {
          console.log(`• Candidate ${c.version} (${c.id})`);
          console.log(`  Created: ${c.createdAt} | Reason: ${c.sourceReason}`);
        }
      }

      if (rejected.length > 0) {
        console.log('\n--- REJECTED CANDIDATES ---');
        for (const r of rejected) {
          console.log(`• Rejected ${r.version} (${r.id})`);
          console.log(`  Retired At: ${r.retiredAt} | Reason: ${r.sourceReason}`);
        }
      }
      break;
    }

    default:
      console.log(`Unknown calibration command: ${command}`);
      console.log('Available commands: calibrate, calibrate:report, rules:history, rules:candidates');
  }
}

// Direct execution from CLI
if (process.argv[1] && process.argv[1].endsWith('calibrate-runner.ts')) {
  const cmd = process.argv[2] || 'calibrate';
  const args = process.argv.slice(3);
  runCalibrateCli(cmd, args).catch(err => {
    console.error(`[ERROR] Calibration command failed: ${(err as Error).message}`);
    process.exit(1);
  });
}
