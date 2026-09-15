/**
 * Leaderboard Adapter Implementation.
 * 
 * Complies with Contract A & Section 4:
 * - Paginated ingestion to retrieve requested population (e.g. top 500).
 * - Real read-only GET requests against verified Data API endpoints.
 * - Strict schema validation: malformed rows rejected cleanly with diagnostics.
 * - Never fabricates missing rows; records actual counts.
 * - Preserves provenance, raw payloads, and rankings.
 */

import { ILeaderboardAdapter, LeaderboardFetchResult, RawLeaderboardEntry, StructuredAdapterError } from '../types/adapters.js';
import { ProvenanceMetadata } from '../types/domain.js';
import { ProviderConfig, DEFAULT_PROVIDER_CONFIG } from '../config/provider.config.js';
import { ReadOnlyHttpClient } from './http-client.js';
import { DataNormalizer } from './normalizer.js';

export class PolymarketLeaderboardAdapter implements ILeaderboardAdapter {
  public readonly providerName = 'polymarket_data_api';
  private readonly httpClient: ReadOnlyHttpClient;

  constructor(
    private readonly config: ProviderConfig = DEFAULT_PROVIDER_CONFIG,
    httpClient?: ReadOnlyHttpClient
  ) {
    this.httpClient = httpClient || new ReadOnlyHttpClient(config);
  }

  /**
   * Fetches top N leaderboard entries with paginated retrieval.
   */
  public async fetchLeaderboard(topN = 500, lookbackDays = 30): Promise<LeaderboardFetchResult> {
    const ingestionTime = new Date().toISOString();
    const entries: RawLeaderboardEntry[] = [];
    const pageSize = Math.min(this.config.leaderboardPageLimit, 100);
    let offset = 0;
    let consecutiveEmptyPages = 0;

    const periodParam = lookbackDays <= 1 ? 'DAY' : (lookbackDays <= 7 ? 'WEEK' : 'MONTH');

    while (entries.length < topN && consecutiveEmptyPages < 2) {
      const currentLimit = Math.min(pageSize, topN - entries.length);
      const url = `${this.config.dataApiBaseUrl}/v1/leaderboard?limit=${currentLimit}&offset=${offset}&timePeriod=${periodParam}`;

      let rawPage: unknown;
      try {
        rawPage = await this.httpClient.get<unknown>(url, this.providerName);
      } catch (err: unknown) {
        // If v1 endpoint fails with 404, try alternative /leaderboard path
        if ((err as StructuredAdapterError).statusCode === 404) {
          const fallbackUrl = `${this.config.dataApiBaseUrl}/leaderboard?limit=${currentLimit}&offset=${offset}&window=${lookbackDays}d`;
          rawPage = await this.httpClient.get<unknown>(fallbackUrl, this.providerName);
        } else {
          throw err;
        }
      }

      // Handle array or wrapped object ({ data: [...] } or { entries: [...] })
      let rawList: unknown[] = [];
      if (Array.isArray(rawPage)) {
        rawList = rawPage;
      } else if (rawPage && typeof rawPage === 'object') {
        const obj = rawPage as Record<string, unknown>;
        if (Array.isArray(obj.data)) rawList = obj.data;
        else if (Array.isArray(obj.entries)) rawList = obj.entries;
        else if (Array.isArray(obj.leaderboard)) rawList = obj.leaderboard;
      }

      if (rawList.length === 0) {
        consecutiveEmptyPages++;
        break;
      }

      consecutiveEmptyPages = 0;

      for (const item of rawList) {
        const currentRank = entries.length + 1;
        const normResult = DataNormalizer.normalizeLeaderboardEntry(item, currentRank, ingestionTime, true);
        if (normResult.success) {
          entries.push(normResult.data);
          if (entries.length >= topN) break;
        } else {
          console.warn(`[LEADERBOARD_INGESTION_WARN] Row rejected: ${normResult.reason}`);
        }
      }

      offset += rawList.length;

      // If page had fewer items than requested, reached end of available records
      if (rawList.length < currentLimit) {
        break;
      }
    }

    const provenance: ProvenanceMetadata = {
      provider: this.providerName,
      sourceIdentifier: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceTime: ingestionTime,
      ingestionTime,
      normalizationVersion: DataNormalizer.NORMALIZATION_VERSION,
      isDemo: false
    };

    return {
      scanId: provenance.sourceIdentifier,
      source: 'polymarket',
      scannedAt: ingestionTime,
      lookbackDays,
      entries,
      provenance
    };
  }
}

/**
 * Fixture Leaderboard Adapter for deterministic testing and demo seeding.
 * Explicitly labeled as isDemo: true.
 */
export class FixtureLeaderboardAdapter implements ILeaderboardAdapter {
  public readonly providerName = 'fixture_leaderboard';

  constructor(
    private readonly fixtureEntries: RawLeaderboardEntry[],
    private readonly shouldFail = false
  ) {}

  public async fetchLeaderboard(topN = 500, lookbackDays = 30): Promise<LeaderboardFetchResult> {
    if (this.shouldFail) {
      const error: StructuredAdapterError = {
        provider: this.providerName,
        errorCode: 'API_TIMEOUT',
        message: 'Simulated fixture network timeout for resilience testing',
        timestamp: new Date().toISOString()
      };
      throw error;
    }

    const now = new Date().toISOString();
    const provenance: ProvenanceMetadata = {
      provider: this.providerName,
      sourceIdentifier: `fixture-scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceTime: now,
      ingestionTime: now,
      normalizationVersion: DataNormalizer.NORMALIZATION_VERSION,
      isDemo: true
    };

    return {
      scanId: provenance.sourceIdentifier,
      source: 'fixture',
      scannedAt: now,
      lookbackDays,
      entries: this.fixtureEntries.slice(0, topN),
      provenance
    };
  }
}
