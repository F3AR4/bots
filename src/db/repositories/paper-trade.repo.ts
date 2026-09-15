/**
 * Repository for PaperTrade records.
 * 
 * Safety Guarantee:
 * - execution_mode is permanently constrained to 'PAPER'.
 * - simulated_position_size is strictly bounded between $5.00 and $20.00.
 */

import { DatabaseSync } from 'node:sqlite';
import { PaperTrade, PaperTradeStatus } from '../../types/domain.js';

export class PaperTradeRepository {
  constructor(private db: DatabaseSync) {}

  public insertPaperTrade(trade: PaperTrade): void {
    if (trade.simulatedPositionSize < 5.0 || trade.simulatedPositionSize > 20.0) {
      throw new Error(`Paper trade sizing invariant violated: ${trade.simulatedPositionSize} is outside [$5.00, $20.00] bounds.`);
    }
    if (trade.executionMode !== 'PAPER') {
      throw new Error(`Live execution invariant violated: executionMode must be PAPER, got ${trade.executionMode}.`);
    }

    const stmt = this.db.prepare(`
      INSERT INTO paper_trades (
        id, decision_journal_id, observed_trade_id, wallet_address, market_id,
        condition_id, outcome, side, entry_price, current_price,
        simulated_position_size, shares, unrealized_pnl, realized_pnl,
        status, execution_mode, rule_set_id, opened_at, closed_at, resolved_at,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    stmt.run(
      trade.id,
      trade.decisionJournalId,
      trade.observedTradeId,
      trade.walletAddress,
      trade.marketId,
      trade.conditionId,
      trade.outcome,
      trade.side,
      trade.entryPrice,
      trade.currentPrice,
      trade.simulatedPositionSize,
      trade.shares,
      trade.unrealizedPnl,
      trade.realizedPnl,
      trade.status,
      trade.executionMode,
      trade.ruleSetId,
      trade.openedAt,
      trade.closedAt || null,
      trade.resolvedAt || null,
      trade.createdAt,
      trade.updatedAt
    );
  }

  public updatePaperTrade(trade: PaperTrade): void {
    const stmt = this.db.prepare(`
      UPDATE paper_trades SET
        current_price = ?,
        unrealized_pnl = ?,
        realized_pnl = ?,
        status = ?,
        closed_at = ?,
        resolved_at = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      trade.currentPrice,
      trade.unrealizedPnl,
      trade.realizedPnl,
      trade.status,
      trade.closedAt || null,
      trade.resolvedAt || null,
      trade.updatedAt,
      trade.id
    );
  }

  public getPaperTradeById(id: string): PaperTrade | null {
    const stmt = this.db.prepare('SELECT * FROM paper_trades WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public getPaperTradeByObservedTradeId(observedTradeId: string): PaperTrade | null {
    const stmt = this.db.prepare('SELECT * FROM paper_trades WHERE observed_trade_id = ?');
    const row = stmt.get(observedTradeId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public countPaperTrades(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM paper_trades');
    const row = stmt.get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  }

  public listOpenPaperTrades(): PaperTrade[] {
    const stmt = this.db.prepare("SELECT * FROM paper_trades WHERE status = 'open' ORDER BY opened_at DESC");
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public listAllPaperTrades(limit = 100): PaperTrade[] {
    const stmt = this.db.prepare('SELECT * FROM paper_trades ORDER BY opened_at DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): PaperTrade {
    return {
      id: String(row.id),
      decisionJournalId: String(row.decision_journal_id),
      observedTradeId: String(row.observed_trade_id),
      walletAddress: String(row.wallet_address),
      marketId: String(row.market_id),
      conditionId: String(row.condition_id),
      outcome: String(row.outcome),
      side: row.side as 'BUY' | 'SELL',
      entryPrice: Number(row.entry_price),
      currentPrice: Number(row.current_price),
      simulatedPositionSize: Number(row.simulated_position_size),
      shares: Number(row.shares),
      unrealizedPnl: Number(row.unrealized_pnl),
      realizedPnl: Number(row.realized_pnl),
      status: row.status as PaperTradeStatus,
      executionMode: 'PAPER',
      ruleSetId: String(row.rule_set_id),
      openedAt: String(row.opened_at),
      closedAt: row.closed_at ? String(row.closed_at) : null,
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }
}
