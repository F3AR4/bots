/**
 * Wallet Research Batch Pipeline.
 * 
 * Orchestrates:
 * 1. Target wallet population resolution (from leaderboard scan or explicit addresses).
 * 2. Batched database queries for observed trades and market snapshots (eliminates N+1).
 * 3. Multi-dimensional evaluation via WalletIntelligenceEngine.
 * 4. Deterministic global ranking and category-specific ranking.
 * 5. Immutable audit trail persistence (wallet_evaluations & wallet_profiles).
 * 6. Detailed stage execution metrics reporting.
 */

import { DatabaseSync } from 'node:sqlite';
import {
  RuleSet,
  WalletProfile,
  WalletResearchEvaluation,
  LeaderboardScan
} from '../types/domain.js';
import { WalletRepository } from '../db/repositories/wallet.repo.js';
import { TradeRepository } from '../db/repositories/trade.repo.js';
import { MarketRepository } from '../db/repositories/market.repo.js';
import { IngestionRepository } from '../db/repositories/ingestion.repo.js';
import { LeaderboardRepository } from '../db/repositories/leaderboard.repo.js';
import { WalletIntelligenceEngine, WalletAnalysisInput } from './wallet-intelligence.js';

export interface PipelineExecutionOptions {
  ruleSet: RuleSet;
  lookbackDays?: number;
  targetPopulation?: number;
  explicitWallets?: Array<{ address: string; sourceRank?: number; label?: string | null; pnlUsd?: number }>;
  clock?: () => string;
}

export interface PipelineExecutionReport {
  ruleSetId: string;
  ruleVersion: string;
  lookbackDays: number;
  walletsRequested: number;
  walletsAvailable: number;
  walletsAnalyzed: number;
  walletsInsufficientData: number;
  walletsScored: number;
  walletsTrack: number;
  walletsWatch: number;
  walletsIgnore: number;
  evaluations: WalletResearchEvaluation[];
  profiles: WalletProfile[];
  topTrackWallets: WalletProfile[];
  categoryLeaders: Record<string, WalletProfile>;
  executedAt: string;
  durationMs: number;
}

export class WalletResearchPipeline {
  private walletRepo: WalletRepository;
  private tradeRepo: TradeRepository;
  private marketRepo: MarketRepository;
  private ingestionRepo: IngestionRepository;
  private leaderboardRepo: LeaderboardRepository;

  constructor(private db: DatabaseSync) {
    this.walletRepo = new WalletRepository(db);
    this.tradeRepo = new TradeRepository(db);
    this.marketRepo = new MarketRepository(db);
    this.ingestionRepo = new IngestionRepository(db);
    this.leaderboardRepo = new LeaderboardRepository(db);
  }

  /**
   * Runs the complete research and ranking pipeline.
   */
  public async executePipeline(options: PipelineExecutionOptions): Promise<PipelineExecutionReport> {
    const startTime = Date.now();
    const clock = options.clock ?? (() => new Date().toISOString());
    const executedAt = clock();
    const lookbackDays = options.lookbackDays ?? 30;
    const targetPopulation = options.targetPopulation ?? 500;
    const ruleSet = options.ruleSet;

    // --- Step 1: Target Wallet Resolution ---
    let targets: Array<{ address: string; sourceRank: number; label: string | null; pnlUsd?: number }> = [];

    if (options.explicitWallets && options.explicitWallets.length > 0) {
      targets = options.explicitWallets.map((w, idx) => ({
        address: w.address,
        sourceRank: w.sourceRank ?? idx + 1,
        label: w.label ?? null,
        pnlUsd: w.pnlUsd
      }));
    } else {
      // Load latest leaderboard scan from DB
      const latestScan = this.leaderboardRepo.getLatestScan();
      if (latestScan) {
        try {
          const parsed = JSON.parse(latestScan.rawSummaryJson || '[]');
          if (Array.isArray(parsed)) {
            targets = parsed.slice(0, targetPopulation).map((item: any, idx: number) => ({
              address: item.walletAddress || item.address || `0xunknown_${idx}`,
              sourceRank: item.sourceRank || item.rank || idx + 1,
              label: item.userName || item.label || null,
              pnlUsd: item.pnlUsd || item.pnl || 0
            }));
          }
        } catch {
          // If summary parse fails, fallback to distinct wallets in observed_trades
        }
      }

      if (targets.length === 0) {
        // Fallback: discover wallets from observed_trades
        const stmt = this.db.prepare('SELECT DISTINCT wallet_address FROM observed_trades LIMIT ?');
        const rows = stmt.all(targetPopulation) as Array<{ wallet_address: string }>;
        targets = rows.map((r, idx) => ({
          address: r.wallet_address,
          sourceRank: idx + 1,
          label: null
        }));
      }
    }

    const walletsRequested = targetPopulation;
    const walletsAvailable = targets.length;

    if (targets.length === 0) {
      return {
        ruleSetId: ruleSet.id,
        ruleVersion: ruleSet.version,
        lookbackDays,
        walletsRequested,
        walletsAvailable: 0,
        walletsAnalyzed: 0,
        walletsInsufficientData: 0,
        walletsScored: 0,
        walletsTrack: 0,
        walletsWatch: 0,
        walletsIgnore: 0,
        evaluations: [],
        profiles: [],
        topTrackWallets: [],
        categoryLeaders: {},
        executedAt,
        durationMs: Date.now() - startTime
      };
    }

    // --- Step 2: Batched Data Retrieval ---
    const walletAddresses = targets.map(t => t.address);
    const cutoffTimestamp = new Date(new Date(executedAt).getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    // Batch load trades for all target wallets
    const allTrades = this.tradeRepo.listTradesForWallets(walletAddresses, cutoffTimestamp);

    // Group trades by wallet
    const tradesByWallet = new Map<string, typeof allTrades>();
    for (const t of allTrades) {
      const list = tradesByWallet.get(t.walletAddress) || [];
      list.push(t);
      tradesByWallet.set(t.walletAddress, list);
    }

    // Collect distinct market IDs
    const distinctMarketIds = Array.from(new Set(allTrades.map(t => t.marketId)));

    // Batch load latest snapshots for all encountered markets
    const snapshotsByMarketId = this.marketRepo.getLatestSnapshotsForMarkets(distinctMarketIds);

    // --- Step 3 & 4: Multi-Dimensional Evaluation via Intelligence Engine ---
    let walletsInsufficientData = 0;
    let walletsTrack = 0;
    let walletsWatch = 0;
    let walletsIgnore = 0;

    const evaluatedPairs: Array<{
      profile: WalletProfile;
      evaluation: WalletResearchEvaluation;
    }> = [];

    for (const target of targets) {
      const walletTrades = tradesByWallet.get(target.address) || [];

      const analysisInput: WalletAnalysisInput = {
        walletAddress: target.address,
        sourceRank: target.sourceRank,
        label: target.label,
        observedTrades: walletTrades,
        marketSnapshotsByMarketId: snapshotsByMarketId,
        providerReportedPnlUsd: target.pnlUsd,
        windowDays: lookbackDays
      };

      const result = WalletIntelligenceEngine.analyzeWallet(analysisInput, ruleSet, clock);

      if (result.evaluation.dataCompleteness.evidenceTier === 'INSUFFICIENT_EVIDENCE') {
        walletsInsufficientData++;
      }

      if (result.profile.status === 'track') walletsTrack++;
      else if (result.profile.status === 'watch') walletsWatch++;
      else walletsIgnore++;

      evaluatedPairs.push({
        profile: result.profile,
        evaluation: result.evaluation
      });
    }

    // --- Step 5: Deterministic Global Ranking ---
    // Sort deterministically: finalScore DESC, then sourceRank ASC, then walletAddress ASC (tie-breaker)
    evaluatedPairs.sort((a, b) => {
      if (b.evaluation.finalScore !== a.evaluation.finalScore) {
        return b.evaluation.finalScore - a.evaluation.finalScore;
      }
      if (a.profile.sourceRank !== b.profile.sourceRank) {
        return a.profile.sourceRank - b.profile.sourceRank;
      }
      return a.evaluation.walletAddress.localeCompare(b.evaluation.walletAddress);
    });

    // Assign global ranks
    evaluatedPairs.forEach((pair, index) => {
      pair.evaluation.globalRank = index + 1;
    });

    // --- Step 6: Deterministic Category Ranking ---
    const categoryGroups = new Map<string, typeof evaluatedPairs>();
    for (const pair of evaluatedPairs) {
      const cat = pair.evaluation.bestCategory || 'General';
      const list = categoryGroups.get(cat) || [];
      list.push(pair);
      categoryGroups.set(cat, list);
    }

    const categoryLeaders: Record<string, WalletProfile> = {};

    for (const [category, list] of categoryGroups.entries()) {
      // Sort within category
      list.sort((a, b) => {
        if (b.evaluation.finalScore !== a.evaluation.finalScore) {
          return b.evaluation.finalScore - a.evaluation.finalScore;
        }
        return a.evaluation.walletAddress.localeCompare(b.evaluation.walletAddress);
      });

      list.forEach((pair, idx) => {
        pair.evaluation.categoryRank = idx + 1;
      });

      if (list.length > 0) {
        categoryLeaders[category] = list[0].profile;
      }
    }

    // --- Step 7: Persistence of Audit Records & Profiles ---
    for (const pair of evaluatedPairs) {
      this.walletRepo.upsertWalletProfile(pair.profile);
      this.walletRepo.saveWalletEvaluation(pair.evaluation);
    }

    const profiles = evaluatedPairs.map(p => p.profile);
    const evaluations = evaluatedPairs.map(p => p.evaluation);
    const topTrackWallets = profiles.filter(p => p.status === 'track').slice(0, 20);

    return {
      ruleSetId: ruleSet.id,
      ruleVersion: ruleSet.version,
      lookbackDays,
      walletsRequested,
      walletsAvailable,
      walletsAnalyzed: evaluatedPairs.length,
      walletsInsufficientData,
      walletsScored: evaluatedPairs.length,
      walletsTrack,
      walletsWatch,
      walletsIgnore,
      evaluations,
      profiles,
      topTrackWallets,
      categoryLeaders,
      executedAt,
      durationMs: Date.now() - startTime
    };
  }
}
