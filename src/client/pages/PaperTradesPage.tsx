import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
  Search,
  Filter,
  ShieldCheck,
  ChevronRight,
  X,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'wouter';
import { Card } from '../components/ui/Card';
import { Metric } from '../components/ui/Metric';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { usePaperTrades } from '../hooks/useOperationsData';
import { PaperTradeItem } from '../api/types';

export const PaperTradesPage: React.FC = () => {
  const { data, isLoading, error, refetch } = usePaperTrades();
  const [selectedTrade, setSelectedTrade] = useState<PaperTradeItem | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'open' | 'closed' | 'resolved'>('ALL');
  const [pnlFilter, setPnlFilter] = useState<'ALL' | 'profit' | 'loss'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const trades = data?.paperTrades || [];

  // Filter trades
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (statusFilter !== 'ALL' && trade.status !== statusFilter) return false;

      const effectivePnl = trade.status === 'open' ? trade.unrealizedPnl : trade.realizedPnl;
      if (pnlFilter === 'profit' && effectivePnl <= 0) return false;
      if (pnlFilter === 'loss' && effectivePnl >= 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesWallet = trade.walletAddress.toLowerCase().includes(q);
        const matchesMarket = trade.marketId.toLowerCase().includes(q);
        const matchesOutcome = trade.outcome.toLowerCase().includes(q);
        const matchesId = trade.id.toLowerCase().includes(q);
        if (!matchesWallet && !matchesMarket && !matchesOutcome && !matchesId) return false;
      }

      return true;
    });
  }, [trades, statusFilter, pnlFilter, searchQuery]);

  // Aggregate stats
  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades.filter((t) => t.status === 'closed' || t.status === 'resolved');
  const unrealizedPnlTotal = openTrades.reduce((sum, t) => sum + t.unrealizedPnl, 0);
  const realizedPnlTotal = closedTrades.reduce((sum, t) => sum + t.realizedPnl, 0);
  const totalPnl = unrealizedPnlTotal + realizedPnlTotal;

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
        title="Paper Trades Portfolio Offline"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  const formatTimestamp = (ts?: string | null) => {
    if (!ts) return '--';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="blue" dot>OPEN</Badge>;
      case 'resolved':
        return <Badge variant="track">RESOLVED</Badge>;
      case 'closed':
      default:
        return <Badge variant="neutral">CLOSED</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-blue-500/15">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileCheck2 className="w-5 h-5 text-blue-400" />
            <span>Simulated Paper Portfolio</span>
            <Badge variant="blue">PAPER EXECUTION</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulated position sizing strictly bounded between $5.00 and $20.00 with hourly mark-to-market.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800/40">
            {filteredTrades.length} of {trades.length} Positions
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Metric
          title="Total Paper PnL"
          value={totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`}
          trend={totalPnl >= 0 ? 'positive' : 'negative'}
          subtext={`Realized: $${realizedPnlTotal.toFixed(2)} | Unrealized: $${unrealizedPnlTotal.toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
        />

        <Metric
          title="Open Paper Positions"
          value={openTrades.length}
          trend={openTrades.length > 0 ? 'positive' : 'neutral'}
          subtext="Active simulated exposure"
          icon={<TrendingUp className="w-5 h-5" />}
        />

        <Metric
          title="Resolved Positions"
          value={closedTrades.length}
          trend="neutral"
          subtext="Settled via market resolution"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />

        <Metric
          title="Simulated Sizing Rule"
          value="$5.00 min - $20.00 max"
          trend="neutral"
          subtext="Scaled by confidence factor"
          icon={<ShieldCheck className="w-5 h-5" />}
        />
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-[#060a14] p-1 rounded-lg border border-blue-500/20 text-xs">
              <span className="text-slate-400 font-mono px-1.5 text-[11px]">Status:</span>
              {(['ALL', 'open', 'resolved', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-blue-950/40'
                  }`}
                >
                  {s === 'ALL' ? 'All' : s.toUpperCase()}
                </button>
              ))}
            </div>

            {/* PnL Filter */}
            <select
              value={pnlFilter}
              onChange={(e) => setPnlFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-[#060a14] border border-blue-500/20 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-400 font-medium"
            >
              <option value="ALL">All Outcomes</option>
              <option value="profit">Profitable (+PnL)</option>
              <option value="loss">Unprofitable (-PnL)</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search wallet, market ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#060a14] border border-blue-500/20 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </Card>

      {/* Positions Content */}
      {filteredTrades.length === 0 ? (
        <EmptyState
          title="No Paper Trades Found"
          description="Signals scoring above the copy threshold will automatically generate simulated paper trades."
        />
      ) : (
        <>
          {/* Mobile Position Cards (<lg screens) */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {filteredTrades.map((trade) => {
              const pnl = trade.status === 'open' ? trade.unrealizedPnl : trade.realizedPnl;

              return (
                <div
                  key={trade.id}
                  onClick={() => setSelectedTrade(trade)}
                  className="p-4 rounded-xl bg-[#090e1a] border border-blue-500/15 space-y-3 cursor-pointer hover:border-blue-500/35 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-blue-400 font-semibold">
                      {trade.outcome} • ${(trade.simulatedPositionSize || 10).toFixed(2)} Size
                    </span>
                    {getStatusBadge(trade.status)}
                  </div>

                  <div className="text-sm font-semibold text-white line-clamp-2">
                    {trade.marketQuestion || `Polymarket Condition: ${trade.marketId.slice(0, 16)}...`}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-500/10 text-xs font-mono">
                    <div>
                      <div className="text-[10px] text-slate-400">ENTRY / CURR</div>
                      <div className="text-white">
                        ${trade.entryPrice.toFixed(2)} / ${trade.currentPrice.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">SIMULATED PNL</div>
                      <div className={`font-bold ${pnl >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
                        {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">OPENED</div>
                      <div className="text-slate-400">{formatTimestamp(trade.openedAt)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (lg+ screens) */}
          <div className="hidden lg:block">
            <Card noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-blue-500/15 bg-[#060a14] font-mono text-[11px] text-slate-400">
                      <th className="py-3 px-4">Opened</th>
                      <th className="py-3 px-4">Copied Wallet</th>
                      <th className="py-3 px-4">Market & Outcome</th>
                      <th className="py-3 px-4 text-right">Simulated Size</th>
                      <th className="py-3 px-4 text-right">Entry / Current</th>
                      <th className="py-3 px-4 text-right">Simulated PnL</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/10">
                    {filteredTrades.map((trade) => {
                      const pnl = trade.status === 'open' ? trade.unrealizedPnl : trade.realizedPnl;

                      return (
                        <tr
                          key={trade.id}
                          onClick={() => setSelectedTrade(trade)}
                          className="hover:bg-blue-950/20 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                            {formatTimestamp(trade.openedAt)}
                          </td>
                          <td className="py-3 px-4 font-mono text-blue-300">
                            <span className="group-hover:text-blue-200">
                              {trade.walletAddress.slice(0, 6)}...{trade.walletAddress.slice(-4)}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate">
                            <div className="font-medium text-white truncate">
                              {trade.marketQuestion || `Condition: ${trade.marketId.slice(0, 14)}...`}
                            </div>
                            <div className="text-[10px] text-blue-400 font-semibold font-mono mt-0.5">
                              {trade.outcome}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-white font-semibold">
                            ${(trade.simulatedPositionSize || 10).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                            <div className="text-white">${trade.entryPrice.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-400">${trade.currentPrice.toFixed(2)}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                            <span className={pnl >= 0 ? 'text-sky-300' : 'text-rose-400'}>
                              {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {getStatusBadge(trade.status)}
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

      {/* Trade Inspection Modal */}
      {selectedTrade && (
        <Modal
          isOpen={!!selectedTrade}
          onClose={() => setSelectedTrade(null)}
          title="Simulated Position Inspection"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-blue-500/15">
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase">POSITION STATE</div>
                <div className="mt-1">{getStatusBadge(selectedTrade.status)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-400 uppercase">SIMULATED PNL</div>
                <div
                  className={`text-xl font-mono font-bold ${
                    (selectedTrade.status === 'open' ? selectedTrade.unrealizedPnl : selectedTrade.realizedPnl) >= 0
                      ? 'text-sky-300'
                      : 'text-rose-400'
                  }`}
                >
                  {(selectedTrade.status === 'open' ? selectedTrade.unrealizedPnl : selectedTrade.realizedPnl) >= 0
                    ? `+$${(selectedTrade.status === 'open' ? selectedTrade.unrealizedPnl : selectedTrade.realizedPnl).toFixed(2)}`
                    : `-$${Math.abs(selectedTrade.status === 'open' ? selectedTrade.unrealizedPnl : selectedTrade.realizedPnl).toFixed(2)}`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-2.5 rounded-lg bg-[#060a14] border border-blue-500/15">
                <div className="text-[10px] text-slate-400">POSITION SIZE</div>
                <div className="text-white font-bold text-sm mt-0.5">
                  ${(selectedTrade.simulatedPositionSize || 10).toFixed(2)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#060a14] border border-blue-500/15">
                <div className="text-[10px] text-slate-400">OUTCOME SIDE</div>
                <div className="text-blue-300 font-bold text-sm mt-0.5">{selectedTrade.outcome}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#060a14] border border-blue-500/15">
                <div className="text-[10px] text-slate-400">ENTRY PRICE</div>
                <div className="text-white font-bold text-sm mt-0.5">${selectedTrade.entryPrice.toFixed(3)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#060a14] border border-blue-500/15">
                <div className="text-[10px] text-slate-400">CURRENT PRICE</div>
                <div className="text-white font-bold text-sm mt-0.5">${selectedTrade.currentPrice.toFixed(3)}</div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase">COPIED WALLET</div>
              <div className="p-2 rounded bg-[#060a14] border border-blue-500/10 font-mono text-blue-300">
                {selectedTrade.walletAddress}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Link href={`/research/wallet/${selectedTrade.walletAddress}`}>
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
