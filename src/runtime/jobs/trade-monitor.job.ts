/**
 * Trade Monitor Job (Task 2.0).
 * 
 * Safety Guarantee:
 * - Detects new trade events from tracked wallets.
 * - Deterministic scoring and copyability evaluation.
 * - Idempotent DecisionJournal entries and $5.00 - $20.00 bounded PaperTrades.
 * - Zero live order placement or transaction submission.
 */

import { DatabaseSync } from 'node:sqlite';
import { WalletTradeMonitor, PollCycleResult } from '../../core/wallet-trade-monitor.js';
import { WalletRepository } from '../../db/repositories/wallet.repo.js';
import { TradeRepository } from '../../db/repositories/trade.repo.js';
import { MarketRepository } from '../../db/repositories/market.repo.js';
import { DecisionRepository } from '../../db/repositories/decision.repo.js';
import { PaperTradeRepository } from '../../db/repositories/paper-trade.repo.js';
import { DetectedTradeRepository } from '../../db/repositories/detected-trade.repo.js';
import { RuleSetRepository } from '../../db/repositories/ruleset.repo.js';
import { PolymarketWalletActivityAdapter } from '../../adapters/wallet-activity.adapter.js';
import { DEFAULT_RULESET } from '../../config/ruleset.default.js';
import { DEFAULT_PROVIDER_CONFIG } from '../../config/provider.config.js';
import { ExecutionBoundary } from '../../safety/execution-boundary.js';

export class TradeMonitorJob {
  private monitor: WalletTradeMonitor;

  constructor(
    private db: DatabaseSync,
    private mode: 'live' | 'fixture' = 'fixture',
    private topLimit = 500
  ) {
    ExecutionBoundary.assertPaperMode();
    const walletRepo = new WalletRepository(db);
    const tradeRepo = new TradeRepository(db);
    const marketRepo = new MarketRepository(db);
    const decisionRepo = new DecisionRepository(db);
    const paperTradeRepo = new PaperTradeRepository(db);
    const detectedTradeRepo = new DetectedTradeRepository(db);
    const rulesetRepo = new RuleSetRepository(db);
    const ruleSet = rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;

    const adapter = mode === 'live' ? new PolymarketWalletActivityAdapter(DEFAULT_PROVIDER_CONFIG) : undefined;

    this.monitor = new WalletTradeMonitor(
      db,
      walletRepo,
      tradeRepo,
      marketRepo,
      decisionRepo,
      paperTradeRepo,
      detectedTradeRepo,
      ruleSet,
      adapter
    );
  }

  public getMonitor(): WalletTradeMonitor {
    return this.monitor;
  }

  public async run(): Promise<PollCycleResult> {
    ExecutionBoundary.assertPaperMode();
    const result = await this.monitor.pollOnce({ topLimit: this.topLimit });
    if (result.errors.length > 0 && result.tradesReceived === 0 && this.mode === 'live') {
      throw new Error(`Trade monitor encountered errors: ${result.errors.join('; ')}`);
    }
    return result;
  }
}
