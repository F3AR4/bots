import React, { useState, useMemo } from 'react';
import {
  Radio,
  Search,
  Filter,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Link } from 'wouter';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { useSignals } from '../hooks/useOperationsData';
import { LiveSignalView } from '../api/types';

export const LiveSignalsPage: React.FC = () => {
  const { data, isLoading, error, refetch } = useSignals(100);
  const [selectedSignal, setSelectedSignal] = useState<LiveSignalView | null>(null);

  // Filters
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | 'paper_copy' | 'watchlist' | 'skip'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [provenanceFilter, setProvenanceFilter] = useState<'ALL' | 'LIVE' | 'DEMO'>('ALL');

  const signals = data?.signals || [];

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    signals.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set).sort();
  }, [signals]);

  // Filter signals
  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (decisionFilter !== 'ALL' && s.decision !== decisionFilter) return false;
      if (categoryFilter !== 'ALL' && s.category !== categoryFilter) return false;

      const isDemo =
        s.provenance?.historicalWalletEvidence?.includes('demo') ||
        s.provenance?.currentMarketEvidence?.includes('fixture') ||
        s.provenance?.currentWalletTrade?.includes('demo');
      if (provenanceFilter === 'LIVE' && isDemo) return false;
      if (provenanceFilter === 'DEMO' && !isDemo) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesWallet = s.walletAddress.toLowerCase().includes(q);
        const matchesMarket = s.marketQuestion.toLowerCase().includes(q);
        const matchesCategory = s.category.toLowerCase().includes(q);
        if (!matchesWallet && !matchesMarket && !matchesCategory) return false;
      }

      return true;
    });
  }, [signals, decisionFilter, categoryFilter, searchQuery, provenanceFilter]);

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
        title="Live Signals Feed Offline"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'paper_copy':
        return <Badge variant="track">PAPER COPY</Badge>;
      case 'watchlist':
        return <Badge variant="watch">WATCHLIST</Badge>;
      case 'skip':
      default:
        return <Badge variant="ignore">SKIP</Badge>;
    }
  };

  const isSignalDemo = (s: LiveSignalView) => {
    return (
      s.provenance?.historicalWalletEvidence?.includes('demo') ||
      s.provenance?.currentMarketEvidence?.includes('fixture') ||
      s.provenance?.currentWalletTrade?.includes('demo')
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-blue-500/15">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-blue-400" />
            <span>Live Detection & Signal Engine</span>
            <Badge variant="blue">PAPER OBSERVATION</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time stream of detected wallet trades evaluated against multi-factor copyability rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800/40">
            {filteredSignals.length} of {signals.length} Signals
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Decision Filter */}
            <div className="flex items-center gap-1 bg-[#060a14] p-1 rounded-lg border border-blue-500/20 text-xs">
              <span className="text-slate-400 font-mono px-1.5 text-[11px]">Verdict:</span>
              {(['ALL', 'paper_copy', 'watchlist', 'skip'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDecisionFilter(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    decisionFilter === d
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-blue-950/40'
                  }`}
                >
                  {d === 'ALL' ? 'All' : d === 'paper_copy' ? 'Copy' : d === 'watchlist' ? 'Watch' : 'Skip'}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#060a14] border border-blue-500/20 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-400 font-medium"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {/* Provenance Filter */}
            <select
              value={provenanceFilter}
              onChange={(e) => setProvenanceFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-[#060a14] border border-blue-500/20 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-400 font-mono"
            >
              <option value="ALL">All Provenance</option>
              <option value="LIVE">Live Feeds Only</option>
              <option value="DEMO">Demo / Fixture Only</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search wallet, market..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#060a14] border border-blue-500/20 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </Card>

      {/* Signals Content */}
      {filteredSignals.length === 0 ? (
        <EmptyState
          title="No Matching Signals"
          description="No live signals match the selected filters. The background monitor continues observing tracked wallets."
        />
      ) : (
        <>
          {/* Mobile Card Feed (block on <lg screens) */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {filteredSignals.map((signal) => {
              const priceDiff = (signal.currentPrice || 0) - (signal.walletEntryPrice || 0);

              return (
                <div
                  key={signal.id}
                  onClick={() => setSelectedSignal(signal)}
                  className="p-4 rounded-xl bg-[#090e1a] border border-blue-500/15 space-y-3 cursor-pointer hover:border-blue-500/35 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-blue-400 font-medium">
                      {signal.walletAddress.slice(0, 8)}...{signal.walletAddress.slice(-6)}
                    </span>
                    {getDecisionBadge(signal.decision)}
                  </div>

                  <div className="text-sm font-semibold text-white line-clamp-2">
                    {signal.marketQuestion}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-500/10 text-xs font-mono">
                    <div>
                      <div className="text-[10px] text-slate-400">OUTCOME</div>
                      <div className="text-blue-300 font-bold">{signal.outcome}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">ENTRY / CURR</div>
                      <div className="text-white">
                        ${(signal.walletEntryPrice || 0.5).toFixed(2)} / ${(signal.currentPrice || 0.5).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">SCORE</div>
                      <div className="text-sky-300 font-bold">{signal.totalScore.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (hidden on mobile, block on lg+) */}
          <div className="hidden lg:block">
            <Card noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-blue-500/15 bg-[#060a14] font-mono text-[11px] text-slate-400">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Wallet</th>
                      <th className="py-3 px-4">Market & Outcome</th>
                      <th className="py-3 px-4 text-right">Entry / Current</th>
                      <th className="py-3 px-4 text-right">Spread / Depth</th>
                      <th className="py-3 px-4 text-center">Score</th>
                      <th className="py-3 px-4 text-center">Decision</th>
                      <th className="py-3 px-4 text-center">Provenance</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/10">
                    {filteredSignals.map((signal) => {
                      const isDemo = isSignalDemo(signal);
                      const priceDiff = (signal.currentPrice || 0) - (signal.walletEntryPrice || 0);

                      return (
                        <tr
                          key={signal.id}
                          onClick={() => setSelectedSignal(signal)}
                          className="hover:bg-blue-950/20 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                            {formatTime(signal.timestamp)}
                          </td>
                          <td className="py-3 px-4 font-mono text-blue-300">
                            <span className="group-hover:text-blue-200">
                              {signal.walletAddress.slice(0, 6)}...{signal.walletAddress.slice(-4)}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate">
                            <div className="font-medium text-white truncate">{signal.marketQuestion}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <span className="font-semibold text-blue-400">{signal.outcome}</span>
                              <span>•</span>
                              <span>{signal.category}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                            <div className="text-white">${(signal.walletEntryPrice || 0.5).toFixed(2)}</div>
                            <div className={`text-[10px] ${priceDiff >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
                              ${(signal.currentPrice || 0.5).toFixed(2)} ({priceDiff >= 0 ? `+${priceDiff.toFixed(2)}` : priceDiff.toFixed(2)})
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                            <div className="text-slate-300">{(signal.spread || 0.01).toFixed(3)}</div>
                            <div className="text-[10px] text-slate-400">${(signal.liquidity || 500).toLocaleString()}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-sky-300">
                            {signal.totalScore.toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {getDecisionBadge(signal.decision)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <Badge variant={isDemo ? 'demo' : 'live'} className="text-[10px] font-mono">
                              {isDemo ? 'DEMO' : 'LIVE'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button className="p-1 rounded text-slate-400 group-hover:text-blue-300 transition-colors">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Signal Inspection Modal */}
      {selectedSignal && (
        <Modal
          isOpen={!!selectedSignal}
          onClose={() => setSelectedSignal(null)}
          title="Signal Audit & Scoring Breakdown"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-blue-500/15">
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase">DECISION VERDICT</div>
                <div className="mt-1">{getDecisionBadge(selectedSignal.decision)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-400 uppercase">COMPOSITE SCORE</div>
                <div className="text-xl font-mono font-bold text-sky-300">
                  {selectedSignal.totalScore.toFixed(1)} / 100
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-white">Market Title</div>
              <div className="p-2.5 rounded-lg bg-[#060a14] border border-blue-500/20 text-slate-200">
                {selectedSignal.marketQuestion}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-2.5 rounded-lg bg-[#060a14] border border-blue-500/15">
                <div className="text-[10px] text-slate-400">WALLET ADDRESS</div>
                <div className="text-blue-300 font-semibold truncate mt-0.5">
                  {selectedSignal.walletAddress}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#060a14] border border-blue-500/15">
                <div className="text-[10px] text-slate-400">CATEGORY</div>
                <div className="text-slate-200 font-semibold mt-0.5">{selectedSignal.category}</div>
              </div>
            </div>

            {/* Sub-Score Breakdown */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white">Multi-Factor Score Weights</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono">
                {Object.entries(selectedSignal.subScores || {}).map(([k, v]) => (
                  <div key={k} className="p-2 rounded bg-[#060a14] border border-blue-500/10">
                    <div className="text-[10px] text-slate-400 uppercase truncate">{k}</div>
                    <div className="text-sm font-bold text-white">
                      {typeof v === 'number' ? v.toFixed(1) : String(v)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reasons & Risks */}
            {selectedSignal.reasons && selectedSignal.reasons.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-white">Contributing Positive Factors</div>
                <ul className="space-y-1">
                  {selectedSignal.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Link href={`/research/wallet/${selectedSignal.walletAddress}`}>
                <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5">
                  <span>View Wallet Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
