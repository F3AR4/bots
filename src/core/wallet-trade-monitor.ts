/**
 * Real-Time Wallet Trade Monitor & Signal Orchestrator (Task 1.6).
 * 
 * Connects read-only wallet observation to deterministic trade scoring,
 * real-time copyability assessment, immutable decision journaling,
 * and strict paper trading.
 * 
 * Invariants:
 * - EXECUTION MODE = PAPER ONLY (Strictly enforced, $5.00 - $20.00 sizing bounds)
 * - NETWORK ACCESS = READ ONLY (Zero signing, zero private keys, zero live orders)
 * - IDEMPOTENCY: 1 observed trade = 1 detection = 1 decision = at most 1 paper trade
 * - TRANSACTIONAL: Detection -> Decision -> PaperTrade creation inside SQLite transaction
 * - FAIL-CLOSED: Errors or stale data do not fabricate live state or execution
 */

import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  ObservedTrade,
  MarketSnapshot,
  WalletProfile,
  RuleSet,
  DetectedTradeEvent,
  LiveSignalView,
  MonitorSystemHealth,
  TradeDecisionType,
  MarketFreshness,
  EvidenceCompleteness
} from '../types/domain.js';
import { WalletRepository } from '../db/repositories/wallet.repo.js';
import { TradeRepository } from '../db/repositories/trade.repo.js';
import { MarketRepository } from '../db/repositories/market.repo.js';
import { DecisionRepository } from '../db/repositories/decision.repo.js';
import { PaperTradeRepository } from '../db/repositories/paper-trade.repo.js';
import { DetectedTradeRepository } from '../db/repositories/detected-trade.repo.js';
import { CurrentCopyabilityEvaluator } from './current-copyability.js';
import { TradeScorer } from './trade-scorer.js';
import { PaperTradingEngine } from './paper-engine.js';
import { ExecutionBoundary } from '../safety/execution-boundary.js';
import { IWalletActivityAdapter } from '../types/adapters.js';
import { DataNormalizer } from '../adapters/normalizer.js';

export interface PollCycleResult {
  pollDurationMs: number;
  walletsChecked: number;
  tradesReceived: number;
  newTradesDetected: number;
  decisionsCreated: number;
  paperCopies: number;
  watchlists: number;
  skips: number;
  paperTradesCreated: number;
  errors: string[];
}

export interface ProcessTradeResult {
  observedTradeId: string;
  detectedTradeId: string;
  decisionId: string;
  decision: TradeDecisionType;
  finalScore: number;
  paperTradeId: string | null;
  paperSize: number;
  alreadyProcessed: boolean;
  reasons: string[];
  risks: string[];
}

export class WalletTradeMonitor {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private lastPollAt: string | null = null;
  private ingestionStatus: 'HEALTHY' | 'DEGRADED' | 'FAILED' = 'HEALTHY';
  private lastErrorMessage: string | null = null;

  constructor(
    private db: DatabaseSync,
    private walletRepo: WalletRepository,
    private tradeRepo: TradeRepository,
    private marketRepo: MarketRepository,
    private decisionRepo: DecisionRepository,
    private paperTradeRepo: PaperTradeRepository,
    private detectedTradeRepo: DetectedTradeRepository,
    private ruleSet: RuleSet,
    private adapter?: IWalletActivityAdapter,
    private clock: () => string = () => new Date().toISOString()
  ) {
    ExecutionBoundary.assertPaperMode();
  }

  /**
   * Executes a single end-to-end poll cycle across tracked wallets.
   */
  public async pollOnce(options?: {
    targetWallet?: string;
    topLimit?: number;
    candidateSnapshots?: Map<string, MarketSnapshot>;
  }): Promise<PollCycleResult> {
    ExecutionBoundary.assertPaperMode();
    const startTime = Date.now();
    const errors: string[] = [];

    let walletsChecked = 0;
    let tradesReceived = 0;
    let newTradesDetected = 0;
    let decisionsCreated = 0;
    let paperCopies = 0;
    let watchlists = 0;
    let skips = 0;
    let paperTradesCreated = 0;

    try {
      // 1. Determine Tracked Wallet Population
      let trackedWallets: WalletProfile[] = [];
      if (options?.targetWallet) {
        const wallet = this.walletRepo.getWalletByAddress(options.targetWallet);
        if (wallet) trackedWallets = [wallet];
      } else {
        trackedWallets = this.walletRepo.listWalletsByStatus('track');
        if (options?.topLimit && options.topLimit < trackedWallets.length) {
          trackedWallets = trackedWallets.slice(0, options.topLimit);
        }
      }
      walletsChecked = trackedWallets.length;

      // 2. Query Read-Only Activity (if live adapter is present)
      if (this.adapter && trackedWallets.length > 0) {
        try {
          const rawTrades = await this.adapter.fetchRecentTrades(trackedWallets.map(w => w.address));
          tradesReceived += rawTrades.length;
          for (const rt of rawTrades) {
            const normalized = DataNormalizer.normalizeObservedTrade(
              rt.rawPayload,
              rt.walletAddress,
              this.clock(),
              true
            );
            if (normalized.success && normalized.data) {
              const inserted = this.tradeRepo.insertObservedTrade(normalized.data);
              if (inserted) {
                newTradesDetected++;
              }
            }
          }
        } catch (err) {
          const msg = `Failed to fetch activity: ${(err as Error).message}`;
          errors.push(msg);
          this.ingestionStatus = 'DEGRADED';
          this.lastErrorMessage = msg;
        }
      }

      // 3. Process Unprocessed Observed Trades
      const unprocessedTrades = this.tradeRepo.listUnprocessedTrades(100);
      for (const trade of unprocessedTrades) {
        try {
          const snapshot = options?.candidateSnapshots?.get(trade.marketId) || null;
          const result = this.processTrade(trade, snapshot);
          if (!result.alreadyProcessed) {
            decisionsCreated++;
            if (result.decision === 'paper_copy') paperCopies++;
            else if (result.decision === 'watchlist') watchlists++;
            else skips++;

            if (result.paperTradeId) {
              paperTradesCreated++;
            }
          }
        } catch (err) {
          const msg = `Failed to process trade ${trade.id}: ${(err as Error).message}`;
          errors.push(msg);
          this.lastErrorMessage = msg;
        }
      }

      this.ingestionStatus = errors.length > 0 ? 'DEGRADED' : 'HEALTHY';
    } catch (globalErr) {
      this.ingestionStatus = 'FAILED';
      const msg = `Critical poll failure: ${(globalErr as Error).message}`;
      errors.push(msg);
      this.lastErrorMessage = msg;
    }

    this.lastPollAt = this.clock();
    const pollDurationMs = Date.now() - startTime;

    return {
      pollDurationMs,
      walletsChecked,
      tradesReceived,
      newTradesDetected,
      decisionsCreated,
      paperCopies,
      watchlists,
      skips,
      paperTradesCreated,
      errors
    };
  }

  /**
   * Deterministically processes a single observed trade.
   * Transactionally executes: Detection -> Copyability -> Scoring -> Decision -> PaperTrade.
   * Guaranteed Idempotent: 1 trade = 1 decision = at most 1 paper trade.
   */
  public processTrade(trade: ObservedTrade, candidateSnapshot?: MarketSnapshot | null): ProcessTradeResult {
    ExecutionBoundary.assertPaperMode();
    const now = this.clock();

    // --- Idempotency Check: Pre-flight check before transaction ---
    if (this.decisionRepo.hasDecisionForTrade(trade.id)) {
      const existingDecision = this.decisionRepo.getDecisionByTradeId(trade.id)!;
      const existingDetection = this.detectedTradeRepo.getDetectedTradeByObservedTradeId(trade.id);
      const existingPaper = this.paperTradeRepo.getPaperTradeByObservedTradeId(trade.id);

      return {
        observedTradeId: trade.id,
        detectedTradeId: existingDetection ? existingDetection.id : '',
        decisionId: existingDecision.id,
        decision: existingDecision.decision,
        finalScore: existingDecision.copyScore,
        paperTradeId: existingPaper ? existingPaper.id : null,
        paperSize: existingPaper ? existingPaper.simulatedPositionSize : 0,
        alreadyProcessed: true,
        reasons: JSON.parse(existingDecision.reasonsJson || '[]'),
        risks: JSON.parse(existingDecision.risksJson || '[]')
      };
    }

    // --- Begin Database Transaction ---
    this.db.exec('BEGIN IMMEDIATE;');

    try {
      // 1. Record / Ensure DetectedTradeEvent
      let detectionEvent = this.detectedTradeRepo.getDetectedTradeByObservedTradeId(trade.id);
      if (!detectionEvent) {
        const sourceTimeMs = new Date(trade.sourceTimestamp).getTime();
        const nowTimeMs = new Date(now).getTime();
        const latencyMs = !isNaN(sourceTimeMs) && !isNaN(nowTimeMs) ? Math.max(0, nowTimeMs - sourceTimeMs) : 0;

        detectionEvent = {
          id: `det-${randomUUID()}`,
          observedTradeId: trade.id,
          walletAddress: trade.walletAddress,
          marketId: trade.marketId,
          detectedAt: now,
          sourceTimestamp: trade.sourceTimestamp,
          detectionLatencyMs: latencyMs,
          dataSource: trade.provenance?.provider || 'polymarket_data_api',
          normalizationVersion: trade.provenance?.normalizationVersion || 'v1.0.0',
          processed: false,
          createdAt: now
        };
        this.detectedTradeRepo.insertDetectedTrade(detectionEvent);
      }

      // 2. Load Wallet Profile & Latest Immutable Evaluation
      const walletProfile = this.walletRepo.getWalletByAddress(trade.walletAddress);
      const latestEvaluation = this.walletRepo.getLatestEvaluationForWallet(trade.walletAddress);

      // Handle Missing Wallet Profile / Evaluation Fail-Closed
      if (!walletProfile) {
        const fallbackDecision = this.createFallbackDecision(
          trade,
          'skip',
          0,
          `Wallet profile not found for ${trade.walletAddress}. Cannot copy unprofiled wallet.`,
          now
        );
        this.decisionRepo.insertDecision(fallbackDecision);
        this.detectedTradeRepo.markProcessed(detectionEvent.id);
        this.db.exec('COMMIT;');
        return {
          observedTradeId: trade.id,
          detectedTradeId: detectionEvent.id,
          decisionId: fallbackDecision.id,
          decision: 'skip',
          finalScore: 0,
          paperTradeId: null,
          paperSize: 0,
          alreadyProcessed: false,
          reasons: [],
          risks: [`Wallet profile not found for ${trade.walletAddress}.`]
        };
      }

      // 3. Load Current Market Snapshot
      const market = candidateSnapshot || this.marketRepo.getLatestMarketSnapshot(trade.marketId);

      // 4. Evaluate Real-Time Copyability
      const copyabilityRate = latestEvaluation?.copyabilityFactors
        ? (latestEvaluation.copyabilityFactors.copyabilityNormalized / 100)
        : null;

      const copyability = CurrentCopyabilityEvaluator.evaluate({
        trade,
        market,
        ruleSet: this.ruleSet,
        detectedAt: detectionEvent.detectedAt,
        historicalCopyabilityRate: copyabilityRate,
        clock: this.clock
      });

      // 5. Score Trade via Deterministic TradeScorer
      // If market is null, create synthetic minimal snapshot to allow fail-closed scoring
      let safeMarket: MarketSnapshot;
      if (market) {
        safeMarket = market;
      } else {
        safeMarket = {
          id: `snap-missing-${randomUUID()}`,
          marketId: trade.marketId,
          conditionId: trade.conditionId,
          question: trade.marketQuestion,
          category: trade.marketCategory,
          yesPrice: trade.detectedPrice,
          noPrice: 1.0 - trade.detectedPrice,
          bestBid: 0,
          bestAsk: 0,
          spread: 1.0,
          liquidity: 0,
          volume: 0,
          timeToResolution: 0,
          collectedAt: trade.sourceTimestamp,
          rawMarketJson: '{}',
          provenance: trade.provenance,
          createdAt: now
        };
        this.marketRepo.insertSnapshot(safeMarket);
      }

      const scoreResult = TradeScorer.evaluateTrade(
        trade,
        safeMarket,
        walletProfile,
        this.ruleSet,
        copyability,
        this.clock
      );

      // 6. Generate Decision Journal and PaperTrade
      const { journal, paperTrade } = PaperTradingEngine.createDecisionAndPaperTrade(
        trade,
        scoreResult,
        this.ruleSet,
        this.clock
      );

      // 7. Persist Decision Journal (Immutable Audit Trail)
      this.decisionRepo.insertDecision(journal);

      // 8. Persist PaperTrade if Decision == 'paper_copy'
      if (paperTrade) {
        this.paperTradeRepo.insertPaperTrade(paperTrade);
      }

      // 9. Mark detection processed
      this.detectedTradeRepo.markProcessed(detectionEvent.id);

      // Commit transaction
      this.db.exec('COMMIT;');

      return {
        observedTradeId: trade.id,
        detectedTradeId: detectionEvent.id,
        decisionId: journal.id,
        decision: journal.decision,
        finalScore: journal.copyScore,
        paperTradeId: paperTrade ? paperTrade.id : null,
        paperSize: paperTrade ? paperTrade.simulatedPositionSize : 0,
        alreadyProcessed: false,
        reasons: JSON.parse(journal.reasonsJson),
        risks: JSON.parse(journal.risksJson)
      };
    } catch (txErr) {
      this.db.exec('ROLLBACK;');
      throw txErr;
    }
  }

  /**
   * Retrieves enriched live signal views for dashboard and observability.
   */
  public getLiveSignals(limit = 50): LiveSignalView[] {
    const stmt = this.db.prepare(`
      SELECT 
        dte.id as detection_id,
        dte.detected_at,
        dte.source_timestamp,
        dte.detection_latency_ms,
        ot.id as observed_trade_id,
        ot.wallet_address,
        ot.market_id,
        ot.condition_id,
        ot.market_question,
        ot.market_category,
        ot.outcome,
        ot.side,
        ot.wallet_entry_price,
        ot.detected_price,
        ot.size as wallet_size,
        wp.source_rank,
        wp.status as wallet_status,
        wp.global_score as wallet_score,
        wp.category_strengths_json,
        dj.id as decision_id,
        dj.decision,
        dj.copy_score,
        dj.confidence,
        dj.reasons_json,
        dj.risks_json,
        dj.rule_version,
        dj.spread_score,
        dj.liquidity_score,
        pt.id as paper_trade_id,
        pt.simulated_position_size as paper_size,
        pt.entry_price as paper_entry_price,
        pt.status as paper_status,
        ms.best_bid,
        ms.best_ask,
        ms.spread,
        ms.liquidity,
        ms.collected_at as snapshot_collected_at,
        ms.time_to_resolution
      FROM detected_trade_events dte
      JOIN observed_trades ot ON dte.observed_trade_id = ot.id
      LEFT JOIN wallet_profiles wp ON ot.wallet_address = wp.address
      LEFT JOIN decision_journals dj ON ot.id = dj.observed_trade_id
      LEFT JOIN paper_trades pt ON ot.id = pt.observed_trade_id
      LEFT JOIN market_snapshots ms ON dj.market_snapshot_id = ms.id
      ORDER BY dte.detected_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRowToLiveSignal(r));
  }

  /**
   * Retrieves a single enriched live signal view by detection ID or observed trade ID.
   */
  public getLiveSignalById(id: string): LiveSignalView | null {
    const stmt = this.db.prepare(`
      SELECT 
        dte.id as detection_id,
        dte.detected_at,
        dte.source_timestamp,
        dte.detection_latency_ms,
        ot.id as observed_trade_id,
        ot.wallet_address,
        ot.market_id,
        ot.condition_id,
        ot.market_question,
        ot.market_category,
        ot.outcome,
        ot.side,
        ot.wallet_entry_price,
        ot.detected_price,
        ot.size as wallet_size,
        wp.source_rank,
        wp.status as wallet_status,
        wp.global_score as wallet_score,
        wp.category_strengths_json,
        dj.id as decision_id,
        dj.decision,
        dj.copy_score,
        dj.confidence,
        dj.reasons_json,
        dj.risks_json,
        dj.rule_version,
        dj.spread_score,
        dj.liquidity_score,
        pt.id as paper_trade_id,
        pt.simulated_position_size as paper_size,
        pt.entry_price as paper_entry_price,
        pt.status as paper_status,
        ms.best_bid,
        ms.best_ask,
        ms.spread,
        ms.liquidity,
        ms.collected_at as snapshot_collected_at,
        ms.time_to_resolution
      FROM detected_trade_events dte
      JOIN observed_trades ot ON dte.observed_trade_id = ot.id
      LEFT JOIN wallet_profiles wp ON ot.wallet_address = wp.address
      LEFT JOIN decision_journals dj ON ot.id = dj.observed_trade_id
      LEFT JOIN paper_trades pt ON ot.id = pt.observed_trade_id
      LEFT JOIN market_snapshots ms ON dj.market_snapshot_id = ms.id
      WHERE dte.id = ? OR ot.id = ? OR dj.id = ?
      LIMIT 1
    `);

    const row = stmt.get(id, id, id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRowToLiveSignal(row);
  }

  /**
   * Returns current monitor system health metrics.
   */
  public getSystemHealth(): MonitorSystemHealth {
    const activeWallets = this.walletRepo.countWallets ? this.walletRepo.countWallets('track') : 0;
    const totalDetections = this.detectedTradeRepo.countDetections();
    const totalPaperTrades = this.paperTradeRepo.countPaperTrades();

    let marketFreshness: MarketFreshness = 'FRESH';
    const recentSnapshot = this.marketRepo.listRecentSnapshots(1)[0];
    if (recentSnapshot) {
      const ageSeconds = Math.max(0, (Date.now() - new Date(recentSnapshot.collectedAt).getTime()) / 1000);
      if (ageSeconds > this.ruleSet.config.freshnessStaleThresholdSeconds) marketFreshness = 'STALE';
      else if (ageSeconds > this.ruleSet.config.freshnessAgingThresholdSeconds) marketFreshness = 'AGING';
    } else {
      marketFreshness = 'UNAVAILABLE';
    }

    return {
      ingestionStatus: this.ingestionStatus,
      marketDataFreshness: marketFreshness,
      walletMonitorStatus: this.isRunning ? 'RUNNING' : 'IDLE',
      paperEngineStatus: 'ACTIVE',
      executionMode: 'PAPER ONLY',
      lastPollAt: this.lastPollAt,
      activeTrackedWallets: activeWallets,
      totalDetectedTrades: totalDetections,
      totalPaperTradesCreated: totalPaperTrades,
      lastErrorMessage: this.lastErrorMessage
    };
  }

  public startPolling(intervalSeconds = 10): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => {
      this.pollOnce().catch(err => {
        this.lastErrorMessage = (err as Error).message;
      });
    }, intervalSeconds * 1000);
  }

  public stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  private createFallbackDecision(
    trade: ObservedTrade,
    decision: TradeDecisionType,
    score: number,
    risk: string,
    timestamp: string,
    marketSnapshotId?: string
  ) {
    let snapId = marketSnapshotId;
    if (!snapId) {
      const dummySnap: MarketSnapshot = {
        id: `snap-fallback-${randomUUID()}`,
        marketId: trade.marketId,
        conditionId: trade.conditionId,
        question: trade.marketQuestion,
        category: trade.marketCategory,
        yesPrice: trade.detectedPrice,
        noPrice: 1.0 - trade.detectedPrice,
        bestBid: 0,
        bestAsk: 0,
        spread: 1.0,
        liquidity: 0,
        volume: 0,
        timeToResolution: 0,
        collectedAt: timestamp,
        rawMarketJson: '{}',
        provenance: trade.provenance,
        createdAt: timestamp
      };
      this.marketRepo.insertSnapshot(dummySnap);
      snapId = dummySnap.id;
    }

    return {
      id: `dj-${randomUUID()}`,
      observedTradeId: trade.id,
      marketSnapshotId: snapId,
      walletAddress: trade.walletAddress,
      marketId: trade.marketId,
      decision,
      copyScore: score,
      confidence: 0,
      reasonsJson: '[]',
      risksJson: JSON.stringify([risk]),
      walletQualityScore: 0,
      roiScore: 0,
      consistencyScore: 0,
      copyabilityScore: 0,
      categoryFitScore: 0,
      entryTimingScore: 0,
      spreadScore: 0,
      liquidityScore: 0,
      thesisScore: 0,
      simulatedPositionSize: 0,
      ruleSetId: this.ruleSet.id,
      ruleVersion: this.ruleSet.version,
      evaluatedAt: timestamp,
      createdAt: timestamp
    };
  }

  private mapRowToLiveSignal(row: Record<string, unknown>): LiveSignalView {
    const reasons = JSON.parse(String(row.reasons_json || '[]')) as string[];
    const risks = JSON.parse(String(row.risks_json || '[]')) as string[];
    const spread = row.spread !== null ? Number(row.spread) : 0;
    const liquidity = row.liquidity !== null ? Number(row.liquidity) : 0;
    const walletEntryPrice = Number(row.wallet_entry_price);
    const currentPrice = Number(row.detected_price);
    const priceMovement = Math.round((currentPrice - walletEntryPrice) * 10000) / 10000;

    let freshness: MarketFreshness = 'FRESH';
    if (row.snapshot_collected_at) {
      const ageSeconds = (new Date(String(row.detected_at)).getTime() - new Date(String(row.snapshot_collected_at)).getTime()) / 1000;
      if (ageSeconds > this.ruleSet.config.freshnessStaleThresholdSeconds) freshness = 'STALE';
      else if (ageSeconds > this.ruleSet.config.freshnessAgingThresholdSeconds) freshness = 'AGING';
    } else {
      freshness = 'UNAVAILABLE';
    }

    let copyability = 'COPYABLE';
    if (freshness === 'UNAVAILABLE' || spread > 0.10) copyability = 'UNFOLLOWABLE';
    else if (freshness === 'AGING' || spread > 0.04) copyability = 'DIFFICULT';

    let categoryWinRate = 50.0;
    try {
      const catMap = JSON.parse(String(row.category_strengths_json || '{}'));
      const cat = catMap[String(row.market_category)];
      if (cat && cat.winRate !== undefined) categoryWinRate = cat.winRate * 100;
    } catch {
      // fallback
    }

    let evidenceCompleteness: EvidenceCompleteness = 'COMPLETE';
    if (freshness === 'UNAVAILABLE' || !row.decision_id) evidenceCompleteness = 'INSUFFICIENT';
    else if (freshness === 'AGING') evidenceCompleteness = 'PARTIAL';

    return {
      id: String(row.detection_id),
      detectedAt: String(row.detected_at),
      sourceTimestamp: String(row.source_timestamp),
      detectionLatencyMs: Number(row.detection_latency_ms),
      walletAddress: String(row.wallet_address),
      walletRank: Number(row.source_rank || 999),
      walletStatus: (row.wallet_status as any) || 'ignore',
      walletScore: Number(row.wallet_score || 0),
      category: String(row.market_category),
      categoryWinRate,
      marketId: String(row.market_id),
      marketQuestion: String(row.market_question),
      outcome: String(row.outcome),
      side: row.side as 'BUY' | 'SELL',
      walletEntryPrice,
      walletSize: Number(row.wallet_size),
      currentPrice,
      priceMovement,
      spread,
      liquidity,
      marketFreshness: freshness,
      timeToResolutionSeconds: row.time_to_resolution !== null ? Number(row.time_to_resolution) : null,
      copyability: copyability as any,
      decision: (row.decision as TradeDecisionType) || 'skip',
      finalScore: Number(row.copy_score || 0),
      confidence: row.confidence !== null ? Number(row.confidence) : null,
      reasons,
      risks,
      paperTradeId: row.paper_trade_id ? String(row.paper_trade_id) : null,
      paperSize: row.paper_size !== null ? Number(row.paper_size) : null,
      paperEntryPrice: row.paper_entry_price !== null ? Number(row.paper_entry_price) : null,
      paperStatus: row.paper_status ? String(row.paper_status) : null,
      ruleSetVersion: String(row.rule_version || this.ruleSet.version),
      evidenceCompleteness,
      provenance: {
        historicalWalletEvidence: `Immutable 30d evaluation: rank #${row.source_rank || 'N/A'}, score ${Number(row.wallet_score || 0).toFixed(1)}`,
        currentMarketEvidence: `Snapshot freshness: ${freshness}, spread: $${spread.toFixed(3)}, liquidity: $${liquidity.toFixed(0)}`,
        currentWalletTrade: `Observed ${row.side} at $${walletEntryPrice.toFixed(3)}, size: $${Number(row.wallet_size).toFixed(2)}`,
        modeledCopyCondition: `Observed drift: $${priceMovement.toFixed(3)}, latency: ${Number(row.detection_latency_ms)}ms`,
        paperDecision: `Decision: ${row.decision || 'skip'} (Score: ${Number(row.copy_score || 0).toFixed(1)}, Paper Size: $${Number(row.paper_size || 0).toFixed(2)})`
      }
    };
  }
}
