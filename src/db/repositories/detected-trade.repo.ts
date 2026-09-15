/**
 * Repository for DetectedTradeEvent records (Task 1.6).
 * 
 * Safety & Invariant Guarantees:
 * - Every detection is recorded immutably with exact detection latency and data source.
 * - Idempotency: observed_trade_id is UNIQUE.
 */

import { DatabaseSync } from 'node:sqlite';
import { DetectedTradeEvent } from '../../types/domain.js';

export class DetectedTradeRepository {
  constructor(private db: DatabaseSync) {}

  public insertDetectedTrade(event: DetectedTradeEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO detected_trade_events (
        id, observed_trade_id, wallet_address, market_id,
        detected_at, source_timestamp, detection_latency_ms,
        data_source, normalization_version, processed, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id,
      event.observedTradeId,
      event.walletAddress,
      event.marketId,
      event.detectedAt,
      event.sourceTimestamp,
      event.detectionLatencyMs,
      event.dataSource,
      event.normalizationVersion,
      event.processed ? 1 : 0,
      event.createdAt
    );
  }

  public markProcessed(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE detected_trade_events
      SET processed = 1
      WHERE id = ?
    `);
    stmt.run(id);
  }

  public getDetectedTradeById(id: string): DetectedTradeEvent | null {
    const stmt = this.db.prepare('SELECT * FROM detected_trade_events WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public getDetectedTradeByObservedTradeId(observedTradeId: string): DetectedTradeEvent | null {
    const stmt = this.db.prepare('SELECT * FROM detected_trade_events WHERE observed_trade_id = ?');
    const row = stmt.get(observedTradeId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listRecentDetections(limit = 50): DetectedTradeEvent[] {
    const stmt = this.db.prepare('SELECT * FROM detected_trade_events ORDER BY detected_at DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public listUnprocessedDetections(): DetectedTradeEvent[] {
    const stmt = this.db.prepare('SELECT * FROM detected_trade_events WHERE processed = 0 ORDER BY detected_at ASC');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public countDetections(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM detected_trade_events');
    const row = stmt.get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  }

  private mapRow(row: Record<string, unknown>): DetectedTradeEvent {
    return {
      id: String(row.id),
      observedTradeId: String(row.observed_trade_id),
      walletAddress: String(row.wallet_address),
      marketId: String(row.market_id),
      detectedAt: String(row.detected_at),
      sourceTimestamp: String(row.source_timestamp),
      detectionLatencyMs: Number(row.detection_latency_ms),
      dataSource: String(row.data_source),
      normalizationVersion: String(row.normalization_version),
      processed: Boolean(row.processed),
      createdAt: String(row.created_at)
    };
  }
}
