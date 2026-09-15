/**
 * Ingestion Service & Pipeline Coordinator.
 * 
 * Orchestrates:
 * 1. Leaderboard Ingestion (paginated top N discovery, scan recording, wallet profile initialization).
 * 2. Wallet Activity Ingestion (historical trades, deduplication, summary computation).
 * 3. Market Snapshot Ingestion (point-in-time orderbook & metadata capture).
 * 4. Comprehensive Data Quality Auditing (records requested, received, accepted, rejected, duplicates, gaps).
 * 5. Strict ExecutionMode: PAPER ONLY.
 */

import { DatabaseSync } from 'node:sqlite';
import { LeaderboardRepository } from '../db/repositories/leaderboard.repo.js';
import { WalletRepository } from '../db/repositories/wallet.repo.js';
import { TradeRepository } from '../db/repositories/trade.repo.js';
import { MarketRepository } from '../db/repositories/market.repo.js';
import { IngestionRepository } from '../db/repositories/ingestion.repo.js';
import { RuleSetRepository } from '../db/repositories/ruleset.repo.js';
import { DEFAULT_RULESET } from '../config/ruleset.default.js';

import {
  ILeaderboardAdapter,
  IWalletActivityAdapter,
  IMarketDataAdapter,
  IResolutionAdapter
} from '../types/adapters.js';
import {
  PolymarketLeaderboardAdapter,
  FixtureLeaderboardAdapter
} from '../adapters/leaderboard.adapter.js';
import {
  PolymarketWalletActivityAdapter,
  FixtureWalletActivityAdapter
} from '../adapters/wallet-activity.adapter.js';
import {
  PolymarketMarketDataAdapter,
  FixtureMarketDataAdapter
} from '../adapters/market-data.adapter.js';
import {
  PolymarketResolutionAdapter,
  FixtureResolutionAdapter
} from '../adapters/resolution.adapter.js';

import {
  LeaderboardScan,
  WalletProfile,
  ObservedTrade,
  MarketSnapshot,
  IngestionOperation
} from '../types/domain.js';
import { ExecutionBoundary } from '../safety/execution-boundary.js';
import { ProviderConfig, DEFAULT_PROVIDER_CONFIG } from '../config/provider.config.js';

export interface IngestionExecutionResult {
  operationId: string;
  operationType: string;
  status: 'completed' | 'completed_with_warnings' | 'failed';
  isLive: boolean;
  recordsRequested: number;
  recordsReceived: number;
  recordsAccepted: number;
  recordsRejected: number;
  duplicatesCount: number;
  errorsCount: number;
  summaryMessage: string;
  diagnostics: Record<string, unknown>;
}

export class IngestionService {
  private leaderboardRepo: LeaderboardRepository;
  private walletRepo: WalletRepository;
  private tradeRepo: TradeRepository;
  private marketRepo: MarketRepository;
  private ingestionRepo: IngestionRepository;
  private rulesetRepo: RuleSetRepository;

  constructor(
    private readonly db: DatabaseSync,
    private readonly config: ProviderConfig = DEFAULT_PROVIDER_CONFIG
  ) {
    this.leaderboardRepo = new LeaderboardRepository(db);
    this.walletRepo = new WalletRepository(db);
    this.tradeRepo = new TradeRepository(db);
    this.marketRepo = new MarketRepository(db);
    this.ingestionRepo = new IngestionRepository(db);
    this.rulesetRepo = new RuleSetRepository(db);
  }

  /**
   * Runs leaderboard ingestion in either 'live' or 'fixture' mode.
   */
  public async ingestLeaderboard(
    mode: 'live' | 'fixture',
    topN = 500,
    lookbackDays = 30,
    fixtureAdapter?: ILeaderboardAdapter
  ): Promise<IngestionExecutionResult> {
    ExecutionBoundary.assertPaperMode();

    const isLive = mode === 'live';
    const startedAt = new Date().toISOString();
    const opId = `op-lb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const op: IngestionOperation = {
      id: opId,
      operationType: 'leaderboard',
      targetIdentifier: 'global',
      status: 'running',
      isLive,
      provider: isLive ? 'polymarket_data_api' : 'fixture_leaderboard',
      endpoint: isLive ? `${this.config.dataApiBaseUrl}/v1/leaderboard` : 'fixture://leaderboard',
      requestedWindowDays: lookbackDays,
      actualStartTimestamp: null,
      actualEndTimestamp: null,
      recordsRequested: topN,
      recordsReceived: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      duplicatesCount: 0,
      errorsCount: 0,
      diagnosticsJson: '{}',
      startedAt,
      completedAt: null,
      createdAt: startedAt
    };
    this.ingestionRepo.saveOperation(op);

    const adapter: ILeaderboardAdapter = fixtureAdapter || (
      isLive ? new PolymarketLeaderboardAdapter(this.config) : new FixtureLeaderboardAdapter([])
    );

    try {
      const result = await adapter.fetchLeaderboard(topN, lookbackDays);
      op.recordsReceived = result.entries.length;

      // Persist LeaderboardScan
      const scan: LeaderboardScan = {
        id: result.scanId,
        source: result.source,
        scannedAt: result.scannedAt,
        walletCount: result.entries.length,
        lookbackDays: result.lookbackDays,
        rawSummaryJson: JSON.stringify({ count: result.entries.length, scanId: result.scanId }),
        provenance: result.provenance,
        createdAt: startedAt
      };
      this.leaderboardRepo.saveScan(scan);

      const activeRuleSet = this.rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;

      // Seed/upsert discovered wallet profile shells
      let accepted = 0;
      let duplicates = 0;

      for (const entry of result.entries) {
        const existing = this.walletRepo.getWalletProfileByAddress(entry.walletAddress);
        if (existing) {
          // Update rank and scan time
          existing.sourceRank = entry.sourceRank;
          existing.lastScannedAt = result.scannedAt;
          this.walletRepo.upsertWalletProfile(existing);
          duplicates++;
        } else {
          const profile: WalletProfile = {
            id: `wp-${entry.walletAddress.slice(0, 10)}-${Date.now()}`,
            address: entry.walletAddress,
            label: entry.pseudonym || null,
            sourceRank: entry.sourceRank,
            status: 'watch', // Initial status before deep wallet scoring
            statusReason: `Discovered from leaderboard scan ${scan.id} (Rank #${entry.sourceRank})`,
            roi30d: entry.pnl30dUsd,
            consistencyScore: 50.0,
            copyabilityScore: 50.0,
            oneHitWonderPenalty: 0.0,
            globalScore: 50.0,
            bestCategory: 'General',
            categoryStrengthsJson: '{}',
            averageTradeSize: 100.0,
            tradeCount30d: entry.tradeCount30d,
            resolvedTradeCount30d: 0,
            winRate30d: 0.0,
            averageLiquidity: 5000.0,
            averageSpread: 0.02,
            averageEntryTiming: 85.0,
            copyabilityNotes: 'Initial scan ingestion',
            riskNotes: 'Awaiting historical trade analysis',
            ruleSetId: activeRuleSet.id,
            lastScannedAt: result.scannedAt,
            provenance: result.provenance,
            createdAt: startedAt,
            updatedAt: startedAt
          };
          this.walletRepo.upsertWalletProfile(profile);
          accepted++;
        }
      }

      op.recordsAccepted = accepted;
      op.duplicatesCount = duplicates;
      op.status = result.entries.length < topN ? 'completed_with_warnings' : 'completed';
      op.completedAt = new Date().toISOString();
      op.diagnosticsJson = JSON.stringify({
        scanId: scan.id,
        entriesObtained: result.entries.length,
        populationTarget: topN,
        shortfall: Math.max(0, topN - result.entries.length)
      });
      this.ingestionRepo.saveOperation(op);

      return {
        operationId: op.id,
        operationType: op.operationType,
        status: op.status,
        isLive: op.isLive,
        recordsRequested: op.recordsRequested,
        recordsReceived: op.recordsReceived,
        recordsAccepted: op.recordsAccepted,
        recordsRejected: op.recordsRejected,
        duplicatesCount: op.duplicatesCount,
        errorsCount: op.errorsCount,
        summaryMessage: `Leaderboard scan completed. Received ${op.recordsReceived} wallets (Target: ${topN}). Accepted: ${accepted}, Updated: ${duplicates}.`,
        diagnostics: JSON.parse(op.diagnosticsJson)
      };

    } catch (err: unknown) {
      op.status = 'failed';
      op.errorsCount = 1;
      op.completedAt = new Date().toISOString();
      op.diagnosticsJson = JSON.stringify({
        error: (err as Error).message || String(err),
        stack: (err as Error).stack
      });
      this.ingestionRepo.saveOperation(op);

      return {
        operationId: op.id,
        operationType: op.operationType,
        status: 'failed',
        isLive: op.isLive,
        recordsRequested: op.recordsRequested,
        recordsReceived: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        duplicatesCount: 0,
        errorsCount: 1,
        summaryMessage: `Leaderboard scan failed: ${(err as Error).message}`,
        diagnostics: JSON.parse(op.diagnosticsJson)
      };
    }
  }

  /**
   * Ingests historical activity and newly observed trades for target wallets.
   */
  public async ingestWalletActivity(
    mode: 'live' | 'fixture',
    walletAddresses: string[],
    lookbackDays = 30,
    fixtureAdapter?: IWalletActivityAdapter
  ): Promise<IngestionExecutionResult> {
    ExecutionBoundary.assertPaperMode();

    const isLive = mode === 'live';
    const startedAt = new Date().toISOString();
    const opId = `op-wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const op: IngestionOperation = {
      id: opId,
      operationType: 'wallet_activity',
      targetIdentifier: walletAddresses.join(','),
      status: 'running',
      isLive,
      provider: isLive ? 'polymarket_data_api' : 'fixture_wallet_activity',
      endpoint: isLive ? `${this.config.dataApiBaseUrl}/trades` : 'fixture://wallet_activity',
      requestedWindowDays: lookbackDays,
      actualStartTimestamp: null,
      actualEndTimestamp: null,
      recordsRequested: walletAddresses.length,
      recordsReceived: 0,
      recordsAccepted: 0,
      recordsRejected: 0,
      duplicatesCount: 0,
      errorsCount: 0,
      diagnosticsJson: '{}',
      startedAt,
      completedAt: null,
      createdAt: startedAt
    };
    this.ingestionRepo.saveOperation(op);

    const adapter: IWalletActivityAdapter = fixtureAdapter || (
      isLive ? new PolymarketWalletActivityAdapter(this.config) : new FixtureWalletActivityAdapter()
    );

    let totalTradesReceived = 0;
    let totalTradesAccepted = 0;
    let totalDuplicates = 0;
    const walletSummaries: Record<string, unknown> = {};

    try {
      for (const address of walletAddresses) {
        try {
          const summary = await adapter.fetchHistoricalActivity(address, lookbackDays);
          walletSummaries[address] = {
            totalTrades: summary.totalTrades,
            totalPnlUsd: summary.totalPnlUsd,
            analyzedWindowDays: summary.analyzedWindowDays
          };

          for (const rawEvt of summary.recentActivity) {
            totalTradesReceived++;

            const trade: ObservedTrade = {
              id: rawEvt.eventId,
              walletAddress: rawEvt.walletAddress,
              marketId: rawEvt.marketId,
              conditionId: rawEvt.conditionId,
              marketQuestion: rawEvt.marketTitle,
              marketCategory: rawEvt.category,
              outcome: rawEvt.outcome,
              side: rawEvt.side,
              walletEntryPrice: rawEvt.price,
              detectedPrice: rawEvt.price,
              size: rawEvt.sizeUsd,
              sourceTxHash: rawEvt.txHash,
              sourceTimestamp: rawEvt.timestamp,
              rawTradeJson: JSON.stringify(rawEvt.rawPayload),
              provenance: summary.provenance,
              createdAt: startedAt
            };

            const inserted = this.tradeRepo.insertObservedTrade(trade);
            if (inserted) {
              totalTradesAccepted++;
            } else {
              totalDuplicates++;
            }
          }
        } catch (walletErr: unknown) {
          op.errorsCount++;
          walletSummaries[address] = { error: (walletErr as Error).message };
        }
      }

      op.recordsReceived = totalTradesReceived;
      op.recordsAccepted = totalTradesAccepted;
      op.duplicatesCount = totalDuplicates;
      op.status = op.errorsCount > 0 ? 'completed_with_warnings' : 'completed';
      op.completedAt = new Date().toISOString();
      op.diagnosticsJson = JSON.stringify({ walletSummaries });
      this.ingestionRepo.saveOperation(op);

      return {
        operationId: op.id,
        operationType: op.operationType,
        status: op.status,
        isLive: op.isLive,
        recordsRequested: op.recordsRequested,
        recordsReceived: op.recordsReceived,
        recordsAccepted: op.recordsAccepted,
        recordsRejected: op.recordsRejected,
        duplicatesCount: op.duplicatesCount,
        errorsCount: op.errorsCount,
        summaryMessage: `Wallet activity ingestion finished. Processed ${walletAddresses.length} wallets, received ${totalTradesReceived} trades, inserted ${totalTradesAccepted}, duplicates ignored ${totalDuplicates}.`,
        diagnostics: walletSummaries
      };

    } catch (err: unknown) {
      op.status = 'failed';
      op.errorsCount++;
      op.completedAt = new Date().toISOString();
      op.diagnosticsJson = JSON.stringify({ error: (err as Error).message });
      this.ingestionRepo.saveOperation(op);

      return {
        operationId: op.id,
        operationType: op.operationType,
        status: 'failed',
        isLive: op.isLive,
        recordsRequested: op.recordsRequested,
        recordsReceived: totalTradesReceived,
        recordsAccepted: totalTradesAccepted,
        recordsRejected: op.recordsRejected,
        duplicatesCount: totalDuplicates,
        errorsCount: op.errorsCount,
        summaryMessage: `Wallet activity ingestion failed: ${(err as Error).message}`,
        diagnostics: { error: (err as Error).message }
      };
    }
  }

  /**
   * Ingests point-in-time MarketSnapshot for a marketId.
   */
  public async ingestMarketSnapshot(
    mode: 'live' | 'fixture',
    marketId: string,
    fixtureAdapter?: IMarketDataAdapter
  ): Promise<MarketSnapshot> {
    ExecutionBoundary.assertPaperMode();

    const isLive = mode === 'live';
    const startedAt = new Date().toISOString();

    const adapter: IMarketDataAdapter = fixtureAdapter || (
      isLive ? new PolymarketMarketDataAdapter(this.config) : new FixtureMarketDataAdapter()
    );

    const rawState = await adapter.fetchMarketSnapshot(marketId);

    const snapshot: MarketSnapshot = {
      id: `ms-${Date.now()}-${marketId.slice(0, 8)}`,
      marketId: rawState.marketId,
      conditionId: rawState.conditionId,
      question: rawState.question,
      category: rawState.category,
      yesPrice: rawState.yesPrice,
      noPrice: rawState.noPrice,
      bestBid: rawState.bestBid,
      bestAsk: rawState.bestAsk,
      spread: rawState.spread,
      liquidity: rawState.liquidityUsd,
      volume: rawState.volume24hUsd,
      timeToResolution: rawState.estimatedResolutionTime
        ? Math.max(0, Math.floor((new Date(rawState.estimatedResolutionTime).getTime() - Date.now()) / 1000))
        : 86400 * 7,
      collectedAt: startedAt,
      rawMarketJson: JSON.stringify(rawState.rawPayload),
      provenance: rawState.provenance,
      createdAt: startedAt
    };

    this.marketRepo.insertSnapshot(snapshot);
    return snapshot;
  }
}
