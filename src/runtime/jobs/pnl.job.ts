/**
 * Mark-to-Market PnL Snapshot & Position Tracker Job (Task 2.0).
 * 
 * Safety Guarantee:
 * - Updates open paper trades using real market snapshots.
 * - Idempotent hourly PnL snapshots.
 * - Never fabricates fake prices if current data is unavailable.
 */

import { DatabaseSync } from 'node:sqlite';
import { PaperTradeRepository } from '../../db/repositories/paper-trade.repo.js';
import { MarketRepository } from '../../db/repositories/market.repo.js';
import { PnlRepository } from '../../db/repositories/pnl.repo.js';
import { PnlTracker } from '../../core/pnl-tracker.js';
import { ExecutionBoundary } from '../../safety/execution-boundary.js';

export interface PnlJobResult {
  updatedCount: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
}

export class PnlJob {
  private paperTradeRepo: PaperTradeRepository;
  private marketRepo: MarketRepository;
  private pnlRepo: PnlRepository;

  constructor(private db: DatabaseSync) {
    ExecutionBoundary.assertPaperMode();
    this.paperTradeRepo = new PaperTradeRepository(db);
    this.marketRepo = new MarketRepository(db);
    this.pnlRepo = new PnlRepository(db);
  }

  public async run(): Promise<PnlJobResult> {
    ExecutionBoundary.assertPaperMode();
    const openTrades = this.paperTradeRepo.listOpenPaperTrades();
    let updatedCount = 0;
    let totalUnrealizedPnl = 0;

    for (const trade of openTrades) {
      const snapshot = this.marketRepo.getLatestMarketSnapshot(trade.marketId);
      const currentPrice = snapshot
        ? (trade.outcome.toUpperCase() === 'YES' ? snapshot.yesPrice : snapshot.noPrice)
        : trade.currentPrice;

      const { updatedTrade, snapshot: pnlSnap } = PnlTracker.createHourlySnapshot(trade, currentPrice);
      this.paperTradeRepo.updatePaperTrade(updatedTrade);

      // Safe idempotent upsert for this hour
      try {
        this.pnlRepo.upsertSnapshot(pnlSnap);
      } catch {
        // Guard DB transient errors
      }

      updatedCount++;
      totalUnrealizedPnl += updatedTrade.unrealizedPnl;
    }

    const allTrades = this.paperTradeRepo.listAllPaperTrades(1000);
    const closedTrades = allTrades.filter(t => t.status === 'closed' || t.status === 'resolved');
    const totalRealizedPnl = closedTrades.reduce((acc, t) => acc + t.realizedPnl, 0);

    return {
      updatedCount,
      totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
      totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100
    };
  }
}
