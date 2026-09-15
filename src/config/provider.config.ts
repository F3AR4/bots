/**
 * Provider Infrastructure Configuration.
 * 
 * Strict architectural rule:
 * Contains ONLY network, endpoint, rate-limiting, timeout, and pagination settings.
 * MUST NOT contain strategy parameters, score weights, or decision thresholds.
 * (Strategy parameters reside exclusively in RuleSetConfig).
 */

export interface ProviderConfig {
  dataApiBaseUrl: string;
  gammaApiBaseUrl: string;
  clobApiBaseUrl: string;
  requestTimeoutMs: number;
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  leaderboardPageLimit: number;
  tradesPageLimit: number;
  defaultHistoricalWindowDays: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequestsPerWindow: number;
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  dataApiBaseUrl: process.env.POLYMARKET_DATA_API_URL || 'https://data-api.polymarket.com',
  gammaApiBaseUrl: process.env.POLYMARKET_GAMMA_API_URL || 'https://gamma-api.polymarket.com',
  clobApiBaseUrl: process.env.POLYMARKET_CLOB_API_URL || 'https://clob.polymarket.com',
  requestTimeoutMs: 10000,
  maxRetries: 3,
  initialBackoffMs: 500,
  maxBackoffMs: 4000,
  leaderboardPageLimit: 50,
  tradesPageLimit: 100,
  defaultHistoricalWindowDays: 30,
  rateLimitWindowMs: 10000,
  rateLimitMaxRequestsPerWindow: 150
};
