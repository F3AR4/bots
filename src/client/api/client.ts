/**
 * Centralized Typed API Client.
 * 
 * Safety Guarantee:
 * - Read-only (GET requests only).
 * - No signing, private key handling, or write mutations.
 * - Strict error classification without fabricating fallback metrics.
 */

import {
  SystemStatusResponse,
  PerformanceResponse,
  IngestionStatusResponse,
  LatestSignalResponse,
  ApiClientError,
  RankingsResponse,
  WalletProfileResponse,
  CopyabilitySummaryResponse,
  CopyabilityEvaluationsResponse,
  LiveSignalsResponse,
  LiveSignalDetailResponse,
  PaperTradesResponse,
  PaperTradeDetailResponse,
  DecisionJournalResponse,
  MonitorSystemHealthResponse,
  RulesResponse,
  ReportsResponse,
} from './types';

export class ApiError extends Error {
  public readonly status?: number;
  public readonly endpoint: string;
  public readonly timestamp: string;

  constructor(error: ApiClientError) {
    super(error.message);
    this.name = 'ApiError';
    this.status = error.status;
    this.endpoint = error.endpoint;
    this.timestamp = error.timestamp;
  }
}

async function fetchGet<T>(endpoint: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = `API Error ${res.status}: ${res.statusText}`;
      try {
        const errorBody = await res.json();
        if (errorBody.error) message = errorBody.error;
      } catch {
        // Fallback to HTTP status text
      }
      throw new ApiError({
        message,
        status: res.status,
        endpoint,
        timestamp: new Date().toISOString(),
      });
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') {
      throw new ApiError({
        message: `Request timed out after ${timeoutMs}ms`,
        endpoint,
        timestamp: new Date().toISOString(),
      });
    }
    throw new ApiError({
      message: err.message || 'Network request failed',
      endpoint,
      timestamp: new Date().toISOString(),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchPost<T>(endpoint: string, body?: any, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = `API Error ${res.status}: ${res.statusText}`;
      try {
        const errorBody = await res.json();
        if (errorBody.error) message = errorBody.error;
      } catch {
        // Fallback
      }
      throw new ApiError({
        message,
        status: res.status,
        endpoint,
        timestamp: new Date().toISOString(),
      });
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') {
      throw new ApiError({
        message: `Request timed out after ${timeoutMs}ms`,
        endpoint,
        timestamp: new Date().toISOString(),
      });
    }
    throw new ApiError({
      message: err.message || 'Network request failed',
      endpoint,
      timestamp: new Date().toISOString(),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  getSystemStatus: () => fetchGet<SystemStatusResponse>('/api/v1/status'),
  getPerformance: () => fetchGet<PerformanceResponse>('/api/v1/performance'),
  getIngestionStatus: () => fetchGet<IngestionStatusResponse>('/api/v1/ingestion/status'),
  getLatestSignal: () => fetchGet<LatestSignalResponse>('/api/v1/signals/latest'),
  getSignals: (limit = 50) => fetchGet<LiveSignalsResponse>(`/api/v1/signals?limit=${limit}`),
  getSignalById: (id: string) => fetchGet<LiveSignalDetailResponse>(`/api/v1/signals/${encodeURIComponent(id)}`),
  getPaperTrades: () => fetchGet<PaperTradesResponse>('/api/v1/paper-trades'),
  getPaperTradeById: (id: string) => fetchGet<PaperTradeDetailResponse>(`/api/v1/paper-trades/${encodeURIComponent(id)}`),
  getDecisions: (limit = 50) => fetchGet<DecisionJournalResponse>(`/api/v1/decisions?limit=${limit}`),
  getMonitorStatus: () => fetchGet<MonitorSystemHealthResponse>('/api/v1/monitor/status'),
  getRules: () => fetchGet<RulesResponse>('/api/v1/rules'),
  getReports: (limit = 30) => fetchGet<ReportsResponse>(`/api/v1/reports?limit=${limit}`),
  getWalletRankings: (category?: string) => {
    const query = category && category !== 'ALL' ? `?category=${encodeURIComponent(category)}` : '';
    return fetchGet<RankingsResponse>(`/api/v1/research/rankings${query}`);
  },
  getWalletProfile: (address: string) => 
    fetchGet<WalletProfileResponse>(`/api/v1/research/wallets/${encodeURIComponent(address)}`),
  getCopyabilitySummary: (window = '30d') => 
    fetchGet<CopyabilitySummaryResponse>(`/api/v1/research/copyability/summary?window=${encodeURIComponent(window)}`),
  getCopyabilityEvaluations: (params?: { window?: string; classification?: string; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.window) sp.set('window', params.window);
    if (params?.classification && params.classification !== 'ALL') sp.set('classification', params.classification);
    if (params?.limit) sp.set('limit', String(params.limit));
    const qs = sp.toString() ? `?${sp.toString()}` : '';
    return fetchGet<CopyabilityEvaluationsResponse>(`/api/v1/research/copyability/evaluations${qs}`);
  },
  // Task 2.0 Real Lifecycle Controls
  startEngine: () => fetchPost<{ success: boolean; state: string; message: string }>('/api/v1/control/start'),
  stopEngine: () => fetchPost<{ success: boolean; state: string; message: string }>('/api/v1/control/stop'),
};

