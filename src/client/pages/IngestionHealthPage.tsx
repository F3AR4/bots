import React from 'react';
import {
  Database,
  Radio,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Server,
  Layers,
  ArrowUpRight,
  Activity,
  FileCode,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Metric } from '../components/ui/Metric';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { useIngestionStatus } from '../hooks/useDashboardData';

export const IngestionHealthPage: React.FC = () => {
  const { data: ingestion, isLoading, error, refetch } = useIngestionStatus();

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
        title="Ingestion Telemetry Offline"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  const freshness = ingestion?.dataFreshness;
  const provider = ingestion?.providerHealth;
  const coverage = ingestion?.databaseCoverage;
  const operations = ingestion?.recentOperations || [];
  const latestSnapshot = ingestion?.latestMarketSnapshot;
  const latestScan = ingestion?.latestLeaderboardScan;

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return 'No sync recorded';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + d.toLocaleDateString() + ')';
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-indigo-400" />
            <span>Polymarket Ingestion Health & Provider Telemetry</span>
            <Badge variant="paper">READ-ONLY INGESTION</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Upstream API connectivity status, market snapshot depth, and rate-limit resilience monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/70 bg-slate-800/80 hover:bg-slate-750 text-slate-300 text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Poll Ingestion</span>
          </button>
        </div>
      </div>

      {/* Safety & Credential Boundary Banner */}
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-emerald-300 block">
              Read-Only Telemetry Boundary
            </span>
            <span className="text-slate-300">
              Zero API secrets, authentication tokens, or private keys are exposed or handled by the client surface.
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-slate-900 text-emerald-300 border border-slate-700 font-mono text-xs font-semibold self-start sm:self-auto">
          NETWORK: READ-ONLY
        </span>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          title="Data Mode"
          value={ingestion?.dataMode || 'NO DATA'}
          subtext={freshness?.freshnessLabel || 'Checking freshness'}
          trend={ingestion?.dataMode === 'LIVE READ-ONLY DATA' ? 'positive' : 'warning'}
          icon={<Radio className="w-4 h-4 text-emerald-400" />}
        />
        <Metric
          title="Provider Health"
          value={provider?.status || 'IDLE'}
          subtext={`Service: ${provider?.lastVerifiedService || 'polymarket'}`}
          trend={provider?.status === 'OPERATIONAL' ? 'positive' : provider?.status === 'DEGRADED' ? 'warning' : 'neutral'}
          icon={<Server className="w-4 h-4 text-indigo-400" />}
        />
        <Metric
          title="Wallets Discovered"
          value={coverage?.walletsDiscovered ?? 0}
          subtext="Indexed in SQLite database"
          trend="neutral"
          icon={<Database className="w-4 h-4 text-blue-400" />}
        />
        <Metric
          title="Observed Trades"
          value={coverage?.observedTradesCount ?? 0}
          subtext="Historical & live detected events"
          trend="neutral"
          icon={<Layers className="w-4 h-4 text-purple-400" />}
        />
      </div>

      {/* Upstream Providers Breakdown */}
      <Card header="Upstream Data Services & API Endpoints">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Provider 1: Polymarket Data API */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-200">1. Data API</span>
              <Badge variant={provider?.status === 'OPERATIONAL' ? 'track' : 'warning'}>
                {provider?.status || 'OPERATIONAL'}
              </Badge>
            </div>
            <div className="space-y-1 text-xs font-mono text-slate-400">
              <div className="text-[11px] text-slate-500">Source: data-api.polymarket.com</div>
              <div>Scope: Leaderboard & Activity</div>
              <div>Capabilities: Public Read-Only</div>
            </div>
          </div>

          {/* Provider 2: Gamma API */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-200">2. Gamma API</span>
              <Badge variant="track">OPERATIONAL</Badge>
            </div>
            <div className="space-y-1 text-xs font-mono text-slate-400">
              <div className="text-[11px] text-slate-500">Source: gamma-api.polymarket.com</div>
              <div>Scope: Market Resolution & Metadata</div>
              <div>Capabilities: Public Read-Only</div>
            </div>
          </div>

          {/* Provider 3: CLOB API */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-200">3. CLOB API</span>
              <Badge variant="track">OPERATIONAL</Badge>
            </div>
            <div className="space-y-1 text-xs font-mono text-slate-400">
              <div className="text-[11px] text-slate-500">Source: clob.polymarket.com/book</div>
              <div>Scope: Order Book Spread & Depth</div>
              <div>Capabilities: Read-Only (Signing Off)</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Ingestion Operations Log */}
      <Card
        header="Recent Ingestion & Snapshot Operations"
        headerAction={
          <span className="text-[11px] font-mono text-slate-400">
            {operations.length} Recorded Runs
          </span>
        }
      >
        {operations.length === 0 ? (
          <EmptyState
            title="No Recent Ingestion Logs"
            description="Background data ingestion runs and market snapshot collections will be logged here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3">Operation ID</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Started At</th>
                  <th className="py-2.5 px-3 text-right">Duration</th>
                  <th className="py-2.5 px-3 text-right">Records</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {operations.map(op => (
                  <tr key={op.id} className="hover:bg-slate-850/50">
                    <td className="py-2.5 px-3 text-indigo-300 font-semibold">#{op.id.slice(0, 8)}</td>
                    <td className="py-2.5 px-3 text-slate-200">{op.operation}</td>
                    <td className="py-2.5 px-3 text-slate-400">{formatTimestamp(op.startedAt)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300">{op.durationMs}ms</td>
                    <td className="py-2.5 px-3 text-right text-slate-200">{op.recordsProcessed}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={op.status === 'success' || op.status === 'completed' ? 'track' : op.errorsCount > 0 ? 'warning' : 'neutral'}>
                        {op.status.toUpperCase()}
                      </Badge>
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
