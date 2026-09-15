import React, { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  X,
  Layers,
  ChevronRight,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { Modal } from '../components/ui/Modal';
import { useWalletRankings } from '../hooks/useResearchData';
import { WalletRankingView, WalletStatus } from '../api/types';

type SortField = 'rank' | 'score' | 'winRate' | 'trades' | 'penalty';
type SortOrder = 'asc' | 'desc';

export const ResearchRankingsPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedWallet, setSelectedWallet] = useState<WalletRankingView | null>(null);

  const { data, isLoading, error, refetch } = useWalletRankings(selectedCategory);

  const rankings = data?.rankings || [];

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    rankings.forEach((r) => {
      if (r.bestCategory) set.add(r.bestCategory);
    });
    return ['ALL', ...Array.from(set)];
  }, [rankings]);

  // Client-side filtering and sorting
  const filteredRankings = useMemo(() => {
    return rankings
      .filter((r) => {
        if (statusFilter !== 'ALL' && r.status !== statusFilter.toLowerCase()) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchAddr = r.walletAddress.toLowerCase().includes(q);
          const matchCat = r.bestCategory.toLowerCase().includes(q);
          if (!matchAddr && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'rank') {
          diff = a.globalRank - b.globalRank;
        } else if (sortField === 'score') {
          diff = a.finalScore - b.finalScore;
        } else if (sortField === 'winRate') {
          const aWr = a.oneHitWonderDiagnostics?.singleTradeProfitRatio ?? 0;
          const bWr = b.oneHitWonderDiagnostics?.singleTradeProfitRatio ?? 0;
          diff = aWr - bWr;
        } else if (sortField === 'trades') {
          const aTrades = a.frequencyMetrics?.activeTradingDaysCount ?? 0;
          const bTrades = b.frequencyMetrics?.activeTradingDaysCount ?? 0;
          diff = aTrades - bTrades;
        } else if (sortField === 'penalty') {
          diff = a.totalPenaltyDeduction - b.totalPenaltyDeduction;
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [rankings, statusFilter, searchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'rank' ? 'asc' : 'desc');
    }
  };

  const clearFilters = () => {
    setSelectedCategory('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
    setSortField('rank');
    setSortOrder('asc');
  };

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
        title="Leaderboard Intelligence Offline"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  const getStatusBadge = (status: WalletStatus) => {
    switch (status) {
      case 'track':
        return <Badge variant="track" dot>TRACK</Badge>;
      case 'watch':
        return <Badge variant="watch">WATCH</Badge>;
      case 'ignore':
      default:
        return <Badge variant="ignore">IGNORE</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-blue-500/15">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Wallet Rankings & Quality Model</span>
            <Badge variant="blue">500 WALLETS</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-dimensional wallet intelligence with strict one-hit-wonder penalties and copyability scoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-blue-300 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800/40">
            {filteredRankings.length} of {rankings.length} Wallets
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-[#060a14] border border-blue-500/20 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-400 font-medium"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'All Domain Categories' : cat}
                </option>
              ))}
            </select>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-[#060a14] p-1 rounded-lg border border-blue-500/20 text-xs">
              <span className="text-slate-400 font-mono px-1.5 text-[11px]">Tier:</span>
              {(['ALL', 'TRACK', 'WATCH', 'IGNORE'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-blue-950/40'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search wallet 0x... or domain"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#060a14] border border-blue-500/20 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </Card>

      {/* Rankings Content */}
      {filteredRankings.length === 0 ? (
        <EmptyState
          title="No Wallets Match Filters"
          description="Adjust or reset your category and status filters to inspect wallet scores."
        />
      ) : (
        <>
          {/* Mobile Card Feed (<lg screens) */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {filteredRankings.map((wallet) => (
              <div
                key={wallet.walletAddress}
                onClick={() => setSelectedWallet(wallet)}
                className="p-4 rounded-xl bg-[#090e1a] border border-blue-500/15 space-y-3 cursor-pointer hover:border-blue-500/35 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-400">
                      #{wallet.globalRank}
                    </span>
                    <span className="font-mono text-xs text-slate-200">
                      {wallet.walletAddress.slice(0, 8)}...{wallet.walletAddress.slice(-6)}
                    </span>
                  </div>
                  {getStatusBadge(wallet.status)}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-blue-500/10 text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-slate-400">DOMAIN</div>
                    <div className="text-white font-semibold truncate">{wallet.bestCategory || 'General'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">PENALTY</div>
                    <div className={wallet.totalPenaltyDeduction > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                      -{wallet.totalPenaltyDeduction.toFixed(0)} pts
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">FINAL SCORE</div>
                    <div className="text-sky-300 font-bold">{wallet.finalScore.toFixed(1)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (lg+ screens) */}
          <div className="hidden lg:block">
            <Card noPadding>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-blue-500/15 bg-[#060a14] font-mono text-[11px] text-slate-400">
                      <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('rank')}>
                        <div className="flex items-center gap-1">
                          <span>Rank</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4">Wallet Address</th>
                      <th className="py-3 px-4">Best Category</th>
                      <th className="py-3 px-4 text-center cursor-pointer hover:text-white" onClick={() => handleSort('penalty')}>
                        <div className="flex items-center justify-center gap-1">
                          <span>Penalty</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center cursor-pointer hover:text-white" onClick={() => handleSort('score')}>
                        <div className="flex items-center justify-center gap-1">
                          <span>Score</span>
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/10">
                    {filteredRankings.map((wallet) => (
                      <tr
                        key={wallet.walletAddress}
                        onClick={() => setSelectedWallet(wallet)}
                        className="hover:bg-blue-950/20 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">
                          #{wallet.globalRank}
                        </td>
                        <td className="py-3 px-4 font-mono text-blue-300">
                          <span className="group-hover:text-blue-200">
                            {wallet.walletAddress.slice(0, 8)}...{wallet.walletAddress.slice(-6)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-white">{wallet.bestCategory || 'General'}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {wallet.totalPenaltyDeduction > 0 ? (
                            <span className="text-rose-400 font-semibold">
                              -{wallet.totalPenaltyDeduction.toFixed(0)} pts
                            </span>
                          ) : (
                            <span className="text-slate-500">0 pts</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-sky-300 text-sm">
                          {wallet.finalScore.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {getStatusBadge(wallet.status)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button className="p-1 rounded text-slate-400 group-hover:text-blue-300 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Wallet Detail Modal */}
      {selectedWallet && (
        <Modal
          isOpen={!!selectedWallet}
          onClose={() => setSelectedWallet(null)}
          title="Wallet Quality & One-Hit Diagnostic"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-blue-500/15">
              <div>
                <div className="text-[10px] font-mono text-slate-400 uppercase">TIER STATUS</div>
                <div className="mt-1">{getStatusBadge(selectedWallet.status)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-slate-400 uppercase">FINAL SCORE</div>
                <div className="text-xl font-mono font-bold text-sky-300">
                  {selectedWallet.finalScore.toFixed(1)} / 100
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase">WALLET ADDRESS</div>
              <div className="p-2.5 rounded-lg bg-[#060a14] border border-blue-500/15 font-mono text-blue-300">
                {selectedWallet.walletAddress}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-white">Status Rationale</div>
              <p className="p-2.5 rounded-lg bg-[#060a14] border border-blue-500/15 text-slate-300">
                {selectedWallet.statusReason || 'Assigned via deterministic scoring rules.'}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Link href={`/research/wallet/${selectedWallet.walletAddress}`}>
                <button className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5">
                  <span>Full Wallet Profile</span>
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
