/**
 * Wallet Intelligence & Research Pipeline Job (Task 2.0).
 * 
 * Safety Guarantee:
 * - Read-only wallet activity ingestion.
 * - Deterministic scoring and ranking against immutable RuleSet.
 */

import { DatabaseSync } from 'node:sqlite';
import { WalletRepository } from '../../db/repositories/wallet.repo.js';
import { RuleSetRepository } from '../../db/repositories/ruleset.repo.js';
import { IngestionService } from '../../core/ingestion-service.js';
import { WalletResearchPipeline } from '../../core/wallet-research-pipeline.js';
import { DEFAULT_RULESET } from '../../config/ruleset.default.js';
import { DEFAULT_PROVIDER_CONFIG } from '../../config/provider.config.js';
import { ExecutionBoundary } from '../../safety/execution-boundary.js';

export class WalletScanJob {
  private walletRepo: WalletRepository;
  private rulesetRepo: RuleSetRepository;
  private ingestionService: IngestionService;
  private pipeline: WalletResearchPipeline;

  constructor(
    private db: DatabaseSync,
    private mode: 'live' | 'fixture' = 'fixture',
    private lookbackDays = 30,
    private targetLimit = 50
  ) {
    ExecutionBoundary.assertPaperMode();
    this.walletRepo = new WalletRepository(db);
    this.rulesetRepo = new RuleSetRepository(db);
    this.ingestionService = new IngestionService(db, DEFAULT_PROVIDER_CONFIG);
    this.pipeline = new WalletResearchPipeline(db);
  }

  public async run(): Promise<void> {
    ExecutionBoundary.assertPaperMode();
    const activeRuleSet = this.rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;
    const topWallets = this.walletRepo.listTopWallets(this.targetLimit);
    const addresses = topWallets.map(w => w.address);

    // If live mode, fetch fresh wallet activity
    if (this.mode === 'live' && addresses.length > 0) {
      const ingResult = await this.ingestionService.ingestWalletActivity(
        this.mode,
        addresses,
        this.lookbackDays
      );
      if (ingResult.status === 'failed') {
        throw new Error(`Wallet activity ingestion failed: ${ingResult.errorsCount} errors`);
      }
    }

    // Run Research Pipeline
    await this.pipeline.executePipeline({
      ruleSet: activeRuleSet,
      lookbackDays: this.lookbackDays,
      targetPopulation: addresses.length > 0 ? addresses.length : this.targetLimit
    });
  }
}
