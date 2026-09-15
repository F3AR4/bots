import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  DollarSign,
  Percent,
  Award,
  Layers,
  Clock,
  ExternalLink,
  ChevronRight,
  X,
  BookOpen,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'wouter';
import { Card } from '../components/ui/Card';
import { Metric } from '../components/ui/Metric';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { useReports } from '../hooks/useSystemData';
import { DailyReportItem } from '../api/types';

export const DailyReportsPage: React.FC = () => {
  const { data, isLoading, error, refetch } = useReports(30);
  const [selectedReport, setSelectedReport] = useState<DailyReportItem | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingState rows={2} />
        <LoadingState rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Research Reports Archive Offline"
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  const reports = data?.reports || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span>Daily Research Reports & Rollups</span>
            <Badge variant="paper">RESEARCH ARCHIVE</Badge>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Chronological audit of daily paper performance, decision distributions, outcome lessons, and RuleSet observations.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span>{reports.length} Reports Archived</span>
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <EmptyState
          title="No Daily Reports Generated Yet"
          description="Daily rollup reports are produced at scheduled intervals summarizing paper PnL, win rates, and strategy lessons. The monitor continues collecting raw observations."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(report => {
            const isPnlPositive = report.paperPnlToday >= 0;
            const isTotalPositive = report.totalPaperPnl >= 0;

            return (
              <Card key={report.id}>
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2 font-mono">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold text-slate-100">{report.reportDate}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      Rule: {report.activeRuleVersion}
                    </span>
                  </div>

                  {/* Financial Metrics */}
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Today PnL</span>
                      <span className={`font-semibold ${isPnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${isPnlPositive ? '+' : ''}{report.paperPnlToday.toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Cumulative PnL</span>
                      <span className={`font-semibold ${isTotalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${isTotalPositive ? '+' : ''}{report.totalPaperPnl.toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-500 block text-[10px]">Win Rate</span>
                      <span className="text-slate-200 font-semibold">
                        {(report.winRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Decisions Breakdown */}
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    <span>Copied: <strong className="text-emerald-400">{report.tradesCopiedCount}</strong></span>
                    <span>Watched: <strong className="text-amber-400">{report.tradesWatchedCount}</strong></span>
                    <span>Skipped: <strong className="text-slate-400">{report.tradesSkippedCount}</strong></span>
                  </div>

                  {/* Summary Notes Preview */}
                  <div className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {report.summaryNotes || 'Automated daily paper-trading summary and performance consolidation.'}
                  </div>

                  {/* Action Link */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    {report.bestWalletToday ? (
                      <span className="text-[11px] font-mono text-slate-400">
                        Top Trader: {report.bestWalletToday.slice(0, 8)}...
                      </span>
                    ) : (
                      <span />
                    )}

                    <button
                      onClick={() => setSelectedReport(report)}
                      className="text-xs font-mono text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Read Full Report</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <Modal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          title={
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span className="font-mono">Daily Report: {selectedReport.reportDate}</span>
            </div>
          }
          description="Chronological audit of paper trading performance, decisions, and system events."
          footer={
            <button
              onClick={() => setSelectedReport(null)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              Close Report
            </button>
          }
        >
          {/* Performance Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-slate-500 block text-[11px]">Daily PnL</span>
              <span className={`text-base font-bold ${selectedReport.paperPnlToday >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${selectedReport.paperPnlToday >= 0 ? '+' : ''}{selectedReport.paperPnlToday.toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-slate-500 block text-[11px]">Total PnL</span>
              <span className={`text-base font-bold ${selectedReport.totalPaperPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${selectedReport.totalPaperPnl >= 0 ? '+' : ''}{selectedReport.totalPaperPnl.toFixed(2)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-slate-500 block text-[11px]">Win Rate</span>
              <span className="text-base font-bold text-slate-100">
                {(selectedReport.winRate * 100).toFixed(1)}%
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-slate-500 block text-[11px]">Active Rule</span>
              <span className="text-base font-bold text-indigo-300">
                {selectedReport.activeRuleVersion}
              </span>
            </div>
          </div>

          {/* Decision Distribution */}
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
            <span className="text-xs font-mono text-slate-400 font-semibold block">Decision Summary</span>
            <div className="grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                <span className="text-slate-500 block">Paper Copies</span>
                <span className="text-emerald-400 font-bold text-sm">{selectedReport.tradesCopiedCount}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                <span className="text-slate-500 block">Watchlist</span>
                <span className="text-amber-400 font-bold text-sm">{selectedReport.tradesWatchedCount}</span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center">
                <span className="text-slate-500 block">Skipped</span>
                <span className="text-slate-400 font-bold text-sm">{selectedReport.tradesSkippedCount}</span>
              </div>
            </div>
          </div>

          {/* Qualitative Notes */}
          <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-xs font-mono text-slate-400 font-semibold block">Operator Research Brief</span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedReport.summaryNotes}
            </p>
          </div>

          {/* Notable Trade Records */}
          {(selectedReport.bestPaperTradeId || selectedReport.worstPaperTradeId || selectedReport.bestWalletToday) && (
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-1.5 text-xs font-mono">
              <span className="text-slate-400 block text-[11px]">Notable Entities</span>
              {selectedReport.bestWalletToday && (
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Top Performing Wallet:</span>
                  <span className="text-indigo-300">{selectedReport.bestWalletToday}</span>
                </div>
              )}
              {selectedReport.bestPaperTradeId && (
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Best Simulated Trade:</span>
                  <span className="text-emerald-400">#{selectedReport.bestPaperTradeId}</span>
                </div>
              )}
              {selectedReport.worstPaperTradeId && (
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-500">Worst Simulated Trade:</span>
                  <span className="text-rose-400">#{selectedReport.worstPaperTradeId}</span>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
