/**
 * Resolution & Outcome Adapter Implementation.
 * 
 * Complies with Contract D:
 * - Queries Gamma API for market resolution outcome and timestamp.
 * - Determines payout multipliers (1.0 or 0.0).
 * - Preserves provenance and raw payload.
 */

import { IResolutionAdapter, RawMarketResolution, StructuredAdapterError } from '../types/adapters.js';
import { ProviderConfig, DEFAULT_PROVIDER_CONFIG } from '../config/provider.config.js';
import { ReadOnlyHttpClient } from './http-client.js';
import { DataNormalizer } from './normalizer.js';

export class PolymarketResolutionAdapter implements IResolutionAdapter {
  public readonly providerName = 'polymarket_gamma';
  private readonly httpClient: ReadOnlyHttpClient;

  constructor(
    private readonly config: ProviderConfig = DEFAULT_PROVIDER_CONFIG,
    httpClient?: ReadOnlyHttpClient
  ) {
    this.httpClient = httpClient || new ReadOnlyHttpClient(config);
  }

  public async fetchMarketResolution(marketId: string): Promise<RawMarketResolution> {
    const ingestionTime = new Date().toISOString();

    let rawMarket: unknown;
    try {
      const url = `${this.config.gammaApiBaseUrl}/markets?id=${marketId}`;
      const response = await this.httpClient.get<unknown>(url, this.providerName);
      if (Array.isArray(response) && response.length > 0) {
        rawMarket = response[0];
      } else {
        const directUrl = `${this.config.gammaApiBaseUrl}/markets/${marketId}`;
        rawMarket = await this.httpClient.get<unknown>(directUrl, this.providerName);
      }
    } catch (err: unknown) {
      const error: StructuredAdapterError = {
        provider: this.providerName,
        endpoint: `${this.config.gammaApiBaseUrl}/markets/${marketId}`,
        errorCode: 'RESOURCE_NOT_FOUND',
        message: `Failed to fetch resolution metadata for market ${marketId}: ${(err as Error).message}`,
        timestamp: ingestionTime
      };
      throw error;
    }

    const normResult = DataNormalizer.normalizeMarketResolution(rawMarket, ingestionTime, true);
    if (!normResult.success) {
      const error: StructuredAdapterError = {
        provider: this.providerName,
        errorCode: 'PARSING_ERROR',
        message: `Resolution normalization failed: ${normResult.reason}`,
        timestamp: ingestionTime
      };
      throw error;
    }

    return normResult.data;
  }
}

/**
 * Fixture Resolution Adapter for testing.
 */
export class FixtureResolutionAdapter implements IResolutionAdapter {
  public readonly providerName = 'fixture_resolution';

  constructor(
    private readonly resolutions: Map<string, RawMarketResolution> = new Map(),
    private readonly shouldFail = false
  ) {}

  public async fetchMarketResolution(marketId: string): Promise<RawMarketResolution> {
    if (this.shouldFail) {
      const error: StructuredAdapterError = {
        provider: this.providerName,
        errorCode: 'NETWORK_ERROR',
        message: 'Simulated network failure on market resolution query',
        timestamp: new Date().toISOString()
      };
      throw error;
    }

    const res = this.resolutions.get(marketId);
    if (!res) {
      const error: StructuredAdapterError = {
        provider: this.providerName,
        errorCode: 'RESOURCE_NOT_FOUND',
        message: `Resolution record not found for market ${marketId}`,
        timestamp: new Date().toISOString()
      };
      throw error;
    }

    return res;
  }
}
