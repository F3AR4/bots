/**
 * Repository for PnlSnapshot entities (hourly mark-to-market valuations).
 */

import { DatabaseSync } from 'node:sqlite';
import { PnlSnapshot } from '../../types/domain.js';

export class PnlRepository {
  constructor(private db: DatabaseSync) {}

  public insertSnapshot(snapshot: PnlSnapshot): void {
    const stmt = this.db.prepare(`
      INSERT INTO pnl_snapshots (id, paper_trade_id, snapshot_hour, price_at_snapshot, unrealized_pnl, realized_pnl, total_position_value, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.id,
      snapshot.paperTradeId,
      snapshot.snapshotHour,
      snapshot.priceAtSnapshot,
      snapshot.unrealizedPnl,
      snapshot.realizedPnl,
      snapshot.totalPositionValue,
      snapshot.capturedAt
    );
  }

  public hasSnapshotForHour(paperTradeId: string, snapshotHour: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM pnl_snapshots WHERE paper_trade_id = ? AND snapshot_hour = ?');
    const row = stmt.get(paperTradeId, snapshotHour);
    return Boolean(row);
  }

  public upsertSnapshot(snapshot: PnlSnapshot): void {
    if (this.hasSnapshotForHour(snapshot.paperTradeId, snapshot.snapshotHour)) {
      const stmt = this.db.prepare(`
        UPDATE pnl_snapshots
        SET price_at_snapshot = ?, unrealized_pnl = ?, realized_pnl = ?, total_position_value = ?, captured_at = ?
        WHERE paper_trade_id = ? AND snapshot_hour = ?
      `);
      stmt.run(
        snapshot.priceAtSnapshot,
        snapshot.unrealizedPnl,
        snapshot.realizedPnl,
        snapshot.totalPositionValue,
        snapshot.capturedAt,
        snapshot.paperTradeId,
        snapshot.snapshotHour
      );
    } else {
      this.insertSnapshot(snapshot);
    }
  }

  public getSnapshotsForTrade(paperTradeId: string): PnlSnapshot[] {
    const stmt = this.db.prepare('SELECT * FROM pnl_snapshots WHERE paper_trade_id = ? ORDER BY captured_at ASC');
    const rows = stmt.all(paperTradeId) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public getLatestSnapshots(limit = 100): PnlSnapshot[] {
    const stmt = this.db.prepare('SELECT * FROM pnl_snapshots ORDER BY captured_at DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): PnlSnapshot {
    return {
      id: String(row.id),
      paperTradeId: String(row.paper_trade_id),
      snapshotHour: String(row.snapshot_hour),
      priceAtSnapshot: Number(row.price_at_snapshot),
      unrealizedPnl: Number(row.unrealized_pnl),
      realizedPnl: Number(row.realized_pnl),
      totalPositionValue: Number(row.total_position_value),
      capturedAt: String(row.captured_at)
    };
  }
}
