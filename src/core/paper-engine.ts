/**
 * Paper Trading Engine.
 * 
 * Safety Guarantee:
 * - Operates strictly in PAPER mode.
 * - Enforces $5.00 to $20.00 capital allocation bounds.
 * - Opens, manages mark-to-market, and settles simulated positions.
 */

import { randomUUID } from 'node:crypto';
import { ObservedTrade, DecisionJournal, PaperTrade, RuleSet } from '../types/domain.js';
import { TradeScoreResult } from '../types/scoring.js';
import { ExecutionBoundary } from '../safety/execution-boundary.js';

export class PaperTradingEngine {
  /**
   * Translates a trade scoring result into an auditable DecisionJournal and PaperTrade.
   */
  public static createDecisionAndPaperTrade(
    trade: ObservedTrade,
    scoreResult: TradeScoreResult,
    ruleSet: RuleSet,
    clock: () => string = () => new Date().toISOString()
  ): { journal: DecisionJournal; paperTrade: PaperTrade | null } {
    ExecutionBoundary.assertPaperMode();

    const timestamp = clock();
    const journalId = `dj-${randomUUID()}`;

    // Map sub-scores from factorResults
    let roiScore = 50, consistencyScore = 50, copyabilityScore = 50, categoryFitScore = 50;
    let entryTimingScore = 50, spreadScore = 50, liquidityScore = 50, thesisScore = 50;
    let walletQualityScore = 50;

    for (const f of scoreResult.factorResults) {
      if (f.dimension === 'walletQuality') walletQualityScore = f.normalizedScore;
      if (f.dimension === 'categoryFit') categoryFitScore = f.normalizedScore;
      if (f.dimension === 'entryTiming') entryTimingScore = f.normalizedScore;
      if (f.dimension === 'spread') spreadScore = f.normalizedScore;
      if (f.dimension === 'liquidity') liquidityScore = f.normalizedScore;
      if (f.dimension === 'thesis') thesisScore = f.normalizedScore;
    }

    const journal: DecisionJournal = {
      id: journalId,
      observedTradeId: trade.id,
      marketSnapshotId: scoreResult.marketSnapshotId,
      walletAddress: trade.walletAddress,
      marketId: trade.marketId,
      decision: scoreResult.decision,
      copyScore: scoreResult.compositeCopyScore,
      confidence: scoreResult.confidence,
      reasonsJson: JSON.stringify(scoreResult.reasons),
      risksJson: JSON.stringify(scoreResult.risks),
      walletQualityScore,
      roiScore,
      consistencyScore,
      copyabilityScore,
      categoryFitScore,
      entryTimingScore,
      spreadScore,
      liquidityScore,
      thesisScore,
      simulatedPositionSize: scoreResult.simulatedPositionSize,
      ruleSetId: ruleSet.id,
      ruleVersion: ruleSet.version,
      evaluatedAt: timestamp,
      createdAt: timestamp
    };

    if (scoreResult.decision !== 'paper_copy') {
      return { journal, paperTrade: null };
    }

    // Strictly enforce $5 to $20 invariant bounds
    const size = Math.min(ruleSet.config.simulatedBetMax, Math.max(ruleSet.config.simulatedBetMin, scoreResult.simulatedPositionSize));
    const entryPrice = Math.max(0.01, Math.min(0.99, trade.detectedPrice));
    const shares = Math.round((size / entryPrice) * 10000) / 10000;

    const paperTrade: PaperTrade = {
      id: `pt-${randomUUID()}`,
      decisionJournalId: journalId,
      observedTradeId: trade.id,
      walletAddress: trade.walletAddress,
      marketId: trade.marketId,
      conditionId: trade.conditionId,
      outcome: trade.outcome,
      side: trade.side,
      entryPrice,
      currentPrice: entryPrice,
      simulatedPositionSize: size,
      shares,
      unrealizedPnl: 0.0,
      realizedPnl: 0.0,
      status: 'open',
      executionMode: 'PAPER',
      ruleSetId: ruleSet.id,
      openedAt: timestamp,
      closedAt: null,
      resolvedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    return { journal, paperTrade };
  }

  /**
   * Updates mark-to-market valuations for an open paper position.
   */
  public static markToMarket(trade: PaperTrade, currentPrice: number, timestamp: string): PaperTrade {
    ExecutionBoundary.assertPaperMode();
    if (trade.status !== 'open') return trade;

    const priceDiff = currentPrice - trade.entryPrice;
    const pnl = trade.side === 'BUY' ? priceDiff * trade.shares : -priceDiff * trade.shares;

    return {
      ...trade,
      currentPrice,
      unrealizedPnl: Math.round(pnl * 100) / 100,
      updatedAt: timestamp
    };
  }

  /**
   * Resolves a paper trade at market settlement.
   */
  public static resolvePosition(
    trade: PaperTrade,
    winningOutcome: string,
    payoutPrice: number,
    timestamp: string
  ): PaperTrade {
    ExecutionBoundary.assertPaperMode();
    const won = trade.outcome.toUpperCase() === winningOutcome.toUpperCase();
    const finalPrice = won ? payoutPrice : 0.0;
    const pnl = (finalPrice - trade.entryPrice) * trade.shares;

    return {
      ...trade,
      currentPrice: finalPrice,
      unrealizedPnl: 0.0,
      realizedPnl: Math.round(pnl * 100) / 100,
      status: 'resolved',
      resolvedAt: timestamp,
      updatedAt: timestamp
    };
  }
}
