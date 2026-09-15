/**
 * Polymarket Copy-Trading Research & Paper System.
 * Main Entry Point.
 * 
 * Invariant: PAPER ONLY.
 */

import { ExecutionBoundary } from './safety/execution-boundary.js';
import { getDatabaseManager } from './db/connection.js';
import { RuleSetRepository } from './db/repositories/ruleset.repo.js';
import { DEFAULT_RULESET } from './config/ruleset.default.js';

export * from './types/domain.js';
export * from './types/scoring.js';
export * from './types/adapters.js';
export * from './core/wallet-scorer.js';
export * from './core/trade-scorer.js';
export * from './core/paper-engine.js';
export * from './core/pnl-tracker.js';
export * from './core/outcome-reviewer.js';
export * from './core/benchmark-engine.js';
export * from './core/learning-boundary.js';
export * from './core/replay-harness.js';
export * from './safety/execution-boundary.js';
export * from './safety/secret-sanitizer.js';

export function initializeSystem(): void {
  ExecutionBoundary.assertPaperMode();
  const db = getDatabaseManager().getDatabase();
  const rulesetRepo = new RuleSetRepository(db);

  if (!rulesetRepo.getRuleSetById(DEFAULT_RULESET.id)) {
    rulesetRepo.saveRuleSet(DEFAULT_RULESET);
  }

  console.log('====================================================');
  console.log('Polymarket Copy-Trading Research & Paper System');
  console.log('Execution Mode: PAPER ONLY');
  console.log(`Active RuleSet: ${DEFAULT_RULESET.version}`);
  console.log('Hard Barrier: No live orders, private keys, or signing.');
  console.log('====================================================');
}

if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  initializeSystem();
}
