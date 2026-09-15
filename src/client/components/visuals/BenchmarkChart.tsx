import React from 'react';
import { BarChart3, CheckCircle2, XCircle, Eye, ShieldCheck } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export interface BenchmarkCohortMetrics {
  totalTrades: number;
  winRate: number | null;
  realizedPnl: number;
  status: string;
}

export interface BenchmarkChartProps {
  cohorts?: {
    botFiltered?: BenchmarkCohortMetrics;
    blindLeaderboard?: BenchmarkCohortMetrics;
    watchlist?: BenchmarkCohortMetrics;
    skipped?: BenchmarkCohortMetrics;
  };
}

export const BenchmarkChart: React.FC<BenchmarkChartProps> = ({ cohorts }) => {
  const filtered = cohorts?.botFiltered || { totalTrades: 0, winRate: null, realizedPnl: 0, status: 'NO DATA' };
  const blind = cohorts?.blindLeaderboard || { totalTrades: 0, winRate: null, realizedPnl: 0, status: 'NO DATA' };
  const watch = cohorts?.watchlist || { totalTrades: 0, winRate: null, realizedPnl: 0, status: 'NO DATA' };
  const skip = cohorts?.skipped || { totalTrades: 0, winRate: null, realizedPnl: 0, status: 'NO DATA' };

  const items = [
    {
      id: 'botFiltered',
      label: 'Bot-Filtered Paper Copy',
      sub: 'Multi-factor scored & simulated',
      pnl: filtered.realizedPnl,
      trades: filtered.totalTrades,
      winRate: filtered.winRate,
      color: 'bg-[#00A896]',
      textColor: 'text-[#02C39A]',
      isPrimary: true,
      icon: <ShieldCheck className="w-4 h-4 text-[#02C39A]" />,
    },
    {
      id: 'blind',
      label: 'Blind Leaderboard Copy',
      sub: 'Naive copy of all top 500 fills',
      pnl: blind.realizedPnl,
      trades: blind.totalTrades,
      winRate: blind.winRate,
      color: 'bg-[#05668D]',
      textColor: 'text-slate-300',
      isPrimary: false,
      icon: <BarChart3 className="w-4 h-4 text-[#028090]" />,
    },
    {
      id: 'watchlist',
      label: 'Watchlist Cohort',
      sub: 'Observed interesting setups',
      pnl: watch.realizedPnl,
      trades: watch.totalTrades,
      winRate: watch.winRate,
      color: 'bg-[#07111E]',
      textColor: 'text-slate-400',
      isPrimary: false,
      icon: <Eye className="w-4 h-4 text-slate-400" />,
    },
    {
      id: 'skipped',
      label: 'Skipped Cohort',
      sub: 'Filter-rejected uncopyable trades',
      pnl: skip.realizedPnl,
      trades: skip.totalTrades,
      winRate: skip.winRate,
      color: 'bg-black',
      textColor: 'text-slate-500',
      isPrimary: false,
      icon: <XCircle className="w-4 h-4 text-slate-500" />,
    },
  ];

  const maxAbsPnl = Math.max(10, ...items.map((i) => Math.abs(i.pnl)));

  return (
    <Card
      header={
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#02C39A]" />
          <span>4-Cohort Strategy Benchmark</span>
        </div>
      }
      className="overflow-hidden"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Evaluates algorithmic value-add by comparing the bot-filtered strategy against naive blind copy and rejected signals.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {items.map((item) => {
            const pnlWidth = Math.min(100, (Math.abs(item.pnl) / maxAbsPnl) * 100);

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  item.isPrimary
                    ? 'bg-[#05668D]/20 border-[#02C39A]/30 shadow-md'
                    : 'bg-[#07111E] border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <div>
                      <div className={`text-xs font-bold ${item.isPrimary ? 'text-[#F0F3BD]' : 'text-slate-200'}`}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-400">{item.sub}</div>
                    </div>
                  </div>
                  <Badge variant={item.isPrimary ? 'turquoise' : 'neutral'} className="text-[10px] font-mono shrink-0">
                    {item.trades} TRADES
                  </Badge>
                </div>

                <div className="mt-3 flex items-baseline justify-between font-mono">
                  <span className="text-[11px] text-slate-400">Realized PnL:</span>
                  <span className={`text-sm font-bold ${item.pnl >= 0 ? 'text-[#02C39A]' : 'text-rose-400'}`}>
                    {item.pnl >= 0 ? `+$${item.pnl.toFixed(2)}` : `-$${Math.abs(item.pnl).toFixed(2)}`}
                  </span>
                </div>

                <div className="mt-1.5 h-1.5 w-full bg-[#04080F] rounded-full overflow-hidden border border-[#00A896]/20">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${Math.max(6, pnlWidth)}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Win Rate:</span>
                  <span className="text-slate-300">
                    {item.winRate !== null ? `${(item.winRate * 100).toFixed(1)}%` : 'INSUFFICIENT DATA'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
