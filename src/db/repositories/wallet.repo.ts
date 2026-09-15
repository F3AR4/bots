/**
 * Repository for WalletProfile persistence.
 */

import { DatabaseSync } from 'node:sqlite';
import { WalletProfile, WalletStatus, ProvenanceMetadata, WalletResearchEvaluation } from '../../types/domain.js';

export class WalletRepository {
  constructor(private db: DatabaseSync) {}

  public upsertWalletProfile(profile: WalletProfile): void {
    const stmt = this.db.prepare(`
      INSERT INTO wallet_profiles (
        id, address, label, source_rank, status, status_reason, roi30d, consistency_score,
        copyability_score, one_hit_wonder_penalty, global_score, best_category,
        category_strengths_json, average_trade_size, trade_count30d, resolved_trade_count30d,
        win_rate30d, average_liquidity, average_spread, average_entry_timing, copyability_notes,
        risk_notes, rule_set_id, last_scanned_at, provenance_json, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(address) DO UPDATE SET
        label = excluded.label,
        source_rank = excluded.source_rank,
        status = excluded.status,
        status_reason = excluded.status_reason,
        roi30d = excluded.roi30d,
        consistency_score = excluded.consistency_score,
        copyability_score = excluded.copyability_score,
        one_hit_wonder_penalty = excluded.one_hit_wonder_penalty,
        global_score = excluded.global_score,
        best_category = excluded.best_category,
        category_strengths_json = excluded.category_strengths_json,
        average_trade_size = excluded.average_trade_size,
        trade_count30d = excluded.trade_count30d,
        resolved_trade_count30d = excluded.resolved_trade_count30d,
        win_rate30d = excluded.win_rate30d,
        average_liquidity = excluded.average_liquidity,
        average_spread = excluded.average_spread,
        average_entry_timing = excluded.average_entry_timing,
        copyability_notes = excluded.copyability_notes,
        risk_notes = excluded.risk_notes,
        rule_set_id = excluded.rule_set_id,
        last_scanned_at = excluded.last_scanned_at,
        provenance_json = excluded.provenance_json,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      profile.id,
      profile.address,
      profile.label || null,
      profile.sourceRank,
      profile.status,
      profile.statusReason,
      profile.roi30d,
      profile.consistencyScore,
      profile.copyabilityScore,
      profile.oneHitWonderPenalty,
      profile.globalScore,
      profile.bestCategory,
      profile.categoryStrengthsJson,
      profile.averageTradeSize,
      profile.tradeCount30d,
      profile.resolvedTradeCount30d,
      profile.winRate30d,
      profile.averageLiquidity,
      profile.averageSpread,
      profile.averageEntryTiming,
      profile.copyabilityNotes,
      profile.riskNotes,
      profile.ruleSetId,
      profile.lastScannedAt,
      JSON.stringify(profile.provenance),
      profile.createdAt,
      profile.updatedAt
    );
  }

  public getWalletByAddress(address: string): WalletProfile | null {
    const stmt = this.db.prepare('SELECT * FROM wallet_profiles WHERE address = ?');
    const row = stmt.get(address) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRowToWallet(row);
  }

  public getWalletProfileByAddress(address: string): WalletProfile | null {
    return this.getWalletByAddress(address);
  }

  public listWalletsByStatus(status: WalletStatus): WalletProfile[] {
    const stmt = this.db.prepare('SELECT * FROM wallet_profiles WHERE status = ? ORDER BY global_score DESC');
    const rows = stmt.all(status) as Record<string, unknown>[];
    return rows.map(r => this.mapRowToWallet(r));
  }

  public listTopWallets(limit = 100): WalletProfile[] {
    const stmt = this.db.prepare('SELECT * FROM wallet_profiles ORDER BY global_score DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRowToWallet(r));
  }

  public listAllWalletProfiles(): WalletProfile[] {
    const stmt = this.db.prepare('SELECT * FROM wallet_profiles ORDER BY global_score DESC');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(r => this.mapRowToWallet(r));
  }

  public listProfilesByCategory(category: string, limit = 100): WalletProfile[] {
    const stmt = this.db.prepare('SELECT * FROM wallet_profiles WHERE best_category = ? ORDER BY global_score DESC LIMIT ?');
    const rows = stmt.all(category, limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRowToWallet(r));
  }

  public countWallets(status?: WalletStatus): number {
    if (status) {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM wallet_profiles WHERE status = ?');
      const row = stmt.get(status) as { count: number } | undefined;
      return row ? Number(row.count) : 0;
    }
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM wallet_profiles');
    const row = stmt.get() as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  }

  public saveWalletEvaluation(evaluation: WalletResearchEvaluation): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wallet_evaluations (
        id, wallet_address, rule_set_id, rule_version, analysis_window_days,
        window_start_timestamp, window_end_timestamp, global_rank, category_rank,
        best_category, status, status_reasons_json, final_score, raw_composite_score,
        total_penalty_deduction, roi_provenance_json, data_completeness_json,
        one_hit_wonder_json, frequency_metrics_json, copyability_factors_json,
        factor_results_json, penalties_json, evaluated_at, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    stmt.run(
      evaluation.id,
      evaluation.walletAddress,
      evaluation.ruleSetId,
      evaluation.ruleVersion,
      evaluation.analysisWindowDays,
      evaluation.windowStartTimestamp,
      evaluation.windowEndTimestamp,
      evaluation.globalRank,
      evaluation.categoryRank,
      evaluation.bestCategory,
      evaluation.status,
      JSON.stringify(evaluation.statusReasons),
      evaluation.finalScore,
      evaluation.rawCompositeScore,
      evaluation.totalPenaltyDeduction,
      JSON.stringify(evaluation.roiProvenance),
      JSON.stringify(evaluation.dataCompleteness),
      JSON.stringify(evaluation.oneHitWonderDiagnostics),
      JSON.stringify(evaluation.frequencyMetrics),
      JSON.stringify(evaluation.copyabilityFactors),
      JSON.stringify([]), // factor_results
      JSON.stringify([]), // penalties
      evaluation.evaluatedAt,
      evaluation.createdAt
    );
  }

  public listWalletEvaluations(ruleSetId?: string, limit = 100): WalletResearchEvaluation[] {
    let sql = 'SELECT * FROM wallet_evaluations';
    const params: (string | number)[] = [];
    if (ruleSetId) {
      sql += ' WHERE rule_set_id = ?';
      params.push(ruleSetId);
    }
    sql += ' ORDER BY global_rank ASC LIMIT ?';
    params.push(limit);
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(r => this.mapRowToEvaluation(r));
  }

  public getLatestEvaluationForWallet(walletAddress: string): WalletResearchEvaluation | null {
    const stmt = this.db.prepare('SELECT * FROM wallet_evaluations WHERE wallet_address = ? ORDER BY evaluated_at DESC LIMIT 1');
    const row = stmt.get(walletAddress) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRowToEvaluation(row);
  }

  private mapRowToEvaluation(row: Record<string, unknown>): WalletResearchEvaluation {
    return {
      id: String(row.id),
      walletAddress: String(row.wallet_address),
      ruleSetId: String(row.rule_set_id),
      ruleVersion: String(row.rule_version),
      analysisWindowDays: Number(row.analysis_window_days),
      windowStartTimestamp: row.window_start_timestamp ? String(row.window_start_timestamp) : null,
      windowEndTimestamp: row.window_end_timestamp ? String(row.window_end_timestamp) : null,
      globalRank: Number(row.global_rank),
      categoryRank: Number(row.category_rank),
      bestCategory: String(row.best_category),
      status: row.status as WalletStatus,
      statusReasons: JSON.parse(String(row.status_reasons_json || '[]')),
      finalScore: Number(row.final_score),
      rawCompositeScore: Number(row.raw_composite_score),
      totalPenaltyDeduction: Number(row.total_penalty_deduction),
      roiProvenance: JSON.parse(String(row.roi_provenance_json)),
      dataCompleteness: JSON.parse(String(row.data_completeness_json)),
      oneHitWonderDiagnostics: JSON.parse(String(row.one_hit_wonder_json)),
      frequencyMetrics: JSON.parse(String(row.frequency_metrics_json)),
      copyabilityFactors: JSON.parse(String(row.copyability_factors_json)),
      evaluatedAt: String(row.evaluated_at),
      createdAt: String(row.created_at)
    };
  }

  private mapRowToWallet(row: Record<string, unknown>): WalletProfile {
    return {
      id: String(row.id),
      address: String(row.address),
      label: row.label ? String(row.label) : null,
      sourceRank: Number(row.source_rank),
      status: row.status as WalletStatus,
      statusReason: String(row.status_reason),
      roi30d: Number(row.roi30d),
      consistencyScore: Number(row.consistency_score),
      copyabilityScore: Number(row.copyability_score),
      oneHitWonderPenalty: Number(row.one_hit_wonder_penalty),
      globalScore: Number(row.global_score),
      bestCategory: String(row.best_category),
      categoryStrengthsJson: String(row.category_strengths_json),
      averageTradeSize: Number(row.average_trade_size),
      tradeCount30d: Number(row.trade_count30d),
      resolvedTradeCount30d: Number(row.resolved_trade_count30d),
      winRate30d: Number(row.win_rate30d),
      averageLiquidity: Number(row.average_liquidity),
      averageSpread: Number(row.average_spread),
      averageEntryTiming: Number(row.average_entry_timing),
      copyabilityNotes: String(row.copyability_notes),
      riskNotes: String(row.risk_notes),
      ruleSetId: String(row.rule_set_id),
      lastScannedAt: String(row.last_scanned_at),
      provenance: JSON.parse(String(row.provenance_json)) as ProvenanceMetadata,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }
}
