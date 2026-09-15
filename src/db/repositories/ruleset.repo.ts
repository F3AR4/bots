/**
 * Repository for Immutable RuleSets and RuleChange Audits.
 * 
 * Safety Guarantee:
 * - RuleSets are strictly immutable once created.
 * - Modifications require creating a new version linked via RuleChange.
 */

import { DatabaseSync } from 'node:sqlite';
import { RuleSet, RuleSetConfig, RuleChange, ParameterProvenance, RuleSetStatus } from '../../types/domain.js';
import { DEFAULT_RULESET_CONFIG, DEFAULT_RULESET_PARAMETER_METADATA } from '../../config/ruleset.default.js';

export class RuleSetRepository {
  constructor(private db: DatabaseSync) {}

  public saveRuleSet(ruleSet: RuleSet): void {
    const stmt = this.db.prepare(`
      INSERT INTO rule_sets (id, version, status, source_reason, created_at, effective_at, retired_at, config_json, parameter_metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      ruleSet.id,
      ruleSet.version,
      ruleSet.status,
      ruleSet.sourceReason,
      ruleSet.createdAt,
      ruleSet.effectiveAt,
      ruleSet.retiredAt || null,
      JSON.stringify(ruleSet.config),
      ruleSet.parameterMetadata ? JSON.stringify(ruleSet.parameterMetadata) : null
    );
  }

  public getRuleSetById(id: string): RuleSet | null {
    const stmt = this.db.prepare('SELECT * FROM rule_sets WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRowToRuleSet(row);
  }

  public getActiveRuleSet(): RuleSet | null {
    const stmt = this.db.prepare('SELECT * FROM rule_sets WHERE status = ? ORDER BY effective_at DESC LIMIT 1');
    const row = stmt.get('active') as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRowToRuleSet(row);
  }

  public retireRuleSet(id: string, retiredAt: string): void {
    const stmt = this.db.prepare('UPDATE rule_sets SET status = ?, retired_at = ? WHERE id = ?');
    stmt.run('retired', retiredAt, id);
  }

  public updateRuleSetStatus(id: string, status: RuleSetStatus, retiredAt?: string | null): void {
    const stmt = this.db.prepare('UPDATE rule_sets SET status = ?, retired_at = ? WHERE id = ?');
    stmt.run(status, retiredAt || null, id);
  }

  public getCandidateRuleSets(): RuleSet[] {
    const stmt = this.db.prepare('SELECT * FROM rule_sets WHERE status = ? ORDER BY created_at DESC');
    const rows = stmt.all('candidate') as Record<string, unknown>[];
    return rows.map(r => this.mapRowToRuleSet(r));
  }

  public getRejectedRuleSets(): RuleSet[] {
    const stmt = this.db.prepare('SELECT * FROM rule_sets WHERE status = ? ORDER BY created_at DESC');
    const rows = stmt.all('rejected') as Record<string, unknown>[];
    return rows.map(r => this.mapRowToRuleSet(r));
  }

  public saveRuleChange(change: RuleChange): void {
    const stmt = this.db.prepare(`
      INSERT INTO rule_changes (id, old_rule_set_id, new_rule_set_id, changed_by, reason, evidence_summary, before_json, after_json, expected_improvement, timestamp, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      change.id,
      change.oldRuleSetId,
      change.newRuleSetId,
      change.changedBy,
      change.reason,
      change.evidenceSummary,
      change.beforeJson,
      change.afterJson,
      change.expectedImprovement,
      change.timestamp,
      change.createdAt
    );
  }

  public listRuleChanges(): RuleChange[] {
    const stmt = this.db.prepare('SELECT * FROM rule_changes ORDER BY timestamp DESC');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(r => ({
      id: String(r.id),
      oldRuleSetId: String(r.old_rule_set_id),
      newRuleSetId: String(r.new_rule_set_id),
      changedBy: String(r.changed_by),
      reason: String(r.reason),
      evidenceSummary: String(r.evidence_summary),
      beforeJson: String(r.before_json),
      afterJson: String(r.after_json),
      expectedImprovement: String(r.expected_improvement),
      timestamp: String(r.timestamp),
      createdAt: String(r.created_at)
    }));
  }

  public listAllRuleSets(): RuleSet[] {
    const stmt = this.db.prepare('SELECT * FROM rule_sets ORDER BY created_at DESC');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(r => this.mapRowToRuleSet(r));
  }

  private mapRowToRuleSet(row: Record<string, unknown>): RuleSet {
    return {
      id: String(row.id),
      version: String(row.version),
      status: row.status as RuleSetStatus,
      sourceReason: String(row.source_reason),
      createdAt: String(row.created_at),
      effectiveAt: String(row.effective_at),
      retiredAt: row.retired_at ? String(row.retired_at) : null,
      config: { ...DEFAULT_RULESET_CONFIG, ...(JSON.parse(String(row.config_json)) as RuleSetConfig) },
      parameterMetadata: row.parameter_metadata_json
        ? (JSON.parse(String(row.parameter_metadata_json)) as Record<string, ParameterProvenance>)
        : DEFAULT_RULESET_PARAMETER_METADATA
    };
  }
}
