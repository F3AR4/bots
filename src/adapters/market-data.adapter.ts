/**
 * Market Data Adapter Implementation.
 * 
 * Complies with Contract C & Sections 7 & 8:
 * - Queries Gamma API for market metadata, question, outcomes, clobTokenIds.
 * - Queries CLOB API for real-time orderbook snapshots (best bid, best ask, spread, depth).
 * - Produces independently timestamped MarketSnapshot records.
 * - Preserves raw payloads and provenance.
 */

import { IMarketDataAdapter, RawMarketState, StructuredAdapterError } from '../types/adapters.js';
import { ProvenanceMetadata } from '../types/domain.js';
import { ProviderConfig, DEFAULT_PROVIDER_CONFIG } from '../config/provider.config.js';
import { ReadOnlyHttpClient } from './http-client.js';
import { DataNormalizer } from './normalizer.js';

export class PolymarketMarketDataAdapter implements IMarketDataAdapter {
  public readonly providerName = 'polymarket_gamma_clob';
  private readonly httpClient: ReadOnlyHttpClient;

  constructor(
    private readonly config: ProviderConfig = DEFAULT_PROVIDER_CONFIG,
    httpClient?: ReadOnlyHttpClient
  ) {
    this.httpClient = httpClient || new ReadOnlyHttpClient(config);
  }

  /**
   * Fetches full market state snapshot by combining Gamma metadata and CLOB order book.
   */
  public async fetchMarketSnapshot(marketId: string): Promise<RawMarketState> {
    const ingestionTime = new Date().toISOString();

    // 1. Fetch market metadata from Gamma API
    let rawMarket: unknown;
    try {
      // Try /markets?id= or /markets/{id}
      const gammaUrl = `${this.config.gammaApiBaseUrl}/markets?id=${marketId}`;
      const response = await this.httpClient.get<unknown>(gammaUrl, 'polymarket_gamma');
      if (Array.isArray(response) && response.length > 0) {
        rawMarket = response[0];
      } else {
        const directUrl = `${this.config.gammaApiBaseUrl}/markets/${marketId}`;
        rawMarket = await this.httpClient.get<unknown>(directUrl, 'polymarket_gamma');
      }
    } catch (err: unknown) {
      const error: StructuredAdapterError = {
        provider: 'polymarket_gamma',
        endpoint: `${this.config.gammaApiBaseUrl}/markets/${marketId}`,
        errorCode: 'RESOURCE_NOT_FOUND',
        message: `Failed to fetch Gamma metadata for market ${marketId}: ${(err as Error).message}`,
        timestamp: ingestionTime
      };
      throw error;
    }

    // 2. Fetch orderbook from CLOB API if token ID is discovered
    let rawBook: unknown = null;
    const mkt = rawMarket as Record<string, unknown>;
    let clobTokenId: string | undefined = undefined;

    if (mkt.clobTokenIds) {
      try {
        const ids = typeof mkt.clobTokenIds === 'string' ? JSON.parse(mkt.clobTokenIds) : mkt.clobTokenIds;
        if (Array.isArray(ids) && ids.length > 0) {
          clobTokenId = String(ids[0]);
        }
      } catch {
        // Fall back to token array
      }
    }
    if (!clobTokenId && Array.isArray(mkt.tokens) && mkt.tokens.length > 0) {
      clobTokenId = String((mkt.tokens[0] as Record<string, unknown>).token_id || (mkt.tokens[0] as Record<string, unknown>).tokenId);
    }

    if (clobTokenId) {
      try {
        const clobUrl = `${this.config.clobApiBaseUrl}/book?token_id=${clobTokenId}`;
        rawBook = await this.httpClient.get<unknown>(clobUrl, 'polymarket_clob');
      } catch (err: unknown) {
        console.warn(`[MARKET_DATA_WARN] CLOB orderbook unavailable for token ${clobTokenId}: ${(err as Error).message}`);
      }
    }

    // 3. Normalize into domain snapshot
    const normResult = DataNormalizer.normalizeMarketSnapshot(rawMarket, rawBook, ingestionTime, true);
    if (!normResult.success) {
      const error: StructuredAdapterError = {
        provider: this.providerName,
        errorCode: 'PARSING_ERROR',
        message: `Market normalization failed: ${normResult.reason}`,
        timestamp: ingestionTime
      };
      throw error;
    }

    const snapshot = normResult.data;

    return {
      marketId: snapshot.marketId,
      conditionId: snapshot.conditionId,
      question: snapshot.question,
      category: snapshot.category,
      yesPrice: snapshot.yesPrice,
      noPrice: snapshot.noPrice,
      bestBid: snapshot.bestBid,
      bestAsk: snapshot.bestAsk,
      spread: snapshot.spread,
      liquidityUsd: snapshot.liquidity,
      volume24hUsd: snapshot.volume,
      estimatedResolutionTime: new Date(Date.now() + snapshot.timeToResolution * 1000).toISOString(),
      rawPayload: { market: rawMarket, book: rawBook },
      provenance: snapshot.provenance
    };
  }

  public async fetchBatchMarketSnapshots(marketIds: string[]): Promise<Map<string, RawMarketState>> {
    const map = new Map<string, RawMarketState>();
    for (const id of marketIds) {
      try {
        const snapshot = await this.fetchMarketSnapshot(id);
        map.set(id, snapshot);
      } catch (err: unknown) {
        console.warn(`[BATCH_MARKET_WARN] Skipping snapshot for market ${id}: ${(err as Error).message}`);
      }
    }
    return map;
  }
}

/**
 * Fixture Market Data Adapter for testing.
 */
export class FixtureMarketDataAdapter implements IMarketDataAdapter {
  public readonly providerName = 'fixture_market_data';

  constructor(
    private readonly markets: Map<string, RawMarketState> = new Map(),
    private readonly shouldFail = false
  ) {}

  public async fetchMarketSnapshot(marketId: string): Promise<RawMarketState> {
    if (this.shouldFail) {
      const error: StructuredAdapterError = {
        provider: this.providerName,
        errorCode: 'NETWORK_ERROR',
        message: 'Simulated network failure on market snapshot retrieval',
        timestamp: new Date().toISOString()
      };
      throw error;
    }

    const market = this.markets.get(marketId);
    if (!market) {
      const error: StructuredAdapterError = {
        provider: this.providerName,
        errorCode: 'RESOURCE_NOT_FOUND',
        message: `Market with ID ${marketId} not found in fixture store`,
        timestamp: new Date().toISOString()
      };
      throw error;
    }

    return market;
  }

  public async fetchBatchMarketSnapshots(marketIds: string[]): Promise<Map<string, RawMarketState>> {
    const map = new Map<string, RawMarketState>();
    for (const id of marketIds) {
      map.set(id, await this.fetchMarketSnapshot(id));
    }
    return map;
  }
}
