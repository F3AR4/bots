/**
 * Data Ingestion and External Adapter Contracts.
 * 
 * Defines provider-agnostic interfaces for external market and wallet data.
 * Adheres strictly to:
 * 1. Zero data fabrication on failure.
 * 2. Real structured error returns.
 * 3. Preservation of raw payloads and provenance.
 */

import { ProvenanceMetadata } from './domain.js';

export interface StructuredAdapterError {
  provider: string;
  endpoint?: string;
  statusCode?: number;
  errorCode: 'API_TIMEOUT' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'UNAUTHORIZED' | 'PARSING_ERROR' | 'RESOURCE_NOT_FOUND';
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface RawLeaderboardEntry {
  sourceRank: number;
  walletAddress: string;
  pseudonym?: string;
  pnl30dUsd: number;
  volume30dUsd: number;
  tradeCount30d: number;
  rawPayload: Record<string, unknown>;
}

export interface LeaderboardFetchResult {
  scanId: string;
  source: string;
  scannedAt: string;
  lookbackDays: number;
  entries: RawLeaderboardEntry[];
  provenance: ProvenanceMetadata;
}

export interface RawWalletActivityEvent {
  eventId: string;
  walletAddress: string;
  marketId: string;
  conditionId: string;
  marketTitle: string;
  category: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  price: number;
  sizeUsd: number;
  shares: number;
  timestamp: string;            // Upstream transaction timestamp
  txHash?: string;
  rawPayload: Record<string, unknown>;
}

export interface WalletHistoricalActivitySummary {
  walletAddress: string;
  analyzedWindowDays: number;
  totalTrades: number;
  resolvedTrades: number;
  winningTrades: number;
  totalPnlUsd: number;
  largestSingleWinUsd: number;
  tradesByCategory: Record<string, { totalTrades: number; resolvedTrades: number; wins: number; pnlUsd: number }>;
  averageLiquidityUsd: number;
  averageSpread: number;
  averageEntryTiming?: number;
  recentActivity: RawWalletActivityEvent[];
  provenance: ProvenanceMetadata;
}

export interface RawMarketState {
  marketId: string;
  conditionId: string;
  question: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  liquidityUsd: number;
  volume24hUsd: number;
  estimatedResolutionTime?: string;
  rawPayload: Record<string, unknown>;
  provenance: ProvenanceMetadata;
}

export interface RawMarketResolution {
  marketId: string;
  conditionId: string;
  isResolved: boolean;
  winningOutcome?: string;       // 'YES' | 'NO'
  payoutPrice?: number;          // Typically 1.0 for win, 0.0 for loss
  resolutionTime?: string;
  rawPayload: Record<string, unknown>;
  provenance: ProvenanceMetadata;
}

/** Contract A: Leaderboard Source */
export interface ILeaderboardAdapter {
  readonly providerName: string;
  fetchLeaderboard(topN?: number, lookbackDays?: number): Promise<LeaderboardFetchResult>;
}

/** Contract B: Wallet Activity & Live Trade Source */
export interface IWalletActivityAdapter {
  readonly providerName: string;
  fetchHistoricalActivity(walletAddress: string, days?: number): Promise<WalletHistoricalActivitySummary>;
  fetchRecentTrades(walletAddresses: string[], sinceTimestamp?: string): Promise<RawWalletActivityEvent[]>;
}

/** Contract C: Market Data Source */
export interface IMarketDataAdapter {
  readonly providerName: string;
  fetchMarketSnapshot(marketId: string): Promise<RawMarketState>;
  fetchBatchMarketSnapshots(marketIds: string[]): Promise<Map<string, RawMarketState>>;
}

/** Contract D: Outcome & Resolution Source */
export interface IResolutionAdapter {
  readonly providerName: string;
  fetchMarketResolution(marketId: string): Promise<RawMarketResolution>;
}
