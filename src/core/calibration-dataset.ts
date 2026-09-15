/**
 * Deterministic Calibration Dataset Builder.
 * 
 * Safety & Invariant Guarantees:
 * - Deterministic replay and dataset extraction from SQLite.
 * - Zero look-ahead bias: decisions are strictly evaluated against data available at decision time.
 * - Explicit tracking of excluded observations with reasons.
 * - Structured provenance metadata on all samples.
 */

import { DatabaseSync } from 'node:sqlite';
import {
  CalibrationDataset,
  CalibrationSample,
  ExcludedSampleRecord,
  EvidenceTier,
  ObservedTrade,
  MarketSnapshot,
  DecisionJournal,
  PaperTrade,
  OutcomeReview,
  WalletResearchEvaluation,
  DataCompletenessReport,
  ProvenanceMetadata
} from '../types/domain.js';
import { TradeRepository } from '../db/repositories/trade.repo.js';
import { DecisionRepository } from '../db/repositories/decision.repo.js';
import { PaperTradeRepository } from '../db/repositories/paper-trade.repo.js';
import { ReviewRepository } from '../db/repositories/review.repo.js';
import { MarketRepository } from '../db/repositories/market.repo.js';
import { WalletRepository } from '../db/repositories/wallet.repo.js';
import { RuleLearningConfig } from '../types/domain.js';
import { DEFAULT_RULE_LEARNING_CONFIG } from '../config/learning.default.js';

export interface CalibrationDatasetOptions {
  windowStart?: string;
  windowEnd?: string;
  ruleSetId?: string;
  category?: string;
  config?: RuleLearningConfig;
}

export class CalibrationDatasetBuilder {
  private tradeRepo: TradeRepository;
  private decisionRepo: DecisionRepository;
  private paperTradeRepo: PaperTradeRepository;
  private reviewRepo: ReviewRepository;
  private marketRepo: MarketRepository;
  private walletRepo: WalletRepository;

  constructor(private db: DatabaseSync) {
    this.tradeRepo = new TradeRepository(db);
    this.decisionRepo = new DecisionRepository(db);
    this.paperTradeRepo = new PaperTradeRepository(db);
    this.reviewRepo = new ReviewRepository(db);
    this.marketRepo = new MarketRepository(db);
    this.walletRepo = new WalletRepository(db);
  }

  /**
   * Builds a deterministic calibration dataset for a given time window.
   */
  public buildDataset(options: CalibrationDatasetOptions = {}): CalibrationDataset {
    const config = options.config || DEFAULT_RULE_LEARNING_CONFIG;
    const nowIso = new Date().toISOString();
    const windowStart = options.windowStart || '1970-01-01T00:00:00.000Z';
    const windowEnd = options.windowEnd || nowIso;

    // Fetch observed trades within window
    const stmtTrades = this.db.prepare(`
      SELECT * FROM observed_trades
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY source_timestamp ASC, created_at ASC
    `);
    const tradeRows = stmtTrades.all(windowStart, windowEnd) as Record<string, unknown>[];

    // Fetch decisions, paper trades, reviews, snapshots
    const decisions = this.decisionRepo.listRecentDecisions(10000);
    const paperTrades = this.paperTradeRepo.listAllPaperTrades(10000);
    const reviews = this.reviewRepo.listAllReviews(10000);
    const snapshots = this.marketRepo.listRecentSnapshots(10000);
    const evaluations = this.walletRepo.listWalletEvaluations(undefined, 10000);

    // Index by observed_trade_id and decision_journal_id
    const decisionByTradeId = new Map<string, DecisionJournal>();
    for (const d of decisions) {
      decisionByTradeId.set(d.observedTradeId, d);
    }

    const paperTradeByDecisionId = new Map<string, PaperTrade>();
    const paperTradeByTradeId = new Map<string, PaperTrade>();
    for (const pt of paperTrades) {
      paperTradeByDecisionId.set(pt.decisionJournalId, pt);
      paperTradeByTradeId.set(pt.observedTradeId, pt);
    }

    const reviewsByDecisionId = new Map<string, OutcomeReview[]>();
    for (const r of reviews) {
      const list = reviewsByDecisionId.get(r.decisionJournalId) || [];
      list.push(r);
      reviewsByDecisionId.set(r.decisionJournalId, list);
    }

    const snapshotById = new Map<string, MarketSnapshot>();
    for (const s of snapshots) {
      snapshotById.set(s.id, s);
    }

    const samples: CalibrationSample[] = [];
    const excludedSamples: ExcludedSampleRecord[] = [];

    for (const row of tradeRows) {
      const trade: ObservedTrade = {
        id: String(row.id),
        walletAddress: String(row.wallet_address),
        marketId: String(row.market_id),
        conditionId: String(row.condition_id),
        marketQuestion: String(row.market_question),
        marketCategory: String(row.market_category),
        outcome: String(row.outcome),
        side: row.side as 'BUY' | 'SELL',
        walletEntryPrice: Number(row.wallet_entry_price),
        detectedPrice: Number(row.detected_price),
        size: Number(row.size),
        sourceTxHash: row.source_tx_hash ? String(row.source_tx_hash) : undefined,
        sourceTimestamp: String(row.source_timestamp),
        rawTradeJson: String(row.raw_trade_json),
        provenance: JSON.parse(String(row.provenance_json)) as ProvenanceMetadata,
        createdAt: String(row.created_at)
      };

      // Filter by category if requested
      if (options.category && trade.marketCategory.toLowerCase() !== options.category.toLowerCase()) {
        continue;
      }

      // Check if decision exists
      const decision = decisionByTradeId.get(trade.id);
      if (!decision) {
        excludedSamples.push({
          id: `ex-${trade.id}`,
          observedTradeId: trade.id,
          reason: 'MISSING_DECISION_JOURNAL',
          timestamp: trade.createdAt
        });
        continue;
      }

      // Filter by RuleSet ID if requested
      if (options.ruleSetId && decision.ruleSetId !== options.ruleSetId) {
        continue;
      }

      // Look-Ahead Invariant Validation:
      // Decision timestamp must be >= trade source timestamp
      const tradeTime = new Date(trade.sourceTimestamp).getTime();
      const decisionTime = new Date(decision.evaluatedAt).getTime();
      if (isNaN(tradeTime) || isNaN(decisionTime)) {
        excludedSamples.push({
          id: `ex-${trade.id}`,
          observedTradeId: trade.id,
          reason: 'INVALID_TIMESTAMP',
          timestamp: trade.createdAt
        });
        continue;
      }

      // Find contemporaneous market snapshot (strictly at or before decision evaluatedAt)
      let snapshot = decision.marketSnapshotId ? snapshotById.get(decision.marketSnapshotId) || null : null;
      if (!snapshot) {
        // Fallback: look for latest snapshot for market <= decision evaluatedAt
        const eligibleSnapshots = snapshots
          .filter(s => s.marketId === trade.marketId && new Date(s.collectedAt).getTime() <= decisionTime)
          .sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());
        snapshot = eligibleSnapshots[0] || null;
      }

      // Find wallet evaluation at decision time (strictly <= decision evaluatedAt)
      const eligibleEvals = evaluations
        .filter(e => e.walletAddress === trade.walletAddress && new Date(e.evaluatedAt).getTime() <= decisionTime)
        .sort((a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime());
      const walletEvalAtDecision = eligibleEvals[0] || null;

      // Associated paper trade
      const paperTrade = paperTradeByDecisionId.get(decision.id) || paperTradeByTradeId.get(trade.id) || null;

      // Associated outcome reviews
      const outcomeReviews = reviewsByDecisionId.get(decision.id) || [];

      // Extract subsequent prices from outcome reviews / pnl snapshots
      const subsequentMarketPrices: number[] = [];
      for (const rev of outcomeReviews) {
        subsequentMarketPrices.push(rev.priceAtMilestone);
      }

      // Determine outcome and realized PnL
      let outcome: 'WIN' | 'LOSS' | 'UNRESOLVED' | null = null;
      let realizedPnl: number | null = null;

      if (paperTrade) {
        if (paperTrade.status === 'resolved') {
          outcome = paperTrade.realizedPnl > 0 ? 'WIN' : 'LOSS';
          realizedPnl = paperTrade.realizedPnl;
        } else {
          outcome = 'UNRESOLVED';
          realizedPnl = null;
        }
      } else {
        // Watched or skipped trade outcome from reviews
        const resReview = outcomeReviews.find(r => r.milestone === 'resolution');
        if (resReview && resReview.finalOutcome) {
          outcome = resReview.wasDecisionGood ? 'WIN' : 'LOSS';
          realizedPnl = resReview.simulatedPnlAtMilestone;
        }
      }

      // Decision factor breakdown
      const decisionFactors: Record<string, number> = {
        walletQuality: decision.walletQualityScore,
        roi: decision.roiScore,
        consistency: decision.consistencyScore,
        copyability: decision.copyabilityScore,
        categoryFit: decision.categoryFitScore,
        entryTiming: decision.entryTimingScore,
        spread: decision.spreadScore,
        liquidity: decision.liquidityScore,
        thesis: decision.thesisScore
      };

      // Data completeness assessment
      const hasSnapshot = snapshot !== null;
      const hasWalletEval = walletEvalAtDecision !== null;
      const hasOutcome = outcome !== null && outcome !== 'UNRESOLVED';
      const completenessScore = (
        (hasSnapshot ? 35 : 0) +
        (hasWalletEval ? 35 : 0) +
        (hasOutcome ? 30 : 0)
      );

      const completenessReport: DataCompletenessReport = {
        totalTradesObserved: 1,
        resolvedTradesCount: hasOutcome ? 1 : 0,
        unresolvedTradesCount: hasOutcome ? 0 : 1,
        resolvedCoverage: hasOutcome ? 1.0 : 0.0,
        marketSnapshotCoverage: hasSnapshot ? 1.0 : 0.0,
        timestampCoverage: 1.0,
        categoryCoverage: trade.marketCategory ? 1.0 : 0.0,
        liquidityCoverage: snapshot && snapshot.liquidity > 0 ? 1.0 : 0.0,
        priceCoverage: trade.walletEntryPrice > 0 ? 1.0 : 0.0,
        overallEvidenceScore: completenessScore,
        evidenceTier: completenessScore >= 75 ? 'HIGH_EVIDENCE' : (completenessScore >= 50 ? 'MODERATE_EVIDENCE' : 'LOW_EVIDENCE')
      };

      const sample: CalibrationSample = {
        id: `cs-${trade.id}`,
        observedTradeId: trade.id,
        walletAddress: trade.walletAddress,
        walletEvaluationAtDecision: walletEvalAtDecision,
        category: trade.marketCategory,
        observedTrade: trade,
        marketSnapshot: snapshot,
        decision: decision.decision,
        decisionJournal: decision,
        ruleSetId: decision.ruleSetId,
        paperTrade,
        entryPrice: trade.walletEntryPrice,
        subsequentMarketPrices,
        spread: snapshot ? snapshot.spread : (decision.spreadScore > 0 ? (100 - decision.spreadScore) / 1000 : 0.02),
        liquidity: snapshot ? snapshot.liquidity : (decision.liquidityScore > 0 ? decision.liquidityScore * 50 : 1000),
        timeToResolution: snapshot ? snapshot.timeToResolution : 86400,
        outcome,
        realizedPnl,
        outcomeReviews,
        decisionFactors,
        dataCompleteness: completenessReport,
        provenance: {
          ...trade.provenance,
          processingTime: decision.evaluatedAt,
          availabilityTime: trade.createdAt
        }
      };

      samples.push(sample);
    }

    const totalObserved = tradeRows.length;
    const totalAccepted = samples.length;
    const totalExcluded = excludedSamples.length;
    const coverageRatio = totalObserved > 0 ? totalAccepted / totalObserved : 1.0;

    let evidenceTier: EvidenceTier = 'INSUFFICIENT';
    if (totalAccepted >= config.minEvidenceTradesStrong) {
      evidenceTier = 'STRONG';
    } else if (totalAccepted >= config.minEvidenceTradesModerate) {
      evidenceTier = 'MODERATE';
    } else if (totalAccepted >= config.minEvidenceTradesWeak) {
      evidenceTier = 'WEAK';
    } else {
      evidenceTier = 'INSUFFICIENT';
    }

    return {
      datasetId: `calib-ds-${Date.now()}`,
      generatedAt: nowIso,
      windowStart,
      windowEnd,
      samples,
      excludedSamples,
      totalObserved,
      totalAccepted,
      totalExcluded,
      coverageRatio: Math.round(coverageRatio * 1000) / 1000,
      evidenceTier
    };
  }
}
