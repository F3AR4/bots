/**
 * Retrospective Outcome Review Engine.
 * 
 * Supports milestones: T+1h, T+6h, T+24h, and resolution.
 * Preserves zero lookahead bias: writes to separate OutcomeReview records.
 */

import { randomUUID } from 'node:crypto';
import { PaperTrade, DecisionJournal, OutcomeReview } from '../types/domain.js';

export class OutcomeReviewer {
  /**
   * Generates a milestone review for a paper position.
   */
  public static reviewMilestone(
    paperTrade: PaperTrade,
    decision: DecisionJournal,
    milestone: 'T+1h' | 'T+6h' | 'T+24h' | 'resolution',
    priceAtMilestone: number,
    finalOutcome?: string,
    clock: () => string = () => new Date().toISOString()
  ): OutcomeReview {
    const timestamp = clock();
    const priceDiff = priceAtMilestone - paperTrade.entryPrice;
    const simulatedPnl = paperTrade.side === 'BUY'
      ? priceDiff * paperTrade.shares
      : -priceDiff * paperTrade.shares;

    // Retrospective evaluation of decision quality
    const wasDecisionGood = simulatedPnl > 0;
    const decisionQualityScore = Math.min(100, Math.max(0, 50 + (simulatedPnl / paperTrade.simulatedPositionSize) * 50));
    const timingQualityScore = priceAtMilestone >= paperTrade.entryPrice ? 80.0 : 40.0;
    const spreadLiquidityImpact = 0.5; // Drag placeholder

    const lessons: string[] = [];
    if (wasDecisionGood) {
      lessons.push(`Profitable simulated trajectory at ${milestone}: +$${simulatedPnl.toFixed(2)}.`);
    } else {
      lessons.push(`Adverse price movement at ${milestone}: -$${Math.abs(simulatedPnl).toFixed(2)}.`);
    }

    return {
      id: `rev-${randomUUID()}`,
      paperTradeId: paperTrade.id,
      decisionJournalId: decision.id,
      milestone,
      priceAtMilestone,
      simulatedPnlAtMilestone: Math.round(simulatedPnl * 100) / 100,
      finalOutcome,
      wasDecisionGood,
      decisionQualityScore: Math.round(decisionQualityScore * 10) / 10,
      timingQualityScore,
      spreadLiquidityImpact,
      lessonsJson: JSON.stringify(lessons),
      ruleSetId: decision.ruleSetId,
      reviewedAt: timestamp,
      createdAt: timestamp
    };
  }
}
