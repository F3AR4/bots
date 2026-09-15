/**
 * TanStack Query Hooks for Operations & Observability.
 * 
 * Safety Guarantee:
 * - Read-only queries against Polymarket paper-trading endpoints.
 * - Zero transaction submission or key-handling capabilities.
 * - Structured polling without excessive request storms.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  LiveSignalsResponse,
  LiveSignalDetailResponse,
  PaperTradesResponse,
  PaperTradeDetailResponse,
  DecisionJournalResponse,
  MonitorSystemHealthResponse,
} from '../api/types';

export function useMonitorStatus() {
  return useQuery<MonitorSystemHealthResponse, Error>({
    queryKey: ['monitor-status'],
    queryFn: api.getMonitorStatus,
    refetchInterval: 5000,
    staleTime: 2500,
    retry: 2,
  });
}

export function useStartEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.startEngine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitor-status'] });
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
    },
  });
}

export function useStopEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.stopEngine,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitor-status'] });
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
    },
  });
}

export function useSignals(limit = 50) {
  return useQuery<LiveSignalsResponse, Error>({
    queryKey: ['live-signals', limit],
    queryFn: () => api.getSignals(limit),
    refetchInterval: 5000,
    staleTime: 2500,
    retry: 2,
  });
}

export function useSignalDetail(id?: string) {
  return useQuery<LiveSignalDetailResponse, Error>({
    queryKey: ['signal-detail', id],
    queryFn: () => api.getSignalById(id!),
    enabled: Boolean(id),
    staleTime: 10000,
    retry: 1,
  });
}

export function usePaperTrades() {
  return useQuery<PaperTradesResponse, Error>({
    queryKey: ['paper-trades'],
    queryFn: api.getPaperTrades,
    refetchInterval: 8000,
    staleTime: 4000,
    retry: 2,
  });
}

export function usePaperTradeDetail(id?: string) {
  return useQuery<PaperTradeDetailResponse, Error>({
    queryKey: ['paper-trade-detail', id],
    queryFn: () => api.getPaperTradeById(id!),
    enabled: Boolean(id),
    staleTime: 10000,
    retry: 1,
  });
}

export function useDecisionJournal(limit = 50) {
  return useQuery<DecisionJournalResponse, Error>({
    queryKey: ['decision-journal', limit],
    queryFn: () => api.getDecisions(limit),
    refetchInterval: 8000,
    staleTime: 4000,
    retry: 2,
  });
}

