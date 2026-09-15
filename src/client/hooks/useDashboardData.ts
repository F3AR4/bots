/**
 * TanStack Query Hooks for Research Observability.
 * 
 * Polling Strategy:
 * - Status & Signals: 5-second interval while window is focused.
 * - Ingestion & Performance: 10-second interval.
 * - Stale time: 3 seconds to avoid unnecessary rapid refetches.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  SystemStatusResponse,
  PerformanceResponse,
  IngestionStatusResponse,
  LatestSignalResponse,
} from '../api/types';

export function useSystemStatus() {
  return useQuery<SystemStatusResponse, Error>({
    queryKey: ['system-status'],
    queryFn: api.getSystemStatus,
    refetchInterval: 5000,
    staleTime: 3000,
    retry: 2,
  });
}

export function usePerformance() {
  return useQuery<PerformanceResponse, Error>({
    queryKey: ['performance'],
    queryFn: api.getPerformance,
    refetchInterval: 10000,
    staleTime: 5000,
    retry: 2,
  });
}

export function useIngestionStatus() {
  return useQuery<IngestionStatusResponse, Error>({
    queryKey: ['ingestion-status'],
    queryFn: api.getIngestionStatus,
    refetchInterval: 10000,
    staleTime: 5000,
    retry: 2,
  });
}

export function useLatestSignal() {
  return useQuery<LatestSignalResponse, Error>({
    queryKey: ['latest-signal'],
    queryFn: api.getLatestSignal,
    refetchInterval: 5000,
    staleTime: 2500,
    retry: 2,
  });
}
