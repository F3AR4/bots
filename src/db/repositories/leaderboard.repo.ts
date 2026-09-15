/**
 * Repository for LeaderboardScan entities.
 */

import { DatabaseSync } from 'node:sqlite';
import { LeaderboardScan, ProvenanceMetadata } from '../../types/domain.js';

export class LeaderboardRepository {
  constructor(private db: DatabaseSync) {}

  public saveScan(scan: LeaderboardScan): void {
    const stmt = this.db.prepare(`
      INSERT INTO leaderboard_scans (id, source, scanned_at, wallet_count, lookback_days, raw_summary_json, provenance_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      scan.id,
      scan.source,
      scan.scannedAt,
      scan.walletCount,
      scan.lookbackDays,
      scan.rawSummaryJson,
      JSON.stringify(scan.provenance),
      scan.createdAt
    );
  }

  public getScanById(id: string): LeaderboardScan | null {
    const stmt = this.db.prepare('SELECT * FROM leaderboard_scans WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listRecentScans(limit = 10): LeaderboardScan[] {
    const stmt = this.db.prepare('SELECT * FROM leaderboard_scans ORDER BY scanned_at DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public getLatestScan(): LeaderboardScan | null {
    const scans = this.listRecentScans(1);
    return scans.length > 0 ? scans[0] : null;
  }

  private mapRow(row: Record<string, unknown>): LeaderboardScan {
    return {
      id: String(row.id),
      source: String(row.source),
      scannedAt: String(row.scanned_at),
      walletCount: Number(row.wallet_count),
      lookbackDays: Number(row.lookback_days),
      rawSummaryJson: String(row.raw_summary_json),
      provenance: JSON.parse(String(row.provenance_json)) as ProvenanceMetadata,
      createdAt: String(row.created_at)
    };
  }
}
