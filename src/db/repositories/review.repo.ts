/**
 * Repository for OutcomeReview records (T+1h, T+6h, T+24h, resolution).
 */

import { DatabaseSync } from 'node:sqlite';
import { OutcomeReview } from '../../types/domain.js';

export class ReviewRepository {
  constructor(private db: DatabaseSync) {}

  public insertOutcomeReview(review: OutcomeReview): void {
    const stmt = this.db.prepare(`
      INSERT INTO outcome_reviews (
        id, paper_trade_id, decision_journal_id, milestone, price_at_milestone,
        simulated_pnl_at_milestone, final_outcome, was_decision_good,
        decision_quality_score, timing_quality_score, spread_liquidity_impact,
        lessons_json, rule_set_id, reviewed_at, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    stmt.run(
      review.id,
      review.paperTradeId,
      review.decisionJournalId,
      review.milestone,
      review.priceAtMilestone,
      review.simulatedPnlAtMilestone,
      review.finalOutcome || null,
      review.wasDecisionGood ? 1 : 0,
      review.decisionQualityScore,
      review.timingQualityScore,
      review.spreadLiquidityImpact,
      review.lessonsJson,
      review.ruleSetId,
      review.reviewedAt,
      review.createdAt
    );
  }

  public getReviewsForTrade(paperTradeId: string): OutcomeReview[] {
    const stmt = this.db.prepare('SELECT * FROM outcome_reviews WHERE paper_trade_id = ? ORDER BY reviewed_at ASC');
    const rows = stmt.all(paperTradeId) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  public listAllReviews(limit = 100): OutcomeReview[] {
    const stmt = this.db.prepare('SELECT * FROM outcome_reviews ORDER BY reviewed_at DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): OutcomeReview {
    return {
      id: String(row.id),
      paperTradeId: String(row.paper_trade_id),
      decisionJournalId: String(row.decision_journal_id),
      milestone: row.milestone as 'T+1h' | 'T+6h' | 'T+24h' | 'resolution',
      priceAtMilestone: Number(row.price_at_milestone),
      simulatedPnlAtMilestone: Number(row.simulated_pnl_at_milestone),
      finalOutcome: row.final_outcome ? String(row.final_outcome) : undefined,
      wasDecisionGood: Number(row.was_decision_good) === 1,
      decisionQualityScore: Number(row.decision_quality_score),
      timingQualityScore: Number(row.timing_quality_score),
      spreadLiquidityImpact: Number(row.spread_liquidity_impact),
      lessonsJson: String(row.lessons_json),
      ruleSetId: String(row.rule_set_id),
      reviewedAt: String(row.reviewed_at),
      createdAt: String(row.created_at)
    };
  }
}
