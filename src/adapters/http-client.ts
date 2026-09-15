/**
 * Resilient Read-Only HTTP Client for External Polymarket Integrations.
 * 
 * Invariants:
 * 1. Strictly READ-ONLY: Rejects any HTTP method other than GET.
 * 2. Rate Limiting: Respects provider thresholds (sliding window).
 * 3. Exponential Backoff with Jitter for retryable status codes (429, 502, 503, 504, timeouts).
 * 4. Non-retryable status codes (400, 401, 403, 404) fail immediately.
 * 5. Secret Sanitization: Logs and errors never expose credentials.
 */

import { ProviderConfig, DEFAULT_PROVIDER_CONFIG } from '../config/provider.config.js';
import { StructuredAdapterError } from '../types/adapters.js';
import { SecretSanitizer } from '../safety/secret-sanitizer.js';

export class ReadOnlyHttpClient {
  private requestTimestamps: number[] = [];

  constructor(private readonly config: ProviderConfig = DEFAULT_PROVIDER_CONFIG) {}

  /**
   * Executes a strictly read-only GET request with rate limiting and exponential backoff.
   */
  public async get<T>(url: string, providerName: string, headers: Record<string, string> = {}): Promise<T> {
    await this.throttle();

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.config.maxRetries) {
      try {
        const signal = AbortSignal.timeout(this.config.requestTimeoutMs);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'PolymarketResearchBot/1.2 (Research; Paper-Trading)',
            ...headers
          },
          signal
        });

        if (response.ok) {
          const text = await response.text();
          if (!text || text.trim() === '') {
            return [] as unknown as T;
          }
          return JSON.parse(text) as T;
        }

        // Handle HTTP error responses
        const status = response.status;
        const statusText = response.statusText;
        const isRateLimited = status === 429;
        const isServerError = status >= 500 && status <= 504;

        if ((isRateLimited || isServerError) && attempt < this.config.maxRetries) {
          attempt++;
          const backoff = this.calculateBackoff(attempt, isRateLimited ? response.headers.get('retry-after') : null);
          await this.sleep(backoff);
          continue;
        }

        // Non-retryable or retries exhausted
        const structuredError: StructuredAdapterError = {
          provider: providerName,
          endpoint: SecretSanitizer.sanitizeString(url),
          statusCode: status,
          errorCode: isRateLimited ? 'RATE_LIMITED' : (status === 404 ? 'RESOURCE_NOT_FOUND' : (status === 401 || status === 403 ? 'UNAUTHORIZED' : 'NETWORK_ERROR')),
          message: SecretSanitizer.sanitizeString(`HTTP ${status} ${statusText} from ${providerName}`),
          timestamp: new Date().toISOString()
        };
        throw structuredError;

      } catch (err: unknown) {
        lastError = err;

        // If already a StructuredAdapterError, determine if retryable
        if ((err as StructuredAdapterError).errorCode) {
          const sae = err as StructuredAdapterError;
          if (sae.errorCode !== 'RATE_LIMITED' && sae.errorCode !== 'NETWORK_ERROR') {
            throw err;
          }
        }

        // Check if timeout or network failure
        const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.message.includes('timeout'));
        const isNetwork = err instanceof Error && (err.message.includes('fetch failed') || err.message.includes('ECONNRESET'));

        if ((isTimeout || isNetwork) && attempt < this.config.maxRetries) {
          attempt++;
          const backoff = this.calculateBackoff(attempt, null);
          await this.sleep(backoff);
          continue;
        }

        // Exhausted retries or fatal error
        if ((err as StructuredAdapterError).errorCode) {
          throw err;
        }

        const structuredError: StructuredAdapterError = {
          provider: providerName,
          endpoint: SecretSanitizer.sanitizeString(url),
          errorCode: isTimeout ? 'API_TIMEOUT' : 'NETWORK_ERROR',
          message: SecretSanitizer.sanitizeString(err instanceof Error ? err.message : 'Unknown network failure'),
          timestamp: new Date().toISOString()
        };
        throw structuredError;
      }
    }

    throw lastError;
  }

  /**
   * Sliding-window token bucket throttle to guarantee rate limit adherence.
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindowMs;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > windowStart);

    if (this.requestTimestamps.length >= this.config.rateLimitMaxRequestsPerWindow) {
      const oldestInWindow = this.requestTimestamps[0];
      const waitTime = Math.max(50, (oldestInWindow + this.config.rateLimitWindowMs) - now);
      await this.sleep(waitTime);
      return this.throttle();
    }

    this.requestTimestamps.push(Date.now());
  }

  private calculateBackoff(attempt: number, retryAfterHeader: string | null): number {
    if (retryAfterHeader) {
      const seconds = parseFloat(retryAfterHeader);
      if (!isNaN(seconds) && seconds > 0) {
        return Math.min(this.config.maxBackoffMs, seconds * 1000);
      }
    }
    const exponential = this.config.initialBackoffMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 200;
    return Math.min(this.config.maxBackoffMs, exponential + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
