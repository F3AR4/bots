/**
 * Repository for DecisionJournal entries (immutable audit trail).
 */

import { DatabaseSync } from 'node:sqlite';
import { DecisionJournal, TradeDecisionType } from '../../types/domain.js';

export class DecisionRepository {
  constructor(private db: DatabaseSync) {}

  public insertDecision(journal: DecisionJournal): void {
    const stmt = this.db.prepare(`
      INSERT INTO decision_journals (
        id, observed_trade_id, market_snapshot_id, wallet_address, market_id, decision,
        copy_score, confidence, reasons_json, risks_json,
        wallet_quality_score, roi_score, consistency_score, copyability_score,
        category_fit_score, entry_timing_score, spread_score, liquidity_score, thesis_score,
        simulated_position_size, rule_set_id, rule_version, evaluated_at, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      journal.id,
      journal.observedTradeId,
      journal.marketSnapshotId,
      journal.walletAddress,
      journal.marketId,
      journal.decision,
      journal.copyScore,
      journal.confidence || null,
      journal.reasonsJson,
      journal.risksJson,
      journal.walletQualityScore,
      journal.roiScore,
      journal.consistencyScore,
      journal.copyabilityScore,
      journal.categoryFitScore,
      journal.entryTimingScore,
      journal.spreadScore,
      journal.liquidityScore,
      journal.thesisScore,
      journal.simulatedPositionSize,
      journal.ruleSetId,
      journal.ruleVersion,
      journal.evaluatedAt,
      journal.createdAt
    );
  }

  public getDecisionById(id: string): DecisionJournal | null {
    const stmt = this.db.prepare('SELECT * FROM decision_journals WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public getDecisionByTradeId(tradeId: string): DecisionJournal | null {
    const stmt = this.db.prepare('SELECT * FROM decision_journals WHERE observed_trade_id = ?');
    const row = stmt.get(tradeId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public hasDecisionForTrade(observedTradeId: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM decision_journals WHERE observed_trade_id = ? LIMIT 1');
    return stmt.get(observedTradeId) !== undefined;
  }

  public countDecisions(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM decision_journals');
    const row = stmt.get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  }

  public listRecentDecisions(limit = 50): DecisionJournal[] {
    const stmt = this.db.prepare('SELECT * FROM decision_journals ORDER BY evaluated_at DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public listDecisionsByVerdict(decision: TradeDecisionType, limit = 50): DecisionJournal[] {
    const stmt = this.db.prepare('SELECT * FROM decision_journals WHERE decision = ? ORDER BY evaluated_at DESC LIMIT ?');
    const rows = stmt.all(decision, limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): DecisionJournal {
    return {
      id: String(row.id),
      observedTradeId: String(row.observed_trade_id),
      marketSnapshotId: String(row.market_snapshot_id || ''),
      walletAddress: String(row.wallet_address),
      marketId: String(row.market_id),
      decision: row.decision as TradeDecisionType,
      copyScore: Number(row.copy_score),
      confidence: row.confidence !== null ? Number(row.confidence) : null,
      reasonsJson: String(row.reasons_json),
      risksJson: String(row.risks_json),
      walletQualityScore: Number(row.wallet_quality_score),
      roiScore: Number(row.roi_score),
      consistencyScore: Number(row.consistency_score),
      copyabilityScore: Number(row.copyability_score),
      categoryFitScore: Number(row.category_fit_score),
      entryTimingScore: Number(row.entry_timing_score),
      spreadScore: Number(row.spread_score),
      liquidityScore: Number(row.liquidity_score),
      thesisScore: Number(row.thesis_score),
      simulatedPositionSize: Number(row.simulated_position_size),
      ruleSetId: String(row.rule_set_id),
      ruleVersion: String(row.rule_version),
      evaluatedAt: String(row.evaluated_at),
      createdAt: String(row.created_at)
    };
  }
}
