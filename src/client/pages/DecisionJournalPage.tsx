import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  X,
  Layers,
  FileCheck2,
  BarChart3,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Link } from 'wouter';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { useDecisionJournal } from '../hooks/useOperationsData';
import { DecisionJournalItem } from '../api/types';

export const DecisionJournalPage: React.FC = () => {
  const { data, isLoading, error, refetch } = useDecisionJournal(100);
  const [selectedDecision, setSelectedDecision] = useState<DecisionJournalItem | null>(null);

  // Filters
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | 'paper_copy' | 'watchlist' | 'skip'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0);

  const decisions = data?.decisions || [];

  // Filtered decisions
  const filteredDecisions = useMemo(() => {
    return decisions.filter(d => {
      // Decision filter
      if (decisionFilter !== 'ALL' && d.decision !== decisionFilter) return false;

      // Min score filter
      if (d.copyScore < minScore) return false;

      // Search query (wallet or market)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesWallet = d.walletAddress.toLowerCase().includes(q);
        const matchesMarket = d.marketId.toLowerCase().includes(q);
        const matchesId = d.id.toLowerCase().includes(q);
        if (!matchesWallet && !matchesMarket && !matchesId) return false;
      }

      return true;
    });
  }, [decisions, decisionFilter, minScore, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingState rows={2} />
        <LoadingState rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Decision Journal Offline"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  const parseJsonArray = (str: string): string[] => {
    try {
      const parsed = JSON.parse(str);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString();
    } catch {
      return ts;
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'paper_copy':
        return <Badge variant="success">PAPER COPY</Badge>;
      case 'watchlist':
        return <Badge variant="warning">WATCHLIST</Badge>;
      case 'skip':
      default:
        return <Badge variant="neutral">SKIP</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-purple-400" />
            <span>Decision Audit Journal</span>
            <Badge variant="paper">FORENSIC AUDIT</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete audit trail detailing exactly WHY the bot chose paper_copy, watchlist, or skip for every observed trade.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            {filteredDecisions.length} of {decisions.length} Evaluations
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Verdict Filter */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-500 font-mono px-2">Decision:</span>
              {(['ALL', 'paper_copy', 'watchlist', 'skip'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDecisionFilter(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    decisionFilter === d
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {d === 'ALL' ? 'All' : d === 'paper_copy' ? 'Paper Copy' : d === 'watchlist' ? 'Watchlist' : 'Skip'}
                </button>
              ))}
            </div>

            {/* Min Score Filter */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>Min Score:</span>
              <input
                type="range"
                min="0"
                max="90"
                step="10"
                value={minScore}
                onChange={e => setMinScore(Number(e.target.value))}
                className="w-20 accent-purple-500"
              />
              <span className="text-slate-200 font-semibold w-6">{minScore}</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search wallet, market ID, decision..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </Card>

      {/* Decision Table */}
      {filteredDecisions.length === 0 ? (
        <EmptyState
          title="No Decisions Match Criteria"
          description="No decision journal records match the active filters. Background observations are evaluated continuously."
        />
      ) : (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60 font-mono text-[11px] text-slate-400">
                  <th className="py-3 px-4">Evaluation Time</th>
                  <th className="py-3 px-4">Wallet</th>
                  <th className="py-3 px-4">Market</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Decision</th>
                  <th className="py-3 px-4">Key Reason / Justification</th>
                  <th className="py-3 px-4 text-center">Paper Executed</th>
                  <th className="py-3 px-4 text-right">Forensics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredDecisions.map(decision => {
                  const reasons = parseJsonArray(decision.reasonsJson);
                  const risks = parseJsonArray(decision.risksJson);
                  const primaryReason = reasons.length > 0 ? reasons[0] : (risks.length > 0 ? risks[0] : 'Evaluated against RuleSet criteria');
                  const hasPaperTrade = decision.simulatedPositionSize > 0;

                  return (
                    <tr
                      key={decision.id}
                      className="hover:bg-slate-850/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedDecision(decision)}
                    >
                      {/* Time */}
                      <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatTimestamp(decision.evaluatedAt)}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Rule: {decision.ruleVersion}
                        </span>
                      </td>

                      {/* Wallet */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/research/wallet/${decision.walletAddress}`}
                          onClick={e => e.stopPropagation()}
                          className="font-mono text-indigo-300 hover:text-indigo-200 font-medium underline-offset-2 hover:underline flex items-center gap-1"
                        >
                          <span>{decision.walletAddress.slice(0, 6)}...{decision.walletAddress.slice(-4)}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                        </Link>
                      </td>

                      {/* Market */}
                      <td className="py-3.5 px-4 max-w-xs font-mono text-slate-300">
                        <span className="truncate block" title={decision.marketId}>
                          {decision.marketId.slice(0, 20)}...
                        </span>
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded font-semibold text-xs ${
                          decision.copyScore >= 70
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                            : decision.copyScore >= 50
                            ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {decision.copyScore.toFixed(0)}
                        </span>
                      </td>

                      {/* Decision */}
                      <td className="py-3.5 px-4 text-center">
                        {getDecisionBadge(decision.decision)}
                      </td>

                      {/* Key Reason */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="text-slate-300 truncate" title={primaryReason}>
                          {primaryReason}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                          <span>+{reasons.length} positive</span>
                          <span>•</span>
                          <span className={risks.length > 0 ? 'text-amber-400' : 'text-slate-500'}>
                            {risks.length} risk flags
                          </span>
                        </div>
                      </td>

                      {/* Paper Trade Executed */}
                      <td className="py-3.5 px-4 text-center font-mono">
                        {hasPaperTrade ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
                            ${decision.simulatedPositionSize.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedDecision(decision)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium border border-slate-700/60 transition-colors inline-flex items-center gap-1"
                        >
                          <span>Audit</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Decision Forensic Inspection Modal */}
      {selectedDecision && (
        <Modal
          isOpen={!!selectedDecision}
          onClose={() => setSelectedDecision(null)}
          maxWidth="3xl"
          title={
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-5 h-5 text-purple-400" />
              <span className="font-mono">Forensic Decision Audit #{selectedDecision.id.slice(0, 10)}</span>
            </div>
          }
          description="Detailed decomposition of wallet quality, liquidity, spread, and conservative decision guardrails."
          footer={
            <div className="flex items-center justify-between w-full">
              <Link
                href={`/research/wallet/${selectedDecision.walletAddress}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-mono flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded px-1"
              >
                <span>Inspect Copied Wallet</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <button
                onClick={() => setSelectedDecision(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                Close Audit
              </button>
            </div>
          }
        >
          {/* Verdict Explanation Banner */}
          <div className={`p-4 rounded-lg border ${
            selectedDecision.decision === 'paper_copy'
              ? 'bg-emerald-950/30 border-emerald-700/40 text-emerald-200'
              : selectedDecision.decision === 'watchlist'
              ? 'bg-amber-950/30 border-amber-700/40 text-amber-200'
              : 'bg-slate-950/40 border-slate-800 text-slate-300'
          } flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              {getDecisionBadge(selectedDecision.decision)}
              <div>
                <div className="font-semibold text-sm">
                  {selectedDecision.decision === 'paper_copy'
                    ? `Approved for Paper Execution ($${selectedDecision.simulatedPositionSize.toFixed(2)} Position Size)`
                    : selectedDecision.decision === 'watchlist'
                    ? 'Queued for Watchlist Observation'
                    : 'Skipped - Rejected by Threshold Guardrails'}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  Evaluated: {formatTimestamp(selectedDecision.evaluatedAt)}
                </div>
              </div>
            </div>

            <div className="text-right font-mono">
              <span className="text-slate-400 text-xs block">Composite Score</span>
              <span className="text-xl font-bold text-slate-100">
                {selectedDecision.copyScore.toFixed(1)}/100
              </span>
            </div>
          </div>

          {/* Granular Sub-Score Breakdown */}
          <div className="space-y-3">
            <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Granular Score Decomposition
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Wallet Quality</span>
                  <span className="text-slate-200 font-semibold">{selectedDecision.walletQualityScore.toFixed(0)}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${selectedDecision.walletQualityScore}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">ROI Edge</span>
                  <span className="text-slate-200 font-semibold">{selectedDecision.roiScore.toFixed(0)}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${selectedDecision.roiScore}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Consistency</span>
                  <span className="text-slate-200 font-semibold">{selectedDecision.consistencyScore.toFixed(0)}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${selectedDecision.consistencyScore}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Copyability</span>
                  <span className="text-slate-200 font-semibold">{selectedDecision.copyabilityScore.toFixed(0)}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${selectedDecision.copyabilityScore}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Category Fit</span>
                  <span className="text-slate-200 font-semibold">{selectedDecision.categoryFitScore.toFixed(0)}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${selectedDecision.categoryFitScore}%` }} />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Entry Timing</span>
                  <span className="text-slate-200 font-semibold">{selectedDecision.entryTimingScore.toFixed(0)}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${selectedDecision.entryTimingScore}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Reasons and Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Positive Factors ({parseJsonArray(selectedDecision.reasonsJson).length})
              </span>
              {parseJsonArray(selectedDecision.reasonsJson).length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                  {parseJsonArray(selectedDecision.reasonsJson).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs text-slate-500">No positive factors logged.</span>
              )}
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
              <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Active Risk Items ({parseJsonArray(selectedDecision.risksJson).length})
              </span>
              {parseJsonArray(selectedDecision.risksJson).length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                  {parseJsonArray(selectedDecision.risksJson).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-xs text-emerald-400 font-mono">Zero active risk items flagged.</span>
              )}
            </div>
          </div>

          {/* Entity Audit Links */}
          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs font-mono">
            <span className="text-slate-400 block text-[11px] font-semibold">Audit Provenance References</span>
            <div className="text-slate-300 flex items-center justify-between">
              <span className="text-slate-500">Observed Trade Reference:</span>
              <span className="text-slate-200">#{selectedDecision.observedTradeId}</span>
            </div>
            <div className="text-slate-300 flex items-center justify-between">
              <span className="text-slate-500">Market Snapshot Reference:</span>
              <span className="text-slate-200">#{selectedDecision.marketSnapshotId || 'N/A'}</span>
            </div>
            <div className="text-slate-300 flex items-center justify-between">
              <span className="text-slate-500">Applied RuleSet:</span>
              <span className="text-indigo-300">{selectedDecision.ruleSetId} ({selectedDecision.ruleVersion})</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
