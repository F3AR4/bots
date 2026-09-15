import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Layers,
  ShieldCheck,
  BarChart3,
  Award,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { Link } from 'wouter';
import { Card } from '../components/ui/Card';
import { Metric } from '../components/ui/Metric';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { usePerformance } from '../hooks/useDashboardData';
import { CohortStats } from '../api/types';

export const PerformancePage: React.FC = () => {
  const { data: perf, isLoading, error, refetch } = usePerformance();
  const [attributionTab, setAttributionTab] = useState<'decision' | 'trades'>('decision');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingState rows={2} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingState rows={1} />
          <LoadingState rows={1} />
          <LoadingState rows={1} />
          <LoadingState rows={1} />
        </div>
        <LoadingState rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Performance Analytics Offline"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  const metrics = perf?.metrics;
  const totalTrades = metrics?.totalPaperTrades ?? 0;
  const openTrades = metrics?.openPaperTrades ?? 0;
  const closedTrades = metrics?.closedPaperTrades ?? 0;
  const realizedPnl = metrics?.realizedPnl ?? 0;
  const unrealizedPnl = metrics?.unrealizedPnl ?? 0;
  const totalPnl = metrics?.totalPnl ?? 0;
  const wins = metrics?.wins ?? 0;
  const losses = metrics?.losses ?? 0;
  const winRate = metrics?.winRate;
  const winRateStatus = metrics?.winRateStatus || (winRate === null ? 'INSUFFICIENT DATA' : 'AVAILABLE');

  const cohorts = perf?.benchmarkCohorts;
  const decisions = perf?.decisionsSummary;
  const histBenchmark = perf?.historicalResearchBenchmark;
  const recentTrades = perf?.recentPaperTrades || [];

  const botCohort = cohorts?.paper_copy;
  const blindCohort = cohorts?.blind_leaderboard;
  const watchlistCohort = cohorts?.watchlist;
  const skippedCohort = cohorts?.skipped;

  // Calculate delta if both cohorts have data
  const hasBlindComparison = Boolean(botCohort && blindCohort && (botCohort.tradeCount > 0 || blindCohort.tradeCount > 0));
  const pnlOutperformance = (botCohort?.totalPnl ?? 0) - (blindCohort?.totalPnl ?? 0);
  const winRateDelta = (botCohort?.winRate ?? 0) - (blindCohort?.winRate ?? 0);

  return (
    <div className="space-y-6">
      {/* Header with Strict Paper Guarantee */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span>Analytical Performance & Benchmark Workstation</span>
            <Badge variant="paper">SIMULATED PORTFOLIO</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Empirical evaluation comparing conservative paper-trading returns against blind copy benchmarks and research baselines.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Position Sizing Bounds:</span>
          <span className="px-2.5 py-1 rounded bg-slate-800 text-emerald-300 border border-slate-700 font-semibold">
            $5.00 min - $20.00 max
          </span>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          title="Total Paper PnL"
          value={`$${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`}
          subtext={`Unrealized: $${unrealizedPnl.toFixed(2)} | Realized: $${realizedPnl.toFixed(2)}`}
          trend={totalPnl >= 0 ? 'positive' : 'negative'}
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
        />
        <Metric
          title="Paper Win Rate"
          value={
            winRateStatus === 'INSUFFICIENT DATA'
              ? 'INSUFFICIENT DATA'
              : `${((winRate ?? 0) * 100).toFixed(1)}%`
          }
          subtext={
            winRateStatus === 'INSUFFICIENT DATA'
              ? metrics?.winRateReason || 'Awaiting market settlement'
              : `${wins}W - ${losses}L (${closedTrades} resolved)`
          }
          trend={winRateStatus === 'INSUFFICIENT DATA' ? 'warning' : (winRate ?? 0) >= 0.5 ? 'positive' : 'negative'}
          icon={<Percent className="w-4 h-4 text-indigo-400" />}
        />
        <Metric
          title="Paper Positions"
          value={totalTrades}
          subtext={`${openTrades} floating open | ${closedTrades} closed`}
          trend="neutral"
          icon={<Layers className="w-4 h-4 text-blue-400" />}
        />
        <Metric
          title="Execution Safety Invariant"
          value="PAPER ONLY"
          subtext="Zero private keys / zero order signing"
          trend="positive"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
        />
      </div>

      {/* Cohort Comparison Benchmark Section */}
      <Card
        header="Empirical Cohort Comparison (BenchmarkEngine)"
        headerAction={
          <span className="text-[11px] font-mono text-slate-400">
            {perf?.cohortDataStatus === 'AVAILABLE' ? 'Live Tracked Decisions' : 'Status: INSUFFICIENT DATA'}
          </span>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-100">Hypothesis Test: </span>
            Does the conservative copyability filter outperform copying all leaderboard trades blindly? Below is the side-by-side attribution across all 4 mutually exclusive cohorts.
          </div>

          {/* Outperformance Banner if data is present */}
          {hasBlindComparison && (
            <div className={`p-3.5 rounded-lg border ${
              pnlOutperformance >= 0
                ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-300'
                : 'bg-rose-950/20 border-rose-800/50 text-rose-300'
            } flex items-center justify-between text-xs font-mono`}>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" />
                <span>
                  Bot Filtering PnL Delta vs Blind Copying: {pnlOutperformance >= 0 ? '+' : ''}${pnlOutperformance.toFixed(2)}
                </span>
              </div>
              <div>
                Avoided Losers Filtered: {botCohort?.avoidedLosersCount ?? 0}
              </div>
            </div>
          )}

          {/* 4 Cohorts Comparison Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Cohort 1: Bot Paper Copy */}
            <div className="p-4 rounded-xl bg-slate-950/70 border-2 border-emerald-500/40 space-y-3 relative overflow-hidden shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 font-mono tracking-wide">
                  1. BOT PAPER COPY
                </span>
                <Badge variant="live">FILTERED</Badge>
              </div>
              <div className="space-y-1 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Trades:</span>
                  <span className="text-slate-200 font-semibold">{botCohort?.tradeCount ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Win Rate:</span>
                  <span className="text-slate-200 font-semibold">
                    {botCohort && botCohort.tradeCount > 0 ? `${(botCohort.winRate * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total PnL:</span>
                  <span className={`font-semibold ${(botCohort?.totalPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${(botCohort?.totalPnl ?? 0) >= 0 ? '+' : ''}{(botCohort?.totalPnl ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                  <span>Avg Return:</span>
                  <span>${(botCohort?.averagePnlPerTrade ?? 0).toFixed(2)}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 bg-slate-900/90 p-2 rounded border border-slate-800">
                Bad Copies: <span className="text-rose-400 font-mono font-semibold">{botCohort?.badCopiesCount ?? 0}</span>
              </div>
            </div>

            {/* Cohort 2: Blind Leaderboard Copy */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 font-mono tracking-wide">
                  2. BLIND COPY
                </span>
                <Badge variant="neutral">BENCHMARK</Badge>
              </div>
              <div className="space-y-1 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Trades:</span>
                  <span className="text-slate-200 font-semibold">{blindCohort?.tradeCount ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Win Rate:</span>
                  <span className="text-slate-200 font-semibold">
                    {blindCohort && blindCohort.tradeCount > 0 ? `${(blindCohort.winRate * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total PnL:</span>
                  <span className={`font-semibold ${(blindCohort?.totalPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${(blindCohort?.totalPnl ?? 0) >= 0 ? '+' : ''}{(blindCohort?.totalPnl ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                  <span>Avg Return:</span>
                  <span>${(blindCohort?.averagePnlPerTrade ?? 0).toFixed(2)}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 bg-slate-900/90 p-2 rounded border border-slate-800">
                Unfiltered copy of every detected trade
              </div>
            </div>

            {/* Cohort 3: Watchlist Trades */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 font-mono tracking-wide">
                  3. WATCHLIST
                </span>
                <Badge variant="watch">OBSERVED</Badge>
              </div>
              <div className="space-y-1 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Trades:</span>
                  <span className="text-slate-200 font-semibold">{watchlistCohort?.tradeCount ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Win Rate:</span>
                  <span className="text-slate-200 font-semibold">
                    {watchlistCohort && watchlistCohort.tradeCount > 0 ? `${(watchlistCohort.winRate * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total PnL:</span>
                  <span className={`font-semibold ${(watchlistCohort?.totalPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${(watchlistCohort?.totalPnl ?? 0) >= 0 ? '+' : ''}{(watchlistCohort?.totalPnl ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                  <span>Avg Return:</span>
                  <span>${(watchlistCohort?.averagePnlPerTrade ?? 0).toFixed(2)}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 bg-slate-900/90 p-2 rounded border border-slate-800">
                Conditional observation without execution
              </div>
            </div>

            {/* Cohort 4: Skipped Trades */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 font-mono tracking-wide">
                  4. SKIPPED TRADES
                </span>
                <Badge variant="neutral">REJECTED</Badge>
              </div>
              <div className="space-y-1 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Trades:</span>
                  <span className="text-slate-200 font-semibold">{skippedCohort?.tradeCount ?? 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Win Rate:</span>
                  <span className="text-slate-200 font-semibold">
                    {skippedCohort && skippedCohort.tradeCount > 0 ? `${(skippedCohort.winRate * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Potential PnL:</span>
                  <span className={`font-semibold ${(skippedCohort?.totalPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${(skippedCohort?.totalPnl ?? 0) >= 0 ? '+' : ''}{(skippedCohort?.totalPnl ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                  <span>Good Skips:</span>
                  <span className="text-emerald-400 font-semibold">{skippedCohort?.goodSkipsCount ?? 0}</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 bg-slate-900/90 p-2 rounded border border-slate-800">
                Missed Winners: <span className="text-amber-400 font-mono font-semibold">{skippedCohort?.missedWinnersCount ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Historical Research Benchmark Baseline */}
      {histBenchmark && (
        <Card
          header="30-Day Historical Research Baseline"
          headerAction={
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/50">
              {histBenchmark.dataMode}
            </span>
          }
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Hypothetical model calibrated across 30 days of trade-level historical execution data, accounting for realistic order book spreads, slippage drift, and detection latency.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-1">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Trades Analyzed</span>
                <span className="text-slate-200 font-semibold text-sm">
                  {histBenchmark.totalTradesAnalyzed?.toLocaleString() ?? 'N/A'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Copyable: {histBenchmark.copyableCount?.toLocaleString() ?? 'N/A'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Modeled Copy Return</span>
                <span className={`font-semibold text-sm ${(histBenchmark.modeledCopyPnL ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ${(histBenchmark.modeledCopyPnL ?? 0) >= 0 ? '+' : ''}{(histBenchmark.modeledCopyPnL ?? 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Wallet PnL: ${(histBenchmark.walletRealizedPnL ?? 0).toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Avoided Losers</span>
                <span className="text-emerald-400 font-semibold text-sm">
                  {histBenchmark.avoidedLosers ?? 0}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Missed Winners: {histBenchmark.missedWinners ?? 0}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-500 block text-[11px]">Avg Detection Latency</span>
                <span className="text-slate-200 font-semibold text-sm">
                  {(histBenchmark.avgLatencySeconds ?? 0).toFixed(1)}s
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Slippage modeled</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Decision Attribution & Breakdown Section */}
      <Card
        header="Strategy Decision Attribution"
        headerAction={
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setAttributionTab('decision')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                attributionTab === 'decision'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Decisions Distribution
            </button>
            <button
              onClick={() => setAttributionTab('trades')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                attributionTab === 'trades'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Recent Paper Trades ({recentTrades.length})
            </button>
          </div>
        }
      >
        {attributionTab === 'decision' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-800/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-emerald-400 font-semibold">Paper Copy</span>
                  <Badge variant="live">EXECUTED</Badge>
                </div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {decisions?.paperCopyCount ?? 0}
                </div>
                <span className="text-[11px] text-slate-400 block">
                  Met all quality, timing, and spread thresholds
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-amber-800/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-amber-400 font-semibold">Watchlist</span>
                  <Badge variant="watch">OBSERVED</Badge>
                </div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {decisions?.watchlistCount ?? 0}
                </div>
                <span className="text-[11px] text-slate-400 block">
                  Borderline score or aging market snapshot
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400 font-semibold">Skipped</span>
                  <Badge variant="neutral">FILTERED</Badge>
                </div>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {decisions?.skippedCount ?? 0}
                </div>
                <span className="text-[11px] text-slate-400 block">
                  Filtered out due to low score, wide spread, or drift
                </span>
              </div>
            </div>

            <div className="text-right pt-2">
              <Link
                href="/operations/decision-journal"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-mono inline-flex items-center gap-1"
              >
                <span>Inspect complete forensic decision audit journal</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {recentTrades.length === 0 ? (
              <EmptyState
                title="No Paper Trades in Attribution Sample"
                description="Simulated positions executed by the paper copy engine will be listed here with mark-to-market valuations."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-slate-800/80 bg-slate-900/60 text-slate-400 text-[11px]">
                      <th className="py-2.5 px-3">Trade ID</th>
                      <th className="py-2.5 px-3">Wallet</th>
                      <th className="py-2.5 px-3">Side / Outcome</th>
                      <th className="py-2.5 px-3 text-right">Entry</th>
                      <th className="py-2.5 px-3 text-right">Current</th>
                      <th className="py-2.5 px-3 text-right">Size</th>
                      <th className="py-2.5 px-3 text-right">PnL</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {recentTrades.map(trade => {
                      const effectivePnl = trade.status === 'open' ? trade.unrealizedPnl : trade.realizedPnl;
                      return (
                        <tr key={trade.id} className="hover:bg-slate-850/50">
                          <td className="py-2.5 px-3 text-blue-300 font-semibold">
                            #{trade.id.slice(0, 8)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {trade.walletAddress.slice(0, 6)}...{trade.walletAddress.slice(-4)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={trade.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                              {trade.side} {trade.outcome}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">${trade.entryPrice.toFixed(3)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-200 font-semibold">${trade.currentPrice.toFixed(3)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300">${trade.simulatedPositionSize.toFixed(2)}</td>
                          <td className={`py-2.5 px-3 text-right font-bold ${effectivePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ${effectivePnl >= 0 ? '+' : ''}{effectivePnl.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant={trade.status === 'open' ? 'indigo' : 'track'}>
                              {trade.status.toUpperCase()}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
