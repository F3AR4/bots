/**
 * Verified Synthetic Demo / Seed Fixtures.
 * 
 * Invariants:
 * - All synthetic records are explicitly tagged with isDemo: true and DEMO_ prefixes.
 * - No fake data is disguised as live data.
 */

import {
  LeaderboardScan,
  WalletProfile,
  ObservedTrade,
  MarketSnapshot,
  DecisionJournal,
  PaperTrade,
  PnlSnapshot,
  OutcomeReview,
  DailyReport,
  ProvenanceMetadata
} from '../../types/domain.js';
import { DEFAULT_RULESET } from '../../config/ruleset.default.js';

const DEMO_PROVENANCE: ProvenanceMetadata = {
  provider: 'fixture_synthetic',
  sourceIdentifier: 'DEMO_PROVENANCE_V1',
  sourceTime: '2026-09-14T08:00:00.000Z',
  ingestionTime: '2026-09-14T08:05:00.000Z',
  normalizationVersion: 'v1.0.0',
  isDemo: true
};

export const DEMO_LEADERBOARD_SCAN: LeaderboardScan = {
  id: 'DEMO_SCAN_001',
  source: 'polymarket_fixture',
  scannedAt: '2026-09-14T08:00:00.000Z',
  walletCount: 50,
  lookbackDays: 30,
  rawSummaryJson: JSON.stringify({ note: 'Synthetic demo scan' }),
  provenance: DEMO_PROVENANCE,
  createdAt: '2026-09-14T08:05:00.000Z'
};

export const DEMO_WALLETS: WalletProfile[] = [
  {
    id: 'DEMO_WP_001',
    address: 'DEMO_0x71aB4c39824dE150000000000000000000000001',
    label: 'Consistent Macro Trader',
    sourceRank: 12,
    status: 'track',
    statusReason: 'Score 84.5 meets TRACK threshold (70.0). High consistency and deep liquidity.',
    roi30d: 0.74,
    consistencyScore: 82.0,
    copyabilityScore: 88.0,
    oneHitWonderPenalty: 0.0,
    globalScore: 84.5,
    bestCategory: 'Politics',
    categoryStrengthsJson: JSON.stringify({
      Politics: { winRate: 0.81, tradeCount: 22, roi: 0.65 },
      Crypto: { winRate: 0.55, tradeCount: 9, roi: 0.12 }
    }),
    averageTradeSize: 450.0,
    tradeCount30d: 31,
    resolvedTradeCount30d: 26,
    winRate30d: 0.769,
    averageLiquidity: 14500.0,
    averageSpread: 0.012,
    averageEntryTiming: 88.0,
    copyabilityNotes: 'Deep book participation with tight entry spreads.',
    riskNotes: 'Slight concentration in election contracts.',
    ruleSetId: DEFAULT_RULESET.id,
    lastScannedAt: '2026-09-14T08:00:00.000Z',
    provenance: DEMO_PROVENANCE,
    createdAt: '2026-09-14T08:05:00.000Z',
    updatedAt: '2026-09-14T08:05:00.000Z'
  },
  {
    id: 'DEMO_WP_002',
    address: 'DEMO_0x82bC5d40935eF260000000000000000000000002',
    label: 'One-Hit Lucky Whale',
    sourceRank: 3,
    status: 'ignore',
    statusReason: 'Penalty applied: 85% of profit came from single lucky trade in an illiquid market.',
    roi30d: 2.10,
    consistencyScore: 35.0,
    copyabilityScore: 30.0,
    oneHitWonderPenalty: 45.0,
    globalScore: 28.0,
    bestCategory: 'Pop Culture',
    categoryStrengthsJson: JSON.stringify({
      'Pop Culture': { winRate: 0.40, tradeCount: 5, roi: 2.05 }
    }),
    averageTradeSize: 8500.0,
    tradeCount30d: 8,
    resolvedTradeCount30d: 4,
    winRate30d: 0.25,
    averageLiquidity: 600.0,
    averageSpread: 0.075,
    averageEntryTiming: 42.0,
    copyabilityNotes: 'Massive market impact makes copying impossible.',
    riskNotes: 'Severe profit concentration; thin market liquidity.',
    ruleSetId: DEFAULT_RULESET.id,
    lastScannedAt: '2026-09-14T08:00:00.000Z',
    provenance: DEMO_PROVENANCE,
    createdAt: '2026-09-14T08:05:00.000Z',
    updatedAt: '2026-09-14T08:05:00.000Z'
  },
  {
    id: 'DEMO_WP_003',
    address: 'DEMO_0x93cD6e51046fG370000000000000000000000003',
    label: 'Emerging Sports Scalper',
    sourceRank: 64,
    status: 'watch',
    statusReason: 'Score 58.2 in WATCH tier (45-70). Need more resolved market history.',
    roi30d: 0.42,
    consistencyScore: 65.0,
    copyabilityScore: 70.0,
    oneHitWonderPenalty: 10.0,
    globalScore: 58.2,
    bestCategory: 'Sports',
    categoryStrengthsJson: JSON.stringify({
      Sports: { winRate: 0.60, tradeCount: 15, roi: 0.42 }
    }),
    averageTradeSize: 120.0,
    tradeCount30d: 18,
    resolvedTradeCount30d: 8,
    winRate30d: 0.625,
    averageLiquidity: 3200.0,
    averageSpread: 0.025,
    averageEntryTiming: 75.0,
    copyabilityNotes: 'Moderate spreads, reasonable fillability.',
    riskNotes: 'Sample size below statistical threshold.',
    ruleSetId: DEFAULT_RULESET.id,
    lastScannedAt: '2026-09-14T08:00:00.000Z',
    provenance: DEMO_PROVENANCE,
    createdAt: '2026-09-14T08:05:00.000Z',
    updatedAt: '2026-09-14T08:05:00.000Z'
  }
];

export const DEMO_OBSERVED_TRADE: ObservedTrade = {
  id: 'DEMO_OT_001',
  walletAddress: 'DEMO_0x71aB4c39824dE150000000000000000000000001',
  marketId: 'DEMO_MKT_SENATE_2026',
  conditionId: '0xabc1230000000000000000000000000000000001',
  marketQuestion: 'Will Republicans maintain Senate majority in 2026?',
  marketCategory: 'Politics',
  outcome: 'YES',
  side: 'BUY',
  walletEntryPrice: 0.52,
  detectedPrice: 0.525,
  size: 500.0,
  sourceTxHash: 'DEMO_TX_0x9999999999999999999999999999999999999999',
  sourceTimestamp: '2026-09-14T09:15:00.000Z',
  rawTradeJson: JSON.stringify({ demo: true, event: 'fill' }),
  provenance: DEMO_PROVENANCE,
  createdAt: '2026-09-14T09:15:02.000Z'
};

export const DEMO_MARKET_SNAPSHOT: MarketSnapshot = {
  id: 'DEMO_MS_001',
  marketId: 'DEMO_MKT_SENATE_2026',
  conditionId: '0xabc1230000000000000000000000000000000001',
  question: 'Will Republicans maintain Senate majority in 2026?',
  category: 'Politics',
  yesPrice: 0.525,
  noPrice: 0.475,
  bestBid: 0.52,
  bestAsk: 0.53,
  spread: 0.01,
  liquidity: 18500.0,
  volume: 124000.0,
  timeToResolution: 4500000,
  collectedAt: '2026-09-14T09:15:01.000Z',
  rawMarketJson: JSON.stringify({ demo: true }),
  provenance: DEMO_PROVENANCE,
  createdAt: '2026-09-14T09:15:02.000Z'
};

export const DEMO_DECISION_JOURNAL: DecisionJournal = {
  id: 'DEMO_DJ_001',
  observedTradeId: DEMO_OBSERVED_TRADE.id,
  marketSnapshotId: DEMO_MARKET_SNAPSHOT.id,
  walletAddress: DEMO_OBSERVED_TRADE.walletAddress,
  marketId: DEMO_OBSERVED_TRADE.marketId,
  decision: 'paper_copy',
  copyScore: 86.5,
  confidence: 0.75,
  reasonsJson: JSON.stringify([
    'Wallet ranked #12 with 84.5 global score',
    'Category win rate in Politics is 81%',
    'Tight spread (0.01) with $18.5k depth',
    'Minimal price drift ($0.005)'
  ]),
  risksJson: JSON.stringify([
    'Long duration market setup'
  ]),
  walletQualityScore: 84.5,
  roiScore: 74.0,
  consistencyScore: 82.0,
  copyabilityScore: 88.0,
  categoryFitScore: 81.0,
  entryTimingScore: 88.0,
  spreadScore: 90.0,
  liquidityScore: 95.0,
  thesisScore: 85.0,
  simulatedPositionSize: 16.25,
  ruleSetId: DEFAULT_RULESET.id,
  ruleVersion: DEFAULT_RULESET.version,
  evaluatedAt: '2026-09-14T09:15:03.000Z',
  createdAt: '2026-09-14T09:15:03.000Z'
};

export const DEMO_PAPER_TRADE: PaperTrade = {
  id: 'DEMO_PT_001',
  decisionJournalId: DEMO_DECISION_JOURNAL.id,
  observedTradeId: DEMO_OBSERVED_TRADE.id,
  walletAddress: DEMO_OBSERVED_TRADE.walletAddress,
  marketId: DEMO_OBSERVED_TRADE.marketId,
  conditionId: DEMO_OBSERVED_TRADE.conditionId,
  outcome: 'YES',
  side: 'BUY',
  entryPrice: 0.525,
  currentPrice: 0.58,
  simulatedPositionSize: 16.25,
  shares: 30.9524,
  unrealizedPnl: 1.70,
  realizedPnl: 0.0,
  status: 'open',
  executionMode: 'PAPER',
  ruleSetId: DEFAULT_RULESET.id,
  openedAt: '2026-09-14T09:15:03.000Z',
  closedAt: null,
  resolvedAt: null,
  createdAt: '2026-09-14T09:15:03.000Z',
  updatedAt: '2026-09-14T11:00:00.000Z'
};

export const DEMO_PNL_SNAPSHOT: PnlSnapshot = {
  id: 'DEMO_PNL_001',
  paperTradeId: DEMO_PAPER_TRADE.id,
  snapshotHour: '2026-09-14T10:00:00.000Z',
  priceAtSnapshot: 0.56,
  unrealizedPnl: 1.08,
  realizedPnl: 0.0,
  totalPositionValue: 17.33,
  capturedAt: '2026-09-14T10:00:00.000Z'
};

export const DEMO_OUTCOME_REVIEW: OutcomeReview = {
  id: 'DEMO_REV_001',
  paperTradeId: DEMO_PAPER_TRADE.id,
  decisionJournalId: DEMO_DECISION_JOURNAL.id,
  milestone: 'T+1h',
  priceAtMilestone: 0.56,
  simulatedPnlAtMilestone: 1.08,
  finalOutcome: undefined,
  wasDecisionGood: true,
  decisionQualityScore: 85.0,
  timingQualityScore: 88.0,
  spreadLiquidityImpact: 0.02,
  lessonsJson: JSON.stringify(['Profitable initial trajectory. Wallet timing validated.']),
  ruleSetId: DEFAULT_RULESET.id,
  reviewedAt: '2026-09-14T10:15:00.000Z',
  createdAt: '2026-09-14T10:15:00.000Z'
};

export const DEMO_DAILY_REPORT: DailyReport = {
  id: 'DEMO_REP_2026_09_14',
  reportDate: '2026-09-14',
  paperPnlToday: 1.70,
  totalPaperPnl: 1.70,
  winRate: 1.0,
  bestPaperTradeId: DEMO_PAPER_TRADE.id,
  worstPaperTradeId: null,
  bestWalletToday: DEMO_WALLETS[0].address,
  tradesCopiedCount: 1,
  tradesWatchedCount: 1,
  tradesSkippedCount: 1,
  activeRuleVersion: 'v1.0.0',
  summaryNotes: 'Demo research cycle completed. All execution remains PAPER ONLY.',
  createdAt: '2026-09-14T12:00:00.000Z'
};
