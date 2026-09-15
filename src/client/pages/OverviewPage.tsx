import React from 'react';
import { Link } from 'wouter';
import {
  DollarSign,
  Percent,
  Wallet,
  Radio,
  Sliders,
  Database,
  ArrowUpRight,
  TrendingUp,
  Layers,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Users,
  Activity,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Metric } from '../components/ui/Metric';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { EngineLifecycleControl } from '../components/ui/EngineLifecycleControl';
import { PnLChart } from '../components/visuals/PnLChart';
import { BenchmarkChart } from '../components/visuals/BenchmarkChart';
import {
  useSystemStatus,
  usePerformance,
  useIngestionStatus,
  useLatestSignal,
} from '../hooks/useDashboardData';

export const OverviewPage: React.FC = () => {
  const { data: status, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useSystemStatus();
  const { data: perf, isLoading: perfLoading, error: perfError, refetch: refetchPerf } = usePerformance();
  const { data: ingestion } = useIngestionStatus();
  const { data: signalData } = useLatestSignal();

  if (statusLoading && perfLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-[#07111E] rounded w-64 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <LoadingState rows={1} />
          <LoadingState rows={1} />
          <LoadingState rows={1} />
          <LoadingState rows={1} />
        </div>
        <LoadingState rows={3} />
      </div>
    );
  }

  if (statusError || perfError) {
    const errMessage = (statusError || perfError)?.message || 'Failed to fetch operational state';
    return (
      <ErrorState
        title="Command Center Telemetry Offline"
        message={errMessage}
        onRetry={() => {
          refetchStatus();
          refetchPerf();
        }}
      />
    );
  }

  const metrics = perf?.metrics;
  const totalPnl = metrics?.totalPnl ?? status?.totalPaperPnl ?? 0;
  const realizedPnl = metrics?.realizedPnl ?? status?.realizedPnl ?? 0;
  const unrealizedPnl = metrics?.unrealizedPnl ?? status?.unrealizedPnl ?? 0;
  const winRate = metrics?.winRate;
  const winRateStatus = metrics?.winRateStatus || (winRate === null ? 'INSUFFICIENT DATA' : 'AVAILABLE');

  const openPositions = metrics?.openPaperTrades ?? status?.openPaperTradesCount ?? 0;
  const closedPositions = metrics?.closedPaperTrades ?? status?.closedPaperTradesCount ?? 0;
  const trackedWallets = status?.trackedWalletsCount ?? 0;

  const latestSignal = signalData?.signal || status?.latestSignal;
  const latestDecision = status?.latestDecision;
  const cohorts = perf?.benchmarkCohorts;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#00A896]/15">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Research Command Center</span>
            <Badge variant="primrose">SIMULATION</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-body">
            Autonomous Polymarket copy-trading research, multi-factor scoring, and simulated paper portfolio.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Data Freshness:</span>
          <span className="text-[#F0F3BD] font-semibold">
            {ingestion?.dataFreshness?.freshnessLabel || 'LIVE (FRESH)'}
          </span>
        </div>
      </div>

      {/* Autonomous Engine Operational State */}
      <EngineLifecycleControl />

      {/* 4 Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Metric
          title="Total Paper PnL"
          value={totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`}
          trend={totalPnl >= 0 ? 'positive' : 'negative'}
          subtext={`Realized: $${realizedPnl.toFixed(2)} | Unrealized: $${unrealizedPnl.toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
          badge={<Badge variant="paper">SIMULATED</Badge>}
        />

        <Metric
          title="Simulated Win Rate"
          value={winRate !== null && winRate !== undefined ? `${(winRate * 100).toFixed(1)}%` : 'INSUFFICIENT DATA'}
          trend={winRate !== null && winRate >= 0.5 ? 'positive' : 'neutral'}
          subtext={winRateStatus === 'INSUFFICIENT DATA' ? 'Requires resolved positions' : `${closedPositions} closed trades`}
          icon={<Percent className="w-5 h-5" />}
        />

        <Metric
          title="Simulated Positions"
          value={openPositions}
          trend={openPositions > 0 ? 'positive' : 'neutral'}
          subtext={`${closedPositions} resolved / closed positions`}
          icon={<FileCheck2 className="w-5 h-5" />}
          badge={
            <Badge variant="turquoise" className="font-mono text-[10px]">
              $5-$20 SIZE
            </Badge>
          }
        />

        <Metric
          title="Tracked Wallets"
          value={trackedWallets}
          trend="positive"
          subtext="Scanned from top 500 leaderboard"
          icon={<Users className="w-5 h-5" />}
          badge={<Badge variant="track">ACTIVE</Badge>}
        />
      </div>

      {/* PnL Curve & 4-Cohort Benchmark Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PnLChart
          totalPnl={totalPnl}
          realizedPnl={realizedPnl}
          unrealizedPnl={unrealizedPnl}
        />

        <BenchmarkChart cohorts={cohorts} />
      </div>

      {/* Recent Signals & Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Latest Trade Signal */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#02C39A]" />
              <span>Latest Trade Signal</span>
            </div>
          }
          headerAction={
            <Link href="/operations/signals">
              <Button variant="ghost" size="sm" className="text-xs text-[#02C39A]">
                View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          }
        >
          {latestSignal ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-mono text-[#F0F3BD]">
                    {latestSignal.walletAddress.slice(0, 8)}...{latestSignal.walletAddress.slice(-6)}
                  </div>
                  <div className="font-medium text-sm text-white mt-1 line-clamp-2">
                    {latestSignal.marketQuestion || 'Polymarket Event Setup'}
                  </div>
                </div>
                <Badge variant={latestSignal.outcome === 'YES' ? 'turquoise' : 'neutral'} className="font-mono text-xs">
                  {latestSignal.outcome} @ ${(latestSignal.walletEntryPrice || 0.5).toFixed(2)}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#00A896]/12 text-xs font-mono">
                <div>
                  <div className="text-[10px] text-slate-400">DETECTED</div>
                  <div className="text-slate-200">${(latestSignal.detectedPrice || 0.5).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">SPREAD</div>
                  <div className="text-slate-200">{(latestSignal.spread || 0.01).toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">TIME</div>
                  <div className="text-slate-400">
                    {new Date(latestSignal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Signals Observed Yet"
              description="The observation daemon is continuously monitoring tracked wallets for live fills."
            />
          )}
        </Card>

        {/* Latest Decision Verdict */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#02C39A]" />
              <span>Latest Decision Verdict</span>
            </div>
          }
          headerAction={
            <Link href="/operations/decision-journal">
              <Button variant="ghost" size="sm" className="text-xs text-[#02C39A]">
                Journal <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          }
        >
          {latestDecision ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant={
                    latestDecision.decision === 'paper_copy'
                      ? 'track'
                      : latestDecision.decision === 'watchlist'
                      ? 'watch'
                      : 'ignore'
                  }
                  className="uppercase font-mono text-xs font-bold px-3 py-1"
                >
                  {latestDecision.decision.replace('_', ' ')}
                </Badge>

                <div className="font-mono text-xs text-slate-400">
                  Score: <span className="text-[#F0F3BD] font-bold">{(latestDecision.copyScore || 0).toFixed(1)}/100</span>
                </div>
              </div>

              <div className="text-xs text-slate-300 bg-[#07111E] p-3 rounded-lg border border-[#00A896]/15">
                <div className="text-[10px] font-mono text-[#02C39A] uppercase font-semibold mb-1">
                  PRIMARY RATIONALE:
                </div>
                <p className="line-clamp-2">
                  {latestDecision.reasons?.[0] || latestDecision.decisionReason || 'Meets deterministic multi-factor filter criteria.'}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                <span>RuleSet: {latestDecision.ruleVersion || 'v1.0.0'}</span>
                <span>
                  Position Size: {latestDecision.decision === 'paper_copy' ? `$${(latestDecision.simulatedPositionSize || 10).toFixed(2)}` : '$0.00'}
                </span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No Decisions Recorded Yet"
              description="Trade signals evaluated by the active scoring engine will appear here with complete reasoning."
            />
          )}
        </Card>
      </div>

      {/* Ingestion Health Notice */}
      {ingestion?.providerHealth?.lastError && (
        <Card subtle className="border-amber-500/30 bg-amber-950/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs text-slate-300">
              <span className="font-semibold text-amber-300">Ingestion Notice:</span>{' '}
              {ingestion.providerHealth.lastError} (Zero live data fabrication invariant is enforced).
            </div>
          </div>
        </Card>
      )}

      {/* Fast Jumps Workstation Navigation */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
          Fast Jumps • Workstation Modules
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/research/wallets">
            <div className="glass-card p-3 rounded-xl cursor-pointer group">
              <div className="flex items-center justify-between text-[#02C39A] mb-1">
                <Users className="w-4 h-4" />
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xs font-semibold text-white">Wallet Rankings</div>
              <div className="text-[10px] text-slate-400">Quality & One-Hit filter</div>
            </div>
          </Link>

          <Link href="/operations/signals">
            <div className="glass-card p-3 rounded-xl cursor-pointer group">
              <div className="flex items-center justify-between text-[#02C39A] mb-1">
                <Radio className="w-4 h-4" />
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xs font-semibold text-white">Live Signals</div>
              <div className="text-[10px] text-slate-400">Real-time observed fills</div>
            </div>
          </Link>

          <Link href="/operations/paper-trades">
            <div className="glass-card p-3 rounded-xl cursor-pointer group">
              <div className="flex items-center justify-between text-[#02C39A] mb-1">
                <FileCheck2 className="w-4 h-4" />
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xs font-semibold text-white">Paper Trades</div>
              <div className="text-[10px] text-slate-400">$5-$20 simulated positions</div>
            </div>
          </Link>

          <Link href="/system/rules">
            <div className="glass-card p-3 rounded-xl cursor-pointer group">
              <div className="flex items-center justify-between text-[#02C39A] mb-1">
                <Sliders className="w-4 h-4" />
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-xs font-semibold text-white">Rule Learning</div>
              <div className="text-[10px] text-slate-400">Walk-forward adaptations</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
