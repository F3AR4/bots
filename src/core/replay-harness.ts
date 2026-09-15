/**
 * Deterministic Replay & Test Harness.
 * 
 * Guarantees that replaying captured historical observations with the same
 * RuleSet and deterministic clock produces identical outputs.
 */

import {
  RuleSet,
  ObservedTrade,
  MarketSnapshot,
  WalletProfile,
  DecisionJournal,
  PaperTrade
} from '../types/domain.js';
import { WalletHistoricalActivitySummary } from '../types/adapters.js';
import { WalletScorer } from './wallet-scorer.js';
import { TradeScorer } from './trade-scorer.js';
import { PaperTradingEngine } from './paper-engine.js';
import { WalletScoreResult } from '../types/scoring.js';

export interface ReplayInputDataset {
  ruleSet: RuleSet;
  fixedTimestamp: string;
  walletActivity: WalletHistoricalActivitySummary;
  observedTrades: Array<{
    trade: ObservedTrade;
    market: MarketSnapshot;
  }>;
}

export interface ReplayOutputResult {
  walletScoreResult: WalletScoreResult;
  decisions: DecisionJournal[];
  paperTrades: PaperTrade[];
}

export class ReplayHarness {
  /**
   * Deterministically executes replay on captured dataset.
   */
  public static executeReplay(dataset: ReplayInputDataset): ReplayOutputResult {
    const fixedClock = () => dataset.fixedTimestamp;

    // 1. Deterministic Wallet Scoring
    const walletScoreResult = WalletScorer.scoreWallet(
      dataset.walletActivity,
      dataset.ruleSet,
      fixedClock
    );

    // Build synthesized wallet profile for trade scoring
    const walletProfile: WalletProfile = {
      id: `wp-${dataset.walletActivity.walletAddress}`,
      address: dataset.walletActivity.walletAddress,
      label: null,
      sourceRank: 1,
      status: walletScoreResult.status,
      statusReason: walletScoreResult.statusReasons.join('; '),
      roi30d: dataset.walletActivity.totalPnlUsd,
      consistencyScore: walletScoreResult.factorResults.find(f => f.factorName === 'consistency')?.normalizedScore || 50,
      copyabilityScore: walletScoreResult.factorResults.find(f => f.factorName === 'copyability')?.normalizedScore || 50,
      oneHitWonderPenalty: walletScoreResult.totalPenaltyDeduction,
      globalScore: walletScoreResult.finalTotalScore,
      bestCategory: 'Politics',
      categoryStrengthsJson: JSON.stringify(dataset.walletActivity.tradesByCategory),
      averageTradeSize: 100,
      tradeCount30d: dataset.walletActivity.totalTrades,
      resolvedTradeCount30d: dataset.walletActivity.resolvedTrades,
      winRate30d: dataset.walletActivity.resolvedTrades > 0
        ? dataset.walletActivity.winningTrades / dataset.walletActivity.resolvedTrades
        : 0,
      averageLiquidity: dataset.walletActivity.averageLiquidityUsd,
      averageSpread: dataset.walletActivity.averageSpread,
      averageEntryTiming: 85,
      copyabilityNotes: 'Replay synthesized profile',
      riskNotes: 'Replay synthesized profile',
      ruleSetId: dataset.ruleSet.id,
      lastScannedAt: dataset.fixedTimestamp,
      provenance: dataset.walletActivity.provenance,
      createdAt: dataset.fixedTimestamp,
      updatedAt: dataset.fixedTimestamp
    };

    const decisions: DecisionJournal[] = [];
    const paperTrades: PaperTrade[] = [];

    // Sort trades strictly deterministically by sourceTimestamp then ID
    const sortedItems = [...dataset.observedTrades].sort((a, b) => {
      const timeDiff = a.trade.sourceTimestamp.localeCompare(b.trade.sourceTimestamp);
      if (timeDiff !== 0) return timeDiff;
      return a.trade.id.localeCompare(b.trade.id);
    });

    // 2. Deterministic Trade Scoring & Paper Trade Generation
    for (const item of sortedItems) {
      const scoreResult = TradeScorer.evaluateTrade(
        item.trade,
        item.market,
        walletProfile,
        dataset.ruleSet,
        fixedClock
      );

      const { journal, paperTrade } = PaperTradingEngine.createDecisionAndPaperTrade(
        item.trade,
        scoreResult,
        dataset.ruleSet,
        fixedClock
      );

      // Overwrite deterministic IDs for exact byte-for-byte replay equality
      journal.id = `replay-dj-${item.trade.id}`;
      if (paperTrade) {
        paperTrade.id = `replay-pt-${item.trade.id}`;
        paperTrade.decisionJournalId = journal.id;
        paperTrades.push(paperTrade);
      }

      decisions.push(journal);
    }

    return {
      walletScoreResult,
      decisions,
      paperTrades
    };
  }
}
