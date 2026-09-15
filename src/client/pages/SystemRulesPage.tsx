import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  History,
  FileCode,
  Info,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Search,
  Filter,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Metric } from '../components/ui/Metric';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { useRuleSets } from '../hooks/useSystemData';
import { ParameterProvenance, ParameterSourceType, RuleSetItem, RuleChangeItem, RuleSetConfig } from '../api/types';

export const SystemRulesPage: React.FC = () => {
  const { data, isLoading, error, refetch } = useRuleSets();
  const [activeTab, setActiveTab] = useState<'provenance' | 'history' | 'changes'>('provenance');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
        title="RuleSet Repository Offline"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  const activeRuleSet = data?.activeRuleSet;
  const allRulesets = data?.allRulesets || [];
  const auditChanges = data?.auditChanges || [];
  const metadataMap = activeRuleSet?.parameterMetadata || {};
  const config: Partial<RuleSetConfig> = activeRuleSet?.config || {};

  // Build array of parameter provenance items
  const parameterList: ParameterProvenance[] = Object.keys(metadataMap).map(key => {
    return metadataMap[key];
  });

  // Filtered parameters
  const filteredParameters = parameterList.filter(param => {
    if (sourceFilter !== 'ALL' && param.sourceType !== sourceFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesKey = param.key.toLowerCase().includes(q);
      const matchesDesc = param.description.toLowerCase().includes(q);
      const matchesSource = param.sourceReference.toLowerCase().includes(q);
      if (!matchesKey && !matchesDesc && !matchesSource) return false;
    }
    return true;
  });

  const getSourceBadge = (sourceType: ParameterSourceType) => {
    switch (sourceType) {
      case 'PDF_EXPLICIT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-700/60">
            PDF EXPLICIT
          </span>
        );
      case 'IMPLEMENTATION_BASELINE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/50">
            BASELINE
          </span>
        );
      case 'OPERATOR_CONFIG':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/50">
            OPERATOR CONFIG
          </span>
        );
      case 'DERIVED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
            DERIVED
          </span>
        );
      case 'NOT_SPECIFIED_TBD':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
            TBD / PROVISIONAL
          </span>
        );
    }
  };

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <span>RuleSet Governance & Provenance Ledger</span>
            <Badge variant="paper">IMMUTABLE CONFIG</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographic and database ledger of immutable strategy rules, sizing boundaries, and parameter origins.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Active RuleSet:</span>
          <span className="px-2.5 py-1 rounded bg-slate-900 text-indigo-300 border border-slate-700 font-semibold">
            {activeRuleSet?.id} ({activeRuleSet?.version})
          </span>
        </div>
      </div>

      {/* Critical Strategy Parameter Invariant Banner */}
      <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Strict Parameter Provenance Distinction</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          The only parameters explicitly specified in the foundational strategy PDF are the paper sizing constraints: <span className="text-emerald-300 font-mono font-bold">$5.00 minimum</span> and <span className="text-emerald-300 font-mono font-bold">$20.00 maximum</span> position sizes. All scoring weights, cutoffs, and thresholds are classified as <span className="text-blue-300 font-mono">IMPLEMENTATION_BASELINE</span> or <span className="text-purple-300 font-mono">OPERATOR_CONFIG</span> and are never presented as source-dictated dogma.
        </p>
      </div>

      {/* Active RuleSet Summary KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          title="Active RuleSet Version"
          value={activeRuleSet?.version || 'v1.0.0'}
          subtext={`ID: ${activeRuleSet?.id}`}
          trend="positive"
          icon={<FileCode className="w-4 h-4 text-indigo-400" />}
        />
        <Metric
          title="Min Position Bound"
          value={`$${config.simulatedBetMin?.toFixed(2) || '5.00'}`}
          subtext="Source: PDF_EXPLICIT"
          trend="positive"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
        />
        <Metric
          title="Max Position Bound"
          value={`$${config.simulatedBetMax?.toFixed(2) || '20.00'}`}
          subtext="Source: PDF_EXPLICIT"
          trend="positive"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
        />
        <Metric
          title="Audited Rule Versions"
          value={allRulesets.length}
          subtext={`${auditChanges.length} historical change records`}
          trend="neutral"
          icon={<History className="w-4 h-4 text-blue-400" />}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto py-1">
        <button
          onClick={() => setActiveTab('provenance')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
            activeTab === 'provenance'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Parameter Provenance Ledger ({parameterList.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Immutable Historical RuleSets ({allRulesets.length})
        </button>
        <button
          onClick={() => setActiveTab('changes')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
            activeTab === 'changes'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          RuleChange Audit Trail ({auditChanges.length})
        </button>
      </div>

      {/* Tab 1: Parameter Provenance Ledger */}
      {activeTab === 'provenance' && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">Filter Source:</span>
                <select
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="ALL">All Provenance Types</option>
                  <option value="PDF_EXPLICIT">PDF_EXPLICIT Only</option>
                  <option value="IMPLEMENTATION_BASELINE">IMPLEMENTATION_BASELINE Only</option>
                  <option value="OPERATOR_CONFIG">OPERATOR_CONFIG Only</option>
                  <option value="NOT_SPECIFIED_TBD">NOT_SPECIFIED_TBD Only</option>
                </select>
              </div>

              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search parameter key, description..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </Card>

          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/60 font-mono text-[11px] text-slate-400">
                    <th className="py-3 px-4">Parameter Key</th>
                    <th className="py-3 px-4 text-right">Current Value</th>
                    <th className="py-3 px-4 text-center">Source Provenance</th>
                    <th className="py-3 px-4">Source Reference</th>
                    <th className="py-3 px-4">Description & Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredParameters.map(param => (
                    <tr key={param.key} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-300 whitespace-nowrap">
                        {param.key}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-100 font-bold whitespace-nowrap">
                        {typeof param.value === 'boolean'
                          ? param.value ? 'true' : 'false'
                          : typeof param.value === 'number'
                          ? param.value
                          : String(param.value)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {getSourceBadge(param.sourceType)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {param.sourceReference}
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs">
                        {param.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Historical RuleSets */}
      {activeTab === 'history' && (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] text-slate-400">
                  <th className="py-3 px-4">RuleSet ID</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Created Timestamp</th>
                  <th className="py-3 px-4">Effective From</th>
                  <th className="py-3 px-4">Retired Date</th>
                  <th className="py-3 px-4">Source Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {allRulesets.map(rs => (
                  <tr key={rs.id} className="hover:bg-slate-850/50">
                    <td className="py-3 px-4 text-indigo-300 font-semibold">{rs.id}</td>
                    <td className="py-3 px-4 text-slate-200">{rs.version}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={rs.status === 'active' ? 'track' : 'neutral'}>
                        {rs.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{formatTimestamp(rs.createdAt)}</td>
                    <td className="py-3 px-4 text-slate-300">{formatTimestamp(rs.effectiveAt)}</td>
                    <td className="py-3 px-4 text-slate-500">{rs.retiredAt ? formatTimestamp(rs.retiredAt) : 'Currently Active'}</td>
                    <td className="py-3 px-4 text-slate-300 font-sans text-xs">{rs.sourceReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: RuleChange Audit Trail */}
      {activeTab === 'changes' && (
        <div className="space-y-4">
          {auditChanges.length === 0 ? (
            <EmptyState
              title="No Rule Changes Recorded"
              description="Rule changes are recorded immutably when a new RuleSet version is proposed and accepted with empirical review evidence."
            />
          ) : (
            <div className="space-y-4">
              {auditChanges.map(change => (
                <Card key={change.id}>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Old: <span className="text-slate-200 font-semibold">{change.oldRuleSetId}</span></span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-slate-400">New: <span className="text-emerald-400 font-semibold">{change.newRuleSetId}</span></span>
                      </div>
                      <span className="text-slate-500 text-[11px]">{formatTimestamp(change.timestamp)}</span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="text-slate-300">
                        <span className="font-semibold text-slate-100">Reason: </span>
                        {change.reason}
                      </div>
                      <div className="text-slate-400">
                        <span className="font-semibold text-slate-300">Evidence: </span>
                        {change.evidenceSummary}
                      </div>
                      <div className="text-slate-400">
                        <span className="font-semibold text-slate-300">Expected Shift: </span>
                        {change.expectedImprovement}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
