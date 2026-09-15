/**
 * Repository for IngestionOperation records.
 * Provides persistence and queries for data-quality audits and operational lifecycle.
 */

import { DatabaseSync } from 'node:sqlite';
import { IngestionOperation, IngestionOperationType, IngestionStatus } from '../../types/domain.js';

export class IngestionRepository {
  constructor(private db: DatabaseSync) {}

  public saveOperation(op: IngestionOperation): void {
    const stmt = this.db.prepare(`
      INSERT INTO ingestion_operations (
        id, operation_type, target_identifier, status, is_live, provider, endpoint,
        requested_window_days, actual_start_timestamp, actual_end_timestamp,
        records_requested, records_received, records_accepted, records_rejected,
        duplicates_count, errors_count, diagnostics_json, started_at, completed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        actual_start_timestamp = excluded.actual_start_timestamp,
        actual_end_timestamp = excluded.actual_end_timestamp,
        records_requested = excluded.records_requested,
        records_received = excluded.records_received,
        records_accepted = excluded.records_accepted,
        records_rejected = excluded.records_rejected,
        duplicates_count = excluded.duplicates_count,
        errors_count = excluded.errors_count,
        diagnostics_json = excluded.diagnostics_json,
        completed_at = excluded.completed_at
    `);

    stmt.run(
      op.id,
      op.operationType,
      op.targetIdentifier,
      op.status,
      op.isLive ? 1 : 0,
      op.provider,
      op.endpoint,
      op.requestedWindowDays,
      op.actualStartTimestamp,
      op.actualEndTimestamp,
      op.recordsRequested,
      op.recordsReceived,
      op.recordsAccepted,
      op.recordsRejected,
      op.duplicatesCount,
      op.errorsCount,
      op.diagnosticsJson,
      op.startedAt,
      op.completedAt,
      op.createdAt
    );
  }

  public getOperationById(id: string): IngestionOperation | null {
    const stmt = this.db.prepare('SELECT * FROM ingestion_operations WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listRecentOperations(limit = 20, type?: IngestionOperationType): IngestionOperation[] {
    let sql = 'SELECT * FROM ingestion_operations';
    const params: (string | number)[] = [];
    if (type) {
      sql += ' WHERE operation_type = ?';
      params.push(type);
    }
    sql += ' ORDER BY started_at DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public getLatestOperation(type?: IngestionOperationType): IngestionOperation | null {
    const list = this.listRecentOperations(1, type);
    return list.length > 0 ? list[0] : null;
  }

  private mapRow(row: Record<string, unknown>): IngestionOperation {
    return {
      id: String(row.id),
      operationType: row.operation_type as IngestionOperationType,
      targetIdentifier: row.target_identifier ? String(row.target_identifier) : null,
      status: row.status as IngestionStatus,
      isLive: Boolean(row.is_live),
      provider: String(row.provider),
      endpoint: row.endpoint ? String(row.endpoint) : null,
      requestedWindowDays: row.requested_window_days !== null ? Number(row.requested_window_days) : null,
      actualStartTimestamp: row.actual_start_timestamp ? String(row.actual_start_timestamp) : null,
      actualEndTimestamp: row.actual_end_timestamp ? String(row.actual_end_timestamp) : null,
      recordsRequested: Number(row.records_requested),
      recordsReceived: Number(row.records_received),
      recordsAccepted: Number(row.records_accepted),
      recordsRejected: Number(row.records_rejected),
      duplicatesCount: Number(row.duplicates_count),
      errorsCount: Number(row.errors_count),
      diagnosticsJson: String(row.diagnostics_json),
      startedAt: String(row.started_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      createdAt: String(row.created_at)
    };
  }
}
