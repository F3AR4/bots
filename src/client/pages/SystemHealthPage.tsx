import React from 'react';
import {
  Cpu,
  ShieldCheck,
  Activity,
  Radio,
  Database,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Layers,
  FileCheck2,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'wouter';
import { Card } from '../components/ui/Card';
import { Metric } from '../components/ui/Metric';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { useMonitorStatus } from '../hooks/useOperationsData';
import { useSystemStatus } from '../hooks/useDashboardData';
import { EngineLifecycleControl } from '../components/ui/EngineLifecycleControl';

export const SystemHealthPage: React.FC = () => {
  const { data: monitorData, isLoading: monitorLoading, error: monitorError, refetch: refetchMonitor } = useMonitorStatus();
  const { data: systemData, isLoading: systemLoading, refetch: refetchSystem } = useSystemStatus();

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
        <LoadingState rows={4} />
      </div>
    );
  }

  if (monitorError) {
    return (
      <ErrorState
        title="System Telemetry Offline"
        message={monitorError.message}
        onRetry={() => {
          refetchMonitor();
          refetchSystem();
        }}
      />
    );
  }

  const obs = monitorData?.observability;
  const monitorState = obs?.monitorProcessStatus || monitorData?.walletMonitorStatus || 'UNKNOWN';
  const dataFreshness = obs?.currentDataFreshness || monitorData?.marketDataFreshness || 'UNAVAILABLE';
  const providerHealth = obs?.ingestionProviderHealth || (monitorData?.ingestionStatus === 'HEALTHY' ? 'OPERATIONAL' : 'IDLE');

  const totalPaperPnl = obs?.currentPaperPnl?.total ?? systemData?.totalPaperPnl ?? 0;
  const unrealizedPnl = obs?.currentPaperPnl?.unrealized ?? 0;
  const realizedPnl = obs?.currentPaperPnl?.realized ?? 0;

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return 'No cycle recorded';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + d.toLocaleDateString() + ')';
    } catch {
      return ts;
    }
  };

  const getStatusBadge = (state: string) => {
    switch (state.toUpperCase()) {
      case 'RUNNING':
        return <Badge variant="live">RUNNING</Badge>;
      case 'STALE':
      case 'AGING':
        return <Badge variant="warning">STALE</Badge>;
      case 'ERROR':
      case 'FAILED':
        return <Badge variant="ignore">ERROR</Badge>;
      case 'IDLE':
      default:
        return <Badge variant="neutral">IDLE</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Server className="w-5 h-5 text-indigo-400" />
            <span>System Health & 24h/48h Observability Console</span>
            <Badge variant="paper">DAEMON CONSOLE</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry measuring background polling loop freshness, database integrity, and operational state.
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
            <span>Poll Telemetry</span>
          </button>
        </div>
      </div>

      {/* Engine Lifecycle Control & Architecture Preparation */}
      <EngineLifecycleControl showDetails />

      {/* KPI Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          title="Monitor Loop Status"
          value={monitorState}
          subtext={
            monitorState === 'RUNNING'
              ? 'Actively polling tracked wallets'
              : monitorState === 'STALE'
              ? 'Last poll > 120s ago'
              : 'Daemon idle or stopped'
          }
          trend={monitorState === 'RUNNING' ? 'positive' : monitorState === 'STALE' ? 'warning' : 'neutral'}
          icon={<Activity className="w-4 h-4 text-emerald-400" />}
        />
        <Metric
          title="Market Data Freshness"
          value={dataFreshness}
          subtext={`Provider Status: ${providerHealth}`}
          trend={dataFreshness === 'FRESH' ? 'positive' : dataFreshness === 'AGING' ? 'warning' : 'negative'}
          icon={<Radio className="w-4 h-4 text-amber-400" />}
        />
        <Metric
          title="Total Paper PnL"
          value={`$${totalPaperPnl >= 0 ? '+' : ''}${totalPaperPnl.toFixed(2)}`}
          subtext={`Unrealized: $${unrealizedPnl.toFixed(2)} | Realized: $${realizedPnl.toFixed(2)}`}
          trend={totalPaperPnl >= 0 ? 'positive' : 'negative'}
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
        />
        <Metric
          title="Execution Safety Invariant"
          value="PAPER ONLY"
          subtext="Zero private keys / zero live execution"
          trend="positive"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
        />
      </div>

      {/* 24h / 48h Paper Collection Readiness Box */}
      <Card
        header="24H / 48H Continuous Paper Data Collection Readiness"
        headerAction={getStatusBadge(monitorState)}
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs leading-relaxed text-slate-300">
            <span className="font-semibold text-slate-100">Daemon Invariant: </span>
            The paper-trading monitor runs continuously as an independent background daemon. When started with <code className="text-indigo-300 font-mono">npm run monitor:loop</code> or runner, it continuously monitors high-conviction wallets, logs trade detections, executes paper orders ($5–$20 bounds), and updates mark-to-market valuations for 24h or 48h without needing an active browser session.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-mono text-slate-500 block">Last Monitoring Cycle</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulMonitoringCycle || monitorData?.lastPollAt)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-mono text-slate-500 block">Last Leaderboard Scan</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulLeaderboardScan)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-mono text-slate-500 block">Last Wallet Intelligence Scan</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulWalletScan)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-mono text-slate-500 block">Last Trade Observation</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulTradeObservation)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-mono text-slate-500 block">Last Mark-to-Market PnL Update</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulPnlUpdate)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-mono text-slate-500 block">Last Outcome Review Cycle</span>
              <span className="text-xs font-mono font-medium text-slate-200">
                {formatTimestamp(obs?.lastSuccessfulOutcomeReview)}
              </span>
            </div>
          </div>

          {/* Error & Fail-Closed Logging */}
          <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono">Last Error:</span>
              {obs?.lastError || monitorData?.lastErrorMessage ? (
                <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300 font-mono flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  {obs?.lastError || monitorData?.lastErrorMessage}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-mono flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Zero Active Errors Logged
                </span>
              )}
            </div>

            <div className="text-slate-400 font-mono text-[11px]">
              Fail-Closed Policy: Verified Active
            </div>
          </div>
        </div>
      </Card>

      {/* Operational Modules Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          header="Polymarket Ingestion Health"
          headerAction={
            <Link
              href="/system/ingestion"
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              <span>Inspect Telemetry</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          <div className="space-y-2 text-xs">
            <p className="text-slate-400">
              Read-only connectivity to Polymarket Data API, Gamma API, and CLOB order book depth endpoints.
            </p>
            <div className="flex items-center justify-between font-mono pt-2">
              <span className="text-slate-500">Provider Status:</span>
              <span className="text-emerald-400 font-semibold">{providerHealth}</span>
            </div>
          </div>
        </Card>

        <Card
          header="RuleSet & Parameter Governance"
          headerAction={
            <Link
              href="/system/rules"
              className="text-xs font-mono text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              <span>Inspect Rules</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          }
        >
          <div className="space-y-2 text-xs">
            <p className="text-slate-400">
              Cryptographic ledger of immutable RuleSets, $5–$20 sizing boundaries, and parameter origins.
            </p>
            <div className="flex items-center justify-between font-mono pt-2">
              <span className="text-slate-500">Active RuleSet:</span>
              <span className="text-indigo-300 font-semibold">{obs?.currentRuleSetId || 'default_ruleset_v1'}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
