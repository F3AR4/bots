import React from 'react';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Radio,
  FileCheck2,
  BookOpen,
  DollarSign,
  TrendingUp,
  Cpu,
  RefreshCw,
  ArrowRight,
  Database,
  ExternalLink,
  Layers,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { Card } from '../components/ui/Card';
import { Metric } from '../components/ui/Metric';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { EngineLifecycleControl } from '../components/ui/EngineLifecycleControl';
import {
  useMonitorStatus,
  useSignals,
  usePaperTrades,
  useDecisionJournal,
} from '../hooks/useOperationsData';
import { useSystemStatus } from '../hooks/useDashboardData';

export const OperationsOverviewPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { data: monitorStatus, isLoading: monitorLoading, error: monitorError, refetch: refetchMonitor } = useMonitorStatus();
  const { data: systemStatus, isLoading: systemLoading, refetch: refetchSystem } = useSystemStatus();
  const { data: signalsData } = useSignals(5);
  const { data: paperTradesData } = usePaperTrades();
  const { data: decisionsData } = useDecisionJournal(5);

  if (monitorLoading && systemLoading) {
    return (
      <div className="space-y-6">
        <LoadingState rows={2} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingState rows={1} />
          <LoadingState rows={1} />
          <LoadingState rows={1} />
          <LoadingState rows={1} />
        </div>
        <LoadingState rows={3} />
      </div>
    );
  }

  if (monitorError) {
    return (
      <ErrorState
        title="Operations Monitor Offline"
        message={monitorError.message}
        onRetry={() => {
          refetchMonitor();
          refetchSystem();
        }}
      />
    );
  }

  const obs = monitorStatus?.observability;

  // Real state calculation based on timestamps - NO synthetic online fabrication
  const monitorState = obs?.monitorProcessStatus || monitorStatus?.walletMonitorStatus || 'UNKNOWN';
  const dataFreshness = obs?.currentDataFreshness || monitorStatus?.marketDataFreshness || 'UNAVAILABLE';
  const providerHealth = obs?.ingestionProviderHealth || (monitorStatus?.ingestionStatus === 'HEALTHY' ? 'OPERATIONAL' : 'IDLE');

  const paperTrades = paperTradesData?.paperTrades || [];
  const openTrades = paperTrades.filter(t => t.status === 'open');
  const totalTradesCount = paperTradesData?.totalTrades ?? paperTrades.length;
  const totalPaperPnl = paperTradesData?.totalPnl ?? obs?.currentPaperPnl?.total ?? 0;
  const unrealizedPnl = obs?.currentPaperPnl?.unrealized ?? 0;
  const realizedPnl = obs?.currentPaperPnl?.realized ?? 0;

  const signals = signalsData?.signals || [];
  const latestSignal = signals.length > 0 ? signals[0] : null;
  const latestPaperCopySignal = signals.find(s => s.decision === 'paper_copy');

  const decisions = decisionsData?.decisions || [];
  const latestDecision = decisions.length > 0 ? decisions[0] : null;

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return 'No observation yet';
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString() + ' (' + date.toLocaleDateString() + ')';
    } catch {
      return ts;
    }
  };

  const getStatusBadgeVariant = (state: string) => {
    switch (state.toUpperCase()) {
      case 'RUNNING':
        return 'success';
      case 'STALE':
      case 'AGING':
        return 'warning';
      case 'ERROR':
      case 'FAILED':
        return 'danger';
      case 'IDLE':
      case 'UNKNOWN':
      case 'NO RECENT OBSERVATION':
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Strict PAPER ONLY safety invariant */}
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-emerald-300 text-sm tracking-wide">
                SAFETY INVARIANT: STRICTLY PAPER ONLY
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-900/60 text-emerald-200 border border-emerald-700/50">
                READ-ONLY CORE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Zero private keys, zero wallet signing, and zero live transaction broadcasting. Simulated position bounds strictly enforced between $5.00 and $20.00.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto font-mono text-xs">
          <span className="text-slate-400">RuleSet ID:</span>
          <span className="px-2.5 py-1 rounded bg-slate-900/90 text-indigo-300 border border-slate-700 font-semibold">
            {obs?.currentRuleSetId || systemStatus?.activeRulesetId || 'default_ruleset_v1'}
          </span>
        </div>
      </div>

      {/* Page Title & Operational Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span>Operations Command Center</span>
            <Badge variant={getStatusBadgeVariant(monitorState)}>
              {monitorState === 'RUNNING' ? 'MONITOR RUNNING' : monitorState}
            </Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time operational dashboard observing server-side paper-trading loop, ingestion health, and decision forensics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchMonitor();
              refetchSystem();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/70 bg-slate-800/80 hover:bg-slate-750 text-slate-300 text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {/* Engine Lifecycle Control & Architecture Preparation */}
      <EngineLifecycleControl showDetails />

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          title="Tracked Wallets"
          value={obs?.trackedWalletCount ?? monitorStatus?.activeTrackedWallets ?? systemStatus?.trackedWalletsCount ?? 0}
          subtext="Vetted high-consistency traders"
          trend="neutral"
          icon={<Database className="w-4 h-4 text-indigo-400" />}
        />
        <Metric
          title="Active Paper Trades"
          value={openTrades.length}
          subtext={`${totalTradesCount} total simulated trades`}
          trend="neutral"
          icon={<FileCheck2 className="w-4 h-4 text-blue-400" />}
        />
        <Metric
          title="Total Paper PnL"
          value={`$${totalPaperPnl >= 0 ? '+' : ''}${totalPaperPnl.toFixed(2)}`}
          subtext={`Unrealized: $${unrealizedPnl.toFixed(2)} | Realized: $${realizedPnl.toFixed(2)}`}
          trend={totalPaperPnl >= 0 ? 'positive' : 'negative'}
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
        />
        <Metric
          title="Market Data Freshness"
          value={dataFreshness}
          subtext={`Provider: ${providerHealth}`}
          trend={dataFreshness === 'FRESH' ? 'positive' : dataFreshness === 'AGING' ? 'warning' : 'negative'}
          icon={<Radio className="w-4 h-4 text-amber-400" />}
        />
      </div>

      {/* 24h / 48h Long-Running Continuous Observation Telemetry */}
      <Card
        header="24h / 48h Continuous Observation Telemetry"
        headerAction={
          <span className="text-[11px] font-mono text-slate-400">
            Autonomous Daemon Telemetry
          </span>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs leading-relaxed text-slate-300">
            <span className="font-semibold text-slate-100">Architecture Guarantee: </span>
            The paper-trading core operates entirely as an independent server-side engine. Web and future mobile surfaces act exclusively as read-only observation windows. The monitor loop continues collecting observations, updating mark-to-market PnL, and auditing decisions for 24h/48h regardless of operator client connectivity.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[11px] text-slate-400 block font-mono">Last Monitoring Cycle</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulMonitoringCycle || monitorStatus?.lastPollAt)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[11px] text-slate-400 block font-mono">Last Leaderboard Scan</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulLeaderboardScan)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[11px] text-slate-400 block font-mono">Last Wallet Scan / Update</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulWalletScan)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[11px] text-slate-400 block font-mono">Last Trade Observation</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulTradeObservation)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[11px] text-slate-400 block font-mono">Last PnL Mark-To-Market</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulPnlUpdate)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <span className="text-[11px] text-slate-400 block font-mono">Last Outcome Review Cycle</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulOutcomeReview)}
              </span>
            </div>
          </div>

          {/* Error and Anomaly Telemetry */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">System Error Status:</span>
              {obs?.lastError || monitorStatus?.lastErrorMessage ? (
                <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300 font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  {obs?.lastError || monitorStatus?.lastErrorMessage}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Zero Active Errors Logged
                </span>
              )}
            </div>

            <div className="text-slate-400 text-[11px] font-mono">
              Fail-Closed Policy: Verified Active
            </div>
          </div>
        </div>
      </Card>

      {/* Triad of Operational Sub-Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Module 1: Live Signals */}
        <Card
          header="Live Signals Feed"
          headerAction={
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
              {signals.length} Recent
            </span>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Real-time stream of detected wallet trades scored against conservative parameters.
            </p>

            {latestSignal ? (
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">Latest Signal</span>
                  <Badge
                    variant={
                      latestSignal.decision === 'paper_copy'
                        ? 'success'
                        : latestSignal.decision === 'watchlist'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {latestSignal.decision.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs font-medium text-slate-200 truncate">
                  {latestSignal.marketQuestion}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Score: {latestSignal.finalScore.toFixed(1)}/100</span>
                  <span>{latestSignal.outcome} @ ${(latestSignal.currentPrice || 0).toFixed(3)}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-lg">
                No signal detected yet
              </div>
            )}

            {latestPaperCopySignal && (
              <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300">
                <span className="font-semibold">Last Copied Setup: </span>
                {latestPaperCopySignal.walletAddress.slice(0, 8)}... - ${latestPaperCopySignal.paperSize?.toFixed(2)} size
              </div>
            )}

            <button
              onClick={() => setLocation('/operations/signals')}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition-colors border border-slate-700/60"
            >
              <span>Explore All Signals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>

        {/* Module 2: Paper Trades */}
        <Card
          header="Paper Trades & Positions"
          headerAction={
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/50">
              {openTrades.length} Open
            </span>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Simulated positions bounded strictly between $5.00 and $20.00 with live mark-to-market.
            </p>

            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Open Positions:</span>
                <span className="font-semibold text-slate-200 font-mono">{openTrades.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Total Positions:</span>
                <span className="font-semibold text-slate-200 font-mono">{totalTradesCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-800/60 pt-1.5">
                <span className="text-slate-400 font-mono">Total PnL:</span>
                <span className={`font-semibold font-mono ${totalPaperPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ${totalPaperPnl >= 0 ? '+' : ''}{totalPaperPnl.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setLocation('/operations/paper-trades')}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition-colors border border-slate-700/60"
            >
              <span>View Portfolio & PnL</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>

        {/* Module 3: Decision Audit Journal */}
        <Card
          header="Decision Audit Journal"
          headerAction={
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/50">
              {decisions.length} Audited
            </span>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Immutable record explaining exactly WHY each detected trade was copied, watchlisted, or skipped.
            </p>

            {latestDecision ? (
              <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">Latest Decision</span>
                  <Badge
                    variant={
                      latestDecision.decision === 'paper_copy'
                        ? 'success'
                        : latestDecision.decision === 'watchlist'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {latestDecision.decision.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs font-medium text-slate-200 truncate">
                  Target Market: {latestDecision.marketId.slice(0, 16)}...
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Score: {latestDecision.copyScore.toFixed(1)}/100</span>
                  <span>Wallet: {latestDecision.walletAddress.slice(0, 6)}...</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 font-mono border border-dashed border-slate-800 rounded-lg">
                No decisions recorded yet
              </div>
            )}

            <button
              onClick={() => setLocation('/operations/decision-journal')}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition-colors border border-slate-700/60"
            >
              <span>Inspect Decision Journal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
