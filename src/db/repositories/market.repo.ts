/**
 * Repository for MarketSnapshot entities.
 */

import { DatabaseSync } from 'node:sqlite';
import { MarketSnapshot, ProvenanceMetadata } from '../../types/domain.js';

export class MarketRepository {
  constructor(private db: DatabaseSync) {}

  public insertSnapshot(snapshot: MarketSnapshot): void {
    const stmt = this.db.prepare(`
      INSERT INTO market_snapshots (
        id, market_id, condition_id, question, category, yes_price, no_price,
        best_bid, best_ask, spread, liquidity, volume, time_to_resolution,
        collected_at, raw_market_json, provenance_json, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    stmt.run(
      snapshot.id,
      snapshot.marketId,
      snapshot.conditionId,
      snapshot.question,
      snapshot.category,
      snapshot.yesPrice,
      snapshot.noPrice,
      snapshot.bestBid,
      snapshot.bestAsk,
      snapshot.spread,
      snapshot.liquidity,
      snapshot.volume,
      snapshot.timeToResolution,
      snapshot.collectedAt,
      snapshot.rawMarketJson,
      JSON.stringify(snapshot.provenance),
      snapshot.createdAt
    );
  }

  public getLatestMarketSnapshot(marketId: string): MarketSnapshot | null {
    const stmt = this.db.prepare('SELECT * FROM market_snapshots WHERE market_id = ? ORDER BY collected_at DESC LIMIT 1');
    const row = stmt.get(marketId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listRecentSnapshots(limit = 10): MarketSnapshot[] {
    const stmt = this.db.prepare('SELECT * FROM market_snapshots ORDER BY collected_at DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public getLatestSnapshotsForMarkets(marketIds: string[]): Map<string, MarketSnapshot> {
    const map = new Map<string, MarketSnapshot>();
    if (marketIds.length === 0) return map;
    const placeholders = marketIds.map(() => '?').join(',');
    // Select latest snapshot for each marketId
    const sql = `
      SELECT * FROM market_snapshots
      WHERE id IN (
        SELECT id FROM market_snapshots
        WHERE market_id IN (${placeholders})
        GROUP BY market_id
        HAVING MAX(collected_at)
      )
    `;
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...marketIds) as Record<string, unknown>[];
    for (const r of rows) {
      const snap = this.mapRow(r);
      map.set(snap.marketId, snap);
    }
    return map;
  }

  private mapRow(row: Record<string, unknown>): MarketSnapshot {
    return {
      id: String(row.id),
      marketId: String(row.market_id),
      conditionId: String(row.condition_id),
      question: String(row.question),
      category: String(row.category),
      yesPrice: Number(row.yes_price),
      noPrice: Number(row.no_price),
      bestBid: Number(row.best_bid),
      bestAsk: Number(row.best_ask),
      spread: Number(row.spread),
      liquidity: Number(row.liquidity),
      volume: Number(row.volume),
      timeToResolution: Number(row.time_to_resolution),
      collectedAt: String(row.collected_at),
      rawMarketJson: String(row.raw_market_json),
      provenance: JSON.parse(String(row.provenance_json)) as ProvenanceMetadata,
      createdAt: String(row.created_at)
    };
  }
}
