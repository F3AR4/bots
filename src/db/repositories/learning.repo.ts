/**
 * Repository for Learning Events & Calibration Audits.
 * 
 * Safety Guarantee:
 * - LearningEvents are immutable audit artifacts.
 * - Records full provenance, training/validation windows, and accepted/rejected changes.
 */

import { DatabaseSync } from 'node:sqlite';
import { LearningEvent, LearningEventStatus, EvidenceTier } from '../../types/domain.js';

export class LearningRepository {
  constructor(private db: DatabaseSync) {}

  public saveLearningEvent(event: LearningEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO learning_events (
        id, timestamp, input_ruleset_id, candidate_ruleset_id, output_ruleset_id,
        status, calibration_window_start, calibration_window_end,
        train_window_start, train_window_end, validation_window_start, validation_window_end,
        observations_count, excluded_observations_count, exclusions_json,
        cohort_metrics_json, proposed_changes_json, accepted_changes_json, rejected_changes_json,
        evidence_tier, reason, expected_improvement, validation_result_json,
        provenance_json, config_version, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    stmt.run(
      event.id,
      event.timestamp,
      event.inputRuleSetId,
      event.candidateRuleSetId || null,
      event.outputRuleSetId || null,
      event.status,
      event.calibrationWindowStart,
      event.calibrationWindowEnd,
      event.trainWindowStart,
      event.trainWindowEnd,
      event.validationWindowStart,
      event.validationWindowEnd,
      event.observationsCount,
      event.excludedObservationsCount,
      event.exclusionsJson,
      event.cohortMetricsJson,
      event.proposedChangesJson,
      event.acceptedChangesJson,
      event.rejectedChangesJson,
      event.evidenceTier,
      event.reason,
      event.expectedImprovement,
      event.validationResultJson || null,
      event.provenanceJson,
      event.configVersion,
      event.createdAt
    );
  }

  public getLearningEventById(id: string): LearningEvent | null {
    const stmt = this.db.prepare('SELECT * FROM learning_events WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRowToLearningEvent(row);
  }

  public getLatestLearningEvent(): LearningEvent | null {
    const stmt = this.db.prepare('SELECT * FROM learning_events ORDER BY timestamp DESC LIMIT 1');
    const row = stmt.get() as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRowToLearningEvent(row);
  }

  public listLearningEvents(limit = 50): LearningEvent[] {
    const stmt = this.db.prepare('SELECT * FROM learning_events ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRowToLearningEvent(r));
  }

  public listLearningEventsByStatus(status: LearningEventStatus, limit = 50): LearningEvent[] {
    const stmt = this.db.prepare('SELECT * FROM learning_events WHERE status = ? ORDER BY timestamp DESC LIMIT ?');
    const rows = stmt.all(status, limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRowToLearningEvent(r));
  }

  public countLearningEvents(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM learning_events');
    const row = stmt.get() as { count: number } | undefined;
    return row?.count || 0;
  }

  private mapRowToLearningEvent(row: Record<string, unknown>): LearningEvent {
    return {
      id: String(row.id),
      timestamp: String(row.timestamp),
      inputRuleSetId: String(row.input_ruleset_id),
      candidateRuleSetId: row.candidate_ruleset_id ? String(row.candidate_ruleset_id) : null,
      outputRuleSetId: row.output_ruleset_id ? String(row.output_ruleset_id) : null,
      status: row.status as LearningEventStatus,
      calibrationWindowStart: String(row.calibration_window_start),
      calibrationWindowEnd: String(row.calibration_window_end),
      trainWindowStart: String(row.train_window_start),
      trainWindowEnd: String(row.train_window_end),
      validationWindowStart: String(row.validation_window_start),
      validationWindowEnd: String(row.validation_window_end),
      observationsCount: Number(row.observations_count),
      excludedObservationsCount: Number(row.excluded_observations_count),
      exclusionsJson: String(row.exclusions_json),
      cohortMetricsJson: String(row.cohort_metrics_json),
      proposedChangesJson: String(row.proposed_changes_json),
      acceptedChangesJson: String(row.accepted_changes_json),
      rejectedChangesJson: String(row.rejected_changes_json),
      evidenceTier: row.evidence_tier as EvidenceTier,
      reason: String(row.reason),
      expectedImprovement: String(row.expected_improvement),
      validationResultJson: row.validation_result_json ? String(row.validation_result_json) : null,
      provenanceJson: String(row.provenance_json),
      configVersion: String(row.config_version),
      createdAt: String(row.created_at)
    };
  }
}
