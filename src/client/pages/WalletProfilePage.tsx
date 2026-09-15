import React from 'react';
import { useRoute, Link } from 'wouter';
import {
  ArrowLeft,
  Wallet,
  Shield,
  Percent,
  Layers,
  AlertTriangle,
  Clock,
  TrendingUp,
  Award,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Metric } from '../components/ui/Metric';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { useWalletProfile } from '../hooks/useResearchData';
import { WalletStatus } from '../api/types';

export const WalletProfilePage: React.FC = () => {
  const [, params] = useRoute('/research/wallet/:address');
  const address = params?.address;

  const { data, isLoading, error, refetch } = useWalletProfile(address);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-800 rounded w-48 animate-pulse" />
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

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Link href="/research/wallets">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Wallet Rankings
          </Button>
        </Link>
        <ErrorState
          title="Wallet Profile Unavailable"
          message={error?.message || `No intelligence record found for address: ${address}`}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const wallet = data.wallet;
  const ev = data.evaluation;
  const trades = data.recentTrades || [];

  const status: WalletStatus = ev?.status || wallet.status || 'ignore';
  const score = ev?.finalScore ?? wallet.globalScore ?? 0;
  const rank = ev?.globalRank ?? wallet.sourceRank ?? 999;
  const statusReasons = ev?.statusReasons || [wallet.statusReason || 'Standard status criteria'];

  // Performance metrics
  const winRate = wallet.winRate30d;
  const hasWinRate = typeof winRate === 'number' && wallet.resolvedTradeCount30d > 0;
  const oneHit = ev?.oneHitWonderDiagnostics;
  const copyFactors = ev?.copyabilityFactors;
  const completeness = ev?.dataCompleteness;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Link href="/research/wallets">
            <Button variant="outline" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Leaderboard
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-indigo-400 font-semibold">
                Wallet Forensics
              </span>
              <Badge variant={status} dot>
                {status.toUpperCase()}
              </Badge>
              <Badge variant="paper">SIMULATION RESEARCH</Badge>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-100 font-mono tracking-tight mt-1 break-all">
              {wallet.address}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 px-2.5 py-1 bg-slate-900 rounded border border-slate-800">
            Rank #{rank} | RuleSet: {ev?.ruleVersion || wallet.ruleSetId || 'v1.0.0'}
          </span>
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          title="Composite Score"
          value={score.toFixed(1)}
          subtext={
            ev?.totalPenaltyDeduction ? (
              <span className="text-rose-400">-{ev.totalPenaltyDeduction.toFixed(1)} penalty applied</span>
            ) : (
              'Raw score maintained'
            )
          }
          trend={score >= 70 ? 'positive' : score >= 50 ? 'warning' : 'negative'}
          icon={<Award className="w-4 h-4" />}
        />

        <Metric
          title="30D Win Rate"
          value={hasWinRate ? `${(winRate * 100).toFixed(1)}%` : 'INSUFFICIENT DATA'}
          subtext={
            wallet.resolvedTradeCount30d > 0
              ? `${wallet.resolvedTradeCount30d} resolved of ${wallet.tradeCount30d} total trades`
              : 'Requires closed market resolutions'
          }
          trend={hasWinRate && winRate >= 0.55 ? 'positive' : 'neutral'}
          icon={<Percent className="w-4 h-4" />}
        />

        <Metric
          title="Copyability Score"
          value={wallet.copyabilityScore ? wallet.copyabilityScore.toFixed(1) : 'N/A'}
          subtext={
            copyFactors?.averageHistoricalSpread
              ? `${(copyFactors.averageHistoricalSpread * 100).toFixed(1)}¢ avg spread`
              : 'Evaluated copy feasibility'
          }
          trend={wallet.copyabilityScore >= 70 ? 'positive' : 'neutral'}
          icon={<Zap className="w-4 h-4" />}
        />

        <Metric
          title="Category Edge"
          value={wallet.bestCategory || ev?.bestCategory || 'General'}
          subtext={`Category Rank #${ev?.categoryRank || 1}`}
          trend="neutral"
          icon={<Layers className="w-4 h-4" />}
        />
      </div>

      {/* Forensic Audit Panels (2x2 Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Panel 1: Status Reasons & Strategy Governance */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Status Justification & Evidence Level</span>
            </div>
          }
          headerAction={
            <Badge variant={completeness?.evidenceLevel === 'COMPLETE' ? 'track' : 'watch'}>
              {completeness?.evidenceLevel || 'PARTIAL'} EVIDENCE
            </Badge>
          }
        >
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 font-medium">Evaluation Reasons:</span>
              <ul className="mt-1.5 space-y-1 pl-4 list-disc text-slate-300">
                {statusReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Analysis Window:</span>
                <span className="font-mono text-slate-200">30 Days</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Full Historical Coverage:</span>
                <span className="font-mono flex items-center gap-1">
                  {completeness?.hasFullHistoricalTransactions ? (
                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Partial</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Last Scanned:</span>
                <span className="font-mono text-slate-300">
                  {wallet.lastScannedAt ? new Date(wallet.lastScannedAt).toLocaleString() : 'Recent'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Panel 2: One-Hit-Wonder & Profit Concentration Analysis */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>One-Hit-Wonder Risk Diagnostics</span>
            </div>
          }
          headerAction={
            oneHit?.hasSingleTradeDominance ? (
              <Badge variant="ignore">DOMINANCE PENALTY</Badge>
            ) : (
              <Badge variant="track">ORGANIC DISTRIBUTION</Badge>
            )
          }
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Single-Trade Profit Ratio:</span>
              <span className="font-mono font-semibold text-slate-200">
                {oneHit?.singleTradeProfitRatio
                  ? `${(oneHit.singleTradeProfitRatio * 100).toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Largest Single Win:</span>
              <span className="font-mono font-semibold text-emerald-400">
                ${oneHit?.largestWinUsd ? oneHit.largestWinUsd.toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Total 30D Profit:</span>
              <span className="font-mono font-semibold text-slate-200">
                ${oneHit?.totalProfitUsd ? oneHit.totalProfitUsd.toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Applied Penalty Deduction:</span>
              <span className={`font-mono font-semibold ${oneHit?.appliedPenaltyDeduction ? 'text-rose-400' : 'text-slate-500'}`}>
                {oneHit?.appliedPenaltyDeduction ? `-${oneHit.appliedPenaltyDeduction.toFixed(1)} pts` : '0.0 pts'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 text-slate-400">
              <span>Dormant After Major Win:</span>
              <span className="font-mono font-medium text-slate-200">
                {oneHit?.isDormantAfterWin ? 'Yes (Activity dropped)' : 'No (Continuous trader)'}
              </span>
            </div>
          </div>
        </Card>

        {/* Panel 3: Copyability & Slippage Dynamics */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Realistic Execution & Liquidity Depth</span>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Median Liquidity Depth:</span>
              <span className="font-mono font-semibold text-slate-200">
                ${copyFactors?.medianLiquidityDepthUsd ? Math.round(copyFactors.medianLiquidityDepthUsd).toLocaleString() : '0'} USD
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Average Historical Spread:</span>
              <span className="font-mono font-semibold text-slate-200">
                {copyFactors?.averageHistoricalSpread ? (copyFactors.averageHistoricalSpread * 100).toFixed(2) + '¢' : '0.0¢'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Unfollowable Price Entries:</span>
              <span className="font-mono font-semibold text-slate-200">
                {copyFactors?.unfollowablePriceFraction ? (copyFactors.unfollowablePriceFraction * 100).toFixed(1) + '%' : '0.0%'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Adverse Post-Entry Drift:</span>
              <span className="font-mono font-semibold text-slate-200">
                {copyFactors?.adverseDriftFraction ? (copyFactors.adverseDriftFraction * 100).toFixed(1) + '%' : '0.0%'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 text-slate-400">
              <span>Entry Timing Score:</span>
              <span className="font-mono font-semibold text-indigo-300">
                {copyFactors?.entryTimingAverageScore ? copyFactors.entryTimingAverageScore.toFixed(1) : '80.0'} / 100
              </span>
            </div>
          </div>
        </Card>

        {/* Panel 4: Trading Habits & Consistency */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Trading Habits & Frequency</span>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Average Trade Size:</span>
              <span className="font-mono font-semibold text-slate-200">
                ${wallet.averageTradeSize ? wallet.averageTradeSize.toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Active Trading Days:</span>
              <span className="font-mono font-semibold text-slate-200">
                {ev?.frequencyMetrics?.activeTradingDaysCount ?? 0} of 30 days
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Average Trades per Day:</span>
              <span className="font-mono font-semibold text-slate-200">
                {ev?.frequencyMetrics?.averageTradesPerDay?.toFixed(1) ?? '0.0'} trades/day
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-400">Burst Trading Pattern:</span>
              <span className="font-mono font-semibold text-slate-200">
                {ev?.frequencyMetrics?.isBurstTrader ? 'Yes (Rapid clusters)' : 'No (Steady pacing)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 text-slate-400">
              <span>Consistency Score:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {wallet.consistencyScore ? wallet.consistencyScore.toFixed(1) : '0.0'} / 100
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Observed Trade History Table */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Observed On-Chain Trades ({trades.length})</span>
            </div>
            <Badge variant="neutral">Read-Only Observation</Badge>
          </div>
        }
      >
        {trades.length === 0 ? (
          <EmptyState
            title="No Trade History Recorded"
            description="No recent observed trades have been ingested for this wallet."
            command="npm run monitor:trades"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-3 font-medium">Timestamp</th>
                  <th className="pb-3 font-medium">Market Question</th>
                  <th className="pb-3 font-medium">Side / Outcome</th>
                  <th className="pb-3 font-medium text-right">Entry Price</th>
                  <th className="pb-3 font-medium text-right">Size (USD)</th>
                  <th className="pb-3 font-medium text-right">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30">
                    <td className="py-3 text-slate-400">
                      {new Date(t.sourceTimestamp).toLocaleString()}
                    </td>
                    <td className="py-3 font-sans font-medium text-slate-200 max-w-md truncate">
                      {t.marketQuestion}
                    </td>
                    <td className="py-3">
                      <span className={`font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.side}
                      </span>{' '}
                      <span className="text-slate-400">({t.outcome})</span>
                    </td>
                    <td className="py-3 text-right text-slate-200">
                      ${t.walletEntryPrice.toFixed(3)}
                    </td>
                    <td className="py-3 text-right text-slate-200">
                      ${t.size.toFixed(2)}
                    </td>
                    <td className="py-3 text-right text-slate-500 font-mono text-[11px]">
                      {t.sourceTxHash ? `${t.sourceTxHash.slice(0, 10)}...` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
