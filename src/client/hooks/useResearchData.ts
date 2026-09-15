/**
 * TanStack Query Hooks for Research Module.
 * 
 * Invariants:
 * - Read-only queries.
 * - Stale time of 30s to 60s (research data changes on scan/re-evaluation cycles).
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  RankingsResponse,
  WalletProfileResponse,
  CopyabilitySummaryResponse,
  CopyabilityEvaluationsResponse,
} from '../api/types';

export function useWalletRankings(category?: string) {
  return useQuery<RankingsResponse, Error>({
    queryKey: ['wallet-rankings', category || 'ALL'],
    queryFn: () => api.getWalletRankings(category),
    staleTime: 30000,
    retry: 2,
  });
}

export function useWalletProfile(address: string | undefined) {
  return useQuery<WalletProfileResponse, Error>({
    queryKey: ['wallet-profile', address],
    queryFn: () => {
      if (!address) throw new Error('Wallet address is required');
      return api.getWalletProfile(address);
    },
    enabled: Boolean(address),
    staleTime: 30000,
    retry: 1,
  });
}

export function useCopyabilitySummary(window = '30d') {
  return useQuery<CopyabilitySummaryResponse, Error>({
    queryKey: ['copyability-summary', window],
    queryFn: () => api.getCopyabilitySummary(window),
    staleTime: 30000,
    retry: 2,
  });
}

export function useCopyabilityEvaluations(params?: { window?: string; classification?: string; limit?: number }) {
  return useQuery<CopyabilityEvaluationsResponse, Error>({
    queryKey: ['copyability-evaluations', params?.window, params?.classification, params?.limit],
    queryFn: () => api.getCopyabilityEvaluations(params),
    staleTime: 30000,
    retry: 2,
  });
}
