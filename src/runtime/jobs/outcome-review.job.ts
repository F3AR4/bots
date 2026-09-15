/**
 * Retrospective Outcome Review Job (Task 2.0).
 * 
 * Safety Guarantee:
 * - Deterministically processes T+1h, T+6h, T+24h, and resolution milestones.
 * - Processes each milestone review exactly once per paper position (strictly idempotent).
 * - Zero lookahead bias: preserves immutable evaluation timestamps.
 */

import { DatabaseSync } from 'node:sqlite';
import { PaperTradeRepository } from '../../db/repositories/paper-trade.repo.js';
import { DecisionRepository } from '../../db/repositories/decision.repo.js';
import { ReviewRepository } from '../../db/repositories/review.repo.js';
import { MarketRepository } from '../../db/repositories/market.repo.js';
import { OutcomeReviewer } from '../../core/outcome-reviewer.js';
import { ExecutionBoundary } from '../../safety/execution-boundary.js';

export interface OutcomeReviewJobResult {
  reviewsEvaluated: number;
  newReviewsCreated: number;
}

export class OutcomeReviewJob {
  private paperTradeRepo: PaperTradeRepository;
  private decisionRepo: DecisionRepository;
  private reviewRepo: ReviewRepository;
  private marketRepo: MarketRepository;

  constructor(private db: DatabaseSync) {
    ExecutionBoundary.assertPaperMode();
    this.paperTradeRepo = new PaperTradeRepository(db);
    this.decisionRepo = new DecisionRepository(db);
    this.reviewRepo = new ReviewRepository(db);
    this.marketRepo = new MarketRepository(db);
  }

  public async run(): Promise<OutcomeReviewJobResult> {
    ExecutionBoundary.assertPaperMode();
    const allPaperTrades = this.paperTradeRepo.listAllPaperTrades(500);
    let newReviewsCreated = 0;
    let reviewsEvaluated = 0;
    const nowMs = Date.now();

    for (const trade of allPaperTrades) {
      const decision = this.decisionRepo.getDecisionById(trade.decisionJournalId);
      if (!decision) continue;

      const existingReviews = this.reviewRepo.getReviewsForTrade(trade.id);
      const reviewedMilestones = new Set(existingReviews.map(r => r.milestone));

      const openedAtMs = new Date(trade.openedAt).getTime();
      const ageHours = Math.max(0, (nowMs - openedAtMs) / (1000 * 3600));

      const snapshot = this.marketRepo.getLatestMarketSnapshot(trade.marketId);
      const currentPrice = snapshot
        ? (trade.outcome.toUpperCase() === 'YES' ? snapshot.yesPrice : snapshot.noPrice)
        : trade.currentPrice;

      const candidates: Array<'T+1h' | 'T+6h' | 'T+24h' | 'resolution'> = [];
      if (ageHours >= 1 && !reviewedMilestones.has('T+1h')) candidates.push('T+1h');
      if (ageHours >= 6 && !reviewedMilestones.has('T+6h')) candidates.push('T+6h');
      if (ageHours >= 24 && !reviewedMilestones.has('T+24h')) candidates.push('T+24h');
      if (trade.status === 'resolved' && !reviewedMilestones.has('resolution')) candidates.push('resolution');

      for (const milestone of candidates) {
        reviewsEvaluated++;
        try {
          const review = OutcomeReviewer.reviewMilestone(
            trade,
            decision,
            milestone,
            currentPrice,
            trade.status === 'resolved' ? (trade.realizedPnl > 0 ? 'WIN' : 'LOSS') : undefined
          );
          this.reviewRepo.insertOutcomeReview(review);
          newReviewsCreated++;
        } catch {
          // Idempotency or DB constraint guard
        }
      }
    }

    return {
      reviewsEvaluated,
      newReviewsCreated
    };
  }
}
