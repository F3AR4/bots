/**
 * Repository for ObservedTrade entities with idempotency and deduplication.
 */

import { DatabaseSync } from 'node:sqlite';
import { ObservedTrade, ProvenanceMetadata } from '../../types/domain.js';

export class TradeRepository {
  constructor(private db: DatabaseSync) {}

  public insertObservedTrade(trade: ObservedTrade): boolean {
    // If trade has sourceTxHash, check for duplicate first or use INSERT OR IGNORE
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO observed_trades (
        id, wallet_address, market_id, condition_id, market_question, market_category,
        outcome, side, wallet_entry_price, detected_price, size, source_tx_hash,
        source_timestamp, raw_trade_json, provenance_json, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      trade.id,
      trade.walletAddress,
      trade.marketId,
      trade.conditionId,
      trade.marketQuestion,
      trade.marketCategory,
      trade.outcome,
      trade.side,
      trade.walletEntryPrice,
      trade.detectedPrice,
      trade.size,
      trade.sourceTxHash || null,
      trade.sourceTimestamp,
      trade.rawTradeJson,
      JSON.stringify(trade.provenance),
      trade.createdAt
    );

    return (result.changes ?? 0) > 0;
  }

  public getObservedTradeById(id: string): ObservedTrade | null {
    const stmt = this.db.prepare('SELECT * FROM observed_trades WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByTxHash(txHash: string): ObservedTrade | null {
    const stmt = this.db.prepare('SELECT * FROM observed_trades WHERE source_tx_hash = ?');
    const row = stmt.get(txHash) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listRecentTrades(limit = 50): ObservedTrade[] {
    const stmt = this.db.prepare('SELECT * FROM observed_trades ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public listTradesForWallet(walletAddress: string, limit = 50): ObservedTrade[] {
    const stmt = this.db.prepare('SELECT * FROM observed_trades WHERE wallet_address = ? ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(walletAddress, limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public listTradesForWallets(walletAddresses: string[], sinceTimestamp?: string): ObservedTrade[] {
    if (walletAddresses.length === 0) return [];
    const placeholders = walletAddresses.map(() => '?').join(',');
    let sql = `SELECT * FROM observed_trades WHERE wallet_address IN (${placeholders})`;
    const params: (string | number)[] = [...walletAddresses];
    if (sinceTimestamp) {
      sql += ' AND source_timestamp >= ?';
      params.push(sinceTimestamp);
    }
    sql += ' ORDER BY source_timestamp ASC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public listUnprocessedTrades(limit = 100): ObservedTrade[] {
    const stmt = this.db.prepare(`
      SELECT ot.* FROM observed_trades ot
      LEFT JOIN decision_journals dj ON ot.id = dj.observed_trade_id
      WHERE dj.id IS NULL
      ORDER BY ot.source_timestamp ASC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): ObservedTrade {
    return {
      id: String(row.id),
      walletAddress: String(row.wallet_address),
      marketId: String(row.market_id),
      conditionId: String(row.condition_id),
      marketQuestion: String(row.market_question),
      marketCategory: String(row.market_category),
      outcome: String(row.outcome),
      side: row.side as 'BUY' | 'SELL',
      walletEntryPrice: Number(row.wallet_entry_price),
      detectedPrice: Number(row.detected_price),
      size: Number(row.size),
      sourceTxHash: row.source_tx_hash ? String(row.source_tx_hash) : undefined,
      sourceTimestamp: String(row.source_timestamp),
      rawTradeJson: String(row.raw_trade_json),
      provenance: JSON.parse(String(row.provenance_json)) as ProvenanceMetadata,
      createdAt: String(row.created_at)
    };
  }
}
