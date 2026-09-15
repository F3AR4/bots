/**
 * PnL Tracker & Mark-to-Market Snapshot Engine.
 * 
 * Implements the hourly position re-marking abstraction specified in the strategy.
 */

import { randomUUID } from 'node:crypto';
import { PaperTrade, PnlSnapshot } from '../types/domain.js';
import { PaperTradingEngine } from './paper-engine.js';

export class PnlTracker {
  /**
   * Generates an hourly snapshot for an open paper trade given current price.
   */
  public static createHourlySnapshot(
    trade: PaperTrade,
    currentPrice: number,
    clock: () => string = () => new Date().toISOString()
  ): { updatedTrade: PaperTrade; snapshot: PnlSnapshot } {
    const timestamp = clock();
    const updatedTrade = PaperTradingEngine.markToMarket(trade, currentPrice, timestamp);

    const snapshot: PnlSnapshot = {
      id: `pnl-${randomUUID()}`,
      paperTradeId: trade.id,
      snapshotHour: timestamp.slice(0, 13) + ':00:00.000Z',
      priceAtSnapshot: currentPrice,
      unrealizedPnl: updatedTrade.unrealizedPnl,
      realizedPnl: updatedTrade.realizedPnl,
      totalPositionValue: Math.round(currentPrice * updatedTrade.shares * 100) / 100,
      capturedAt: timestamp
    };

    return { updatedTrade, snapshot };
  }
}
