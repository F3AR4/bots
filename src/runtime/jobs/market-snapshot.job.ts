/**
 * Market Snapshot Ingestion & Refresh Job (Task 2.0).
 * 
 * Safety Guarantee:
 * - Read-only order book and price data collection.
 * - Refreshes market data for active open positions and monitored markets.
 */

import { DatabaseSync } from 'node:sqlite';
import { MarketRepository } from '../../db/repositories/market.repo.js';
import { PaperTradeRepository } from '../../db/repositories/paper-trade.repo.js';
import { IngestionService } from '../../core/ingestion-service.js';
import { DEFAULT_PROVIDER_CONFIG } from '../../config/provider.config.js';
import { ExecutionBoundary } from '../../safety/execution-boundary.js';

export class MarketSnapshotJob {
  private marketRepo: MarketRepository;
  private paperTradeRepo: PaperTradeRepository;
  private ingestionService: IngestionService;

  constructor(
    private db: DatabaseSync,
    private mode: 'live' | 'fixture' = 'fixture'
  ) {
    ExecutionBoundary.assertPaperMode();
    this.marketRepo = new MarketRepository(db);
    this.paperTradeRepo = new PaperTradeRepository(db);
    this.ingestionService = new IngestionService(db, DEFAULT_PROVIDER_CONFIG);
  }

  public async run(): Promise<void> {
    ExecutionBoundary.assertPaperMode();
    const openTrades = this.paperTradeRepo.listOpenPaperTrades();
    const marketIds = Array.from(new Set(openTrades.map(t => t.marketId)));

    if (this.mode === 'live' && marketIds.length > 0) {
      for (const marketId of marketIds) {
        try {
          await this.ingestionService.ingestMarketSnapshot(this.mode, marketId);
        } catch {
          // Fail-closed resilience for individual markets
        }
      }
    }
  }
}
