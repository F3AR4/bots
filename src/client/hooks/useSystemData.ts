/**
 * TanStack Query Hooks for System Governance, Rules, and Daily Reports.
 * 
 * Strategy:
 * - RuleSets & RuleChanges are immutable versions, so polling is gentle (staleTime 30s).
 * - Daily Reports are rolled up on periodic intervals, so polling is gentle (staleTime 30s).
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { RulesResponse, ReportsResponse } from '../api/types';

export function useRuleSets() {
  return useQuery<RulesResponse, Error>({
    queryKey: ['system-rules'],
    queryFn: api.getRules,
    staleTime: 30000,
    retry: 2,
  });
}

export function useReports(limit = 30) {
  return useQuery<ReportsResponse, Error>({
    queryKey: ['system-reports', limit],
    queryFn: () => api.getReports(limit),
    staleTime: 30000,
    retry: 2,
  });
}
