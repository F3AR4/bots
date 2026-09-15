import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  GitCompare,
  ArrowLeft,
  Filter,
  Layers,
  Activity,
  AlertOctagon,
  Clock,
  TrendingDown,
  TrendingUp,
  Info,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Metric } from '../components/ui/Metric';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { Modal } from '../components/ui/Modal';
import {
  useCopyabilitySummary,
  useCopyabilityEvaluations,
} from '../hooks/useResearchData';
import { HistoricalCopyEvaluationItem } from '../api/types';

export const CopyabilityResearchPage: React.FC = () => {
  const [classificationFilter, setClassificationFilter] = useState<string>('ALL');
  const [selectedEvaluation, setSelectedEvaluation] = useState<HistoricalCopyEvaluationItem | null>(null);

  const { data: summaryData, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } =
    useCopyabilitySummary('30d');

  const { data: evalsData, isLoading: evalsLoading, error: evalsError, refetch: refetchEvals } =
    useCopyabilityEvaluations({
      window: '30d',
      classification: classificationFilter,
      limit: 50,
    });

  const summary = summaryData?.summary;
  const evaluations = evalsData?.evaluations || [];

  return (
    <div className="space-y-6">
      {/* Top Banner: Strict Historical Disclaimer */}
      <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-indigo-200">
          <Info className="w-5 h-5 text-indigo-400 shrink-0" />
          <div>
            <span className="font-bold text-indigo-300 uppercase tracking-wider font-mono">
              [HISTORICAL RESEARCH DATA - HYPOTHETICAL SIMULATION]
            </span>
            <p className="text-slate-400 mt-0.5">
              Simulates realistic order-book fill prices accounting for bid-ask spread slippage, order-book depth, and execution latency.
            </p>
          </div>
        </div>
        <Badge variant="paper">RESEARCH DATASET</Badge>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Link href="/research/wallets">
            <Button variant="outline" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Wallet Leaderboard
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
              <span>Realistic Copyability Engine</span>
              <span className="text-xs font-normal text-slate-400 font-mono">
                (30-day historical trade evaluation)
              </span>
            </h1>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            refetchSummary();
            refetchEvals();
          }}
        >
          Refresh Research
        </Button>
      </div>

      {/* Summary KPI Strip */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <LoadingState rows={1} />
          <LoadingState rows={1} />
          <LoadingState rows={1} />
          <LoadingState rows={1} />
        </div>
      ) : summaryError ? (
        <ErrorState
          title="Summary Metrics Unavailable"
          message={summaryError.message}
          onRetry={() => refetchSummary()}
        />
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Metric
            title="Analyzed Trades"
            value={summary.totalTradesAnalyzed}
            subtext={`${summary.copyableCount} copyable / ${summary.unfollowableCount} unfollowable`}
            trend="neutral"
            icon={<Layers className="w-4 h-4" />}
          />

          <Metric
            title="Feasible Copy Ratio"
            value={
              summary.totalTradesAnalyzed > 0
                ? `${((summary.copyableCount / summary.totalTradesAnalyzed) * 100).toFixed(1)}%`
                : 'INSUFFICIENT DATA'
            }
            subtext="Realistic depth and spread bounds met"
            trend={summary.copyableCount > 0 ? 'positive' : 'neutral'}
            icon={<Activity className="w-4 h-4" />}
          />

          <Metric
            title="Modeled Copy PnL"
            value={`${summary.totalModeledCopyPnL >= 0 ? '+' : ''}$${summary.totalModeledCopyPnL.toFixed(2)}`}
            subtext={`Wallet PnL: $${summary.totalWalletPnL.toFixed(2)} (Delta: ${summary.totalCopyPnLDelta >= 0 ? '+' : ''}$${summary.totalCopyPnLDelta.toFixed(2)})`}
            trend={summary.totalModeledCopyPnL >= 0 ? 'positive' : 'negative'}
            icon={summary.totalModeledCopyPnL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          />

          <Metric
            title="Avoided Losers"
            value={summary.avoidedLoserCount}
            subtext={`${summary.missedWinnerCount} missed winners due to spread`}
            trend="positive"
            icon={<AlertOctagon className="w-4 h-4 text-emerald-400" />}
          />
        </div>
      ) : null}

      {/* Filter Controls */}
      <Card subtle className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-500 px-2 flex items-center gap-1 font-mono text-[11px]">
              <Filter className="w-3 h-3" /> Classification:
            </span>
            {(['ALL', 'COPYABLE', 'DIFFICULT', 'UNFOLLOWABLE'] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => setClassificationFilter(cls)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  classificationFilter === cls
                    ? cls === 'COPYABLE'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                      : cls === 'DIFFICULT'
                      ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                      : cls === 'UNFOLLOWABLE'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                      : 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 font-mono">
            Displaying {evaluations.length} trade evaluations
          </span>
        </div>
      </Card>

      {/* Trade Evaluations Table */}
      {evalsLoading ? (
        <LoadingState rows={6} />
      ) : evalsError ? (
        <ErrorState
          title="Failed to Load Copyability Evaluations"
          message={evalsError.message}
          onRetry={() => refetchEvals()}
        />
      ) : evaluations.length === 0 ? (
        <EmptyState
          title="No Copyability Evaluations Found"
          description="Run the historical copyability research pipeline to model realistic fills across observed trades."
          command="npm run research:copyability"
          icon={<GitCompare className="w-6 h-6 text-indigo-400" />}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-mono text-[11px]">
                  <th className="py-3 px-4 font-medium">Wallet / Trade</th>
                  <th className="py-3 px-4 font-medium text-right">Wallet Entry</th>
                  <th className="py-3 px-4 font-medium text-right">Modeled Copy</th>
                  <th className="py-3 px-4 font-medium text-right">Drift / Latency</th>
                  <th className="py-3 px-4 font-medium text-right">Spread / Depth</th>
                  <th className="py-3 px-4 font-medium">Classification</th>
                  <th className="py-3 px-4 font-medium">Research Cohort</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {evaluations.map((e) => {
                  const copyBadge =
                    e.classification === 'COPYABLE'
                      ? 'badge-track'
                      : e.classification === 'DIFFICULT'
                      ? 'badge-watch'
                      : 'badge-ignore';

                  const cohortBadge =
                    e.cohort === 'GOOD_COPY' || e.cohort === 'AVOIDED_LOSER'
                      ? 'badge-track'
                      : e.cohort === 'MISSED_WINNER'
                      ? 'badge-watch'
                      : 'badge-ignore';

                  const drift = e.priceDrift ?? 0;
                  const driftColor = Math.abs(drift) > 0.03 ? 'text-rose-400' : 'text-emerald-400';

                  return (
                    <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Wallet / Trade */}
                      <td className="py-3 px-4">
                        <Link
                          href={`/research/wallet/${e.walletAddress}`}
                          className="font-mono text-indigo-300 hover:text-indigo-200 font-semibold"
                        >
                          {e.walletAddress.slice(0, 8)}...
                        </Link>
                        <div className="text-[11px] text-slate-500 font-mono truncate max-w-xs mt-0.5">
                          {e.marketId}
                        </div>
                      </td>

                      {/* Wallet Entry */}
                      <td className="py-3 px-4 text-right">
                        <div className="text-slate-200 font-semibold">
                          ${e.walletEntryPrice.toFixed(3)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ${e.walletEntrySize.toFixed(0)} USD
                        </div>
                      </td>

                      {/* Modeled Copy */}
                      <td className="py-3 px-4 text-right">
                        {e.modeledCopyPrice !== null ? (
                          <>
                            <div className="text-indigo-300 font-semibold">
                              ${e.modeledCopyPrice.toFixed(3)}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase font-mono">
                              {e.fillModel}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-500">UNAVAILABLE</span>
                        )}
                      </td>

                      {/* Drift / Latency */}
                      <td className="py-3 px-4 text-right">
                        <div className={driftColor}>
                          {drift > 0 ? '+' : ''}${drift.toFixed(3)}
                        </div>
                        <div className="text-[11px] text-amber-400/80">
                          +{e.latencySeconds !== null ? `${e.latencySeconds}s` : '0s'}
                        </div>
                      </td>

                      {/* Spread / Depth */}
                      <td className="py-3 px-4 text-right">
                        <div className="text-slate-300">
                          {e.spreadAtCopy !== null ? `${(e.spreadAtCopy * 100).toFixed(1)}¢ sprd` : '-'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {e.liquidityAtCopy !== null ? `$${Math.round(e.liquidityAtCopy).toLocaleString()} dpth` : '-'}
                        </div>
                      </td>

                      {/* Classification */}
                      <td className="py-3 px-4 font-sans">
                        <span className={`badge ${copyBadge} text-[11px]`}>
                          {e.classification}
                        </span>
                      </td>

                      {/* Research Cohort */}
                      <td className="py-3 px-4 font-sans">
                        <span className={`badge ${cohortBadge} text-[11px]`}>
                          {e.cohort}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEvaluation(e)}
                        >
                          Timeline
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Trade Timeline Modal / Drawer */}
      {selectedEvaluation && (
        <Modal
          isOpen={!!selectedEvaluation}
          onClose={() => setSelectedEvaluation(null)}
          title={
            <div>
              <span className="text-xs font-mono uppercase text-indigo-400 font-semibold block">
                Trade Execution Timeline
              </span>
              <span className="font-mono text-base">Evaluation: {selectedEvaluation.id.slice(0, 16)}...</span>
            </div>
          }
          description="Granular latency breakdown from wallet entry to observation and modeled fill execution."
          footer={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSelectedEvaluation(null)}
            >
              Done
            </Button>
          }
        >
          {/* Timeline Stepper */}
          <div className="space-y-4 text-xs font-mono">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-700 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                t0
              </div>
              <div className="flex-1">
                <div className="font-sans font-semibold text-slate-200">
                  Wallet On-Chain Entry Execution
                </div>
                <div className="text-slate-400 mt-0.5">
                  Wallet entered position at <strong className="text-slate-200">${selectedEvaluation.walletEntryPrice.toFixed(3)}</strong> (${selectedEvaluation.walletEntrySize.toFixed(0)} USD)
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Timestamp: {selectedEvaluation.timeline?.t0WalletEntry || selectedEvaluation.walletEntryTimestamp}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400 font-bold shrink-0">
                t1
              </div>
              <div className="flex-1">
                <div className="font-sans font-semibold text-slate-200">
                  System Observation & Ingestion
                </div>
                <div className="text-slate-400 mt-0.5">
                  Observed market price at detection: <strong className="text-slate-200">${selectedEvaluation.observedPrice?.toFixed(3) ?? '-'}</strong>
                </div>
                <div className="text-[11px] text-amber-400 mt-1">
                  Ingestion Latency: +{selectedEvaluation.timeline?.latencyWalletToObservationMs ?? 0}ms
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-400 font-bold shrink-0">
                t3
              </div>
              <div className="flex-1">
                <div className="font-sans font-semibold text-slate-200">
                  Simulated Realistic Copy Fill Execution
                </div>
                <div className="text-slate-400 mt-0.5">
                  Hypothetical fill price after slippage: <strong className="text-indigo-300">${selectedEvaluation.modeledCopyPrice?.toFixed(3) ?? '-'}</strong> ({selectedEvaluation.fillModel})
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Spread: {selectedEvaluation.spreadAtCopy ? `${(selectedEvaluation.spreadAtCopy * 100).toFixed(1)}¢` : '-'} | Depth: ${selectedEvaluation.liquidityAtCopy ? Math.round(selectedEvaluation.liquidityAtCopy).toLocaleString() : '-'}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                t5
              </div>
              <div className="flex-1">
                <div className="font-sans font-semibold text-slate-200">
                  Market Outcome & PnL Delta
                </div>
                <div className="text-slate-400 mt-0.5">
                  Wallet Outcome: <strong className="text-slate-200">{selectedEvaluation.walletOutcome || 'UNRESOLVED'}</strong> | Modeled Copy: <strong className="text-slate-200">{selectedEvaluation.modeledCopyOutcome || 'UNRESOLVED'}</strong>
                </div>
                <div className="text-[11px] text-emerald-400 mt-1">
                  Modeled Copy PnL Delta: {selectedEvaluation.copyPnlDelta !== null ? `${selectedEvaluation.copyPnlDelta >= 0 ? '+' : ''}$${selectedEvaluation.copyPnlDelta.toFixed(2)}` : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
