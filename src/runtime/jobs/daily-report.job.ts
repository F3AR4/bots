/**
 * Daily Performance Digest Report Generation Job (Task 2.0).
 * 
 * Safety Guarantee:
 * - Aggregates real empirical paper trading performance.
 * - Idempotent upsert by date (YYYY-MM-DD).
 * - Zero fabricated metrics.
 */

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { ReportRepository } from '../../db/repositories/report.repo.js';
import { PaperTradeRepository } from '../../db/repositories/paper-trade.repo.js';
import { DecisionRepository } from '../../db/repositories/decision.repo.js';
import { RuleSetRepository } from '../../db/repositories/ruleset.repo.js';
import { DEFAULT_RULESET } from '../../config/ruleset.default.js';
import { DailyReport } from '../../types/domain.js';
import { ExecutionBoundary } from '../../safety/execution-boundary.js';

export class DailyReportJob {
  private reportRepo: ReportRepository;
  private paperTradeRepo: PaperTradeRepository;
  private decisionRepo: DecisionRepository;
  private rulesetRepo: RuleSetRepository;

  constructor(private db: DatabaseSync) {
    ExecutionBoundary.assertPaperMode();
    this.reportRepo = new ReportRepository(db);
    this.paperTradeRepo = new PaperTradeRepository(db);
    this.decisionRepo = new DecisionRepository(db);
    this.rulesetRepo = new RuleSetRepository(db);
  }

  public async run(): Promise<DailyReport> {
    ExecutionBoundary.assertPaperMode();
    const todayStr = new Date().toISOString().slice(0, 10);
    const activeRuleSet = this.rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;

    const allTrades = this.paperTradeRepo.listAllPaperTrades(1000);
    const openTrades = allTrades.filter(t => t.status === 'open');
    const closedTrades = allTrades.filter(t => t.status === 'closed' || t.status === 'resolved');

    const unrealizedPnl = openTrades.reduce((acc, t) => acc + t.unrealizedPnl, 0);
    const realizedPnl = closedTrades.reduce((acc, t) => acc + t.realizedPnl, 0);
    const totalPnl = unrealizedPnl + realizedPnl;

    // Filter trades opened today for daily PnL
    const todayTrades = allTrades.filter(t => t.openedAt.startsWith(todayStr));
    const paperPnlToday = todayTrades.reduce((acc, t) => acc + (t.status === 'open' ? t.unrealizedPnl : t.realizedPnl), 0);

    const wins = closedTrades.filter(t => t.realizedPnl > 0).length;
    const winRate = closedTrades.length > 0 ? wins / closedTrades.length : 0;

    let bestTradeId: string | null = null;
    let worstTradeId: string | null = null;
    if (allTrades.length > 0) {
      const sortedByPnl = [...allTrades].sort((a, b) => {
        const pnlA = a.status === 'open' ? a.unrealizedPnl : a.realizedPnl;
        const pnlB = b.status === 'open' ? b.unrealizedPnl : b.realizedPnl;
        return pnlB - pnlA;
      });
      bestTradeId = sortedByPnl[0].id;
      worstTradeId = sortedByPnl[sortedByPnl.length - 1].id;
    }

    const allDecisions = this.decisionRepo.listRecentDecisions(1000);
    const todayDecisions = allDecisions.filter(d => d.evaluatedAt.startsWith(todayStr));
    const targetDecisions = todayDecisions.length > 0 ? todayDecisions : allDecisions;

    const copiedCount = targetDecisions.filter(d => d.decision === 'paper_copy').length;
    const watchedCount = targetDecisions.filter(d => d.decision === 'watchlist').length;
    const skippedCount = targetDecisions.filter(d => d.decision === 'skip').length;

    // Best wallet calculation
    const walletPnls = new Map<string, number>();
    for (const t of allTrades) {
      const pnl = t.status === 'open' ? t.unrealizedPnl : t.realizedPnl;
      walletPnls.set(t.walletAddress, (walletPnls.get(t.walletAddress) || 0) + pnl);
    }
    let bestWalletToday: string | null = null;
    let maxWalletPnl = -Infinity;
    for (const [wallet, pnl] of walletPnls.entries()) {
      if (pnl > maxWalletPnl) {
        maxWalletPnl = pnl;
        bestWalletToday = wallet;
      }
    }

    const report: DailyReport = {
      id: `rep-${todayStr}`,
      reportDate: todayStr,
      paperPnlToday: Math.round(paperPnlToday * 100) / 100,
      totalPaperPnl: Math.round(totalPnl * 100) / 100,
      winRate: Math.round(winRate * 1000) / 1000,
      bestPaperTradeId: bestTradeId,
      worstPaperTradeId: worstTradeId,
      bestWalletToday,
      tradesCopiedCount: copiedCount,
      tradesWatchedCount: watchedCount,
      tradesSkippedCount: skippedCount,
      activeRuleVersion: activeRuleSet.version,
      summaryNotes: `Autonomous daily digest for ${todayStr}. Total paper trades: ${allTrades.length}, Open: ${openTrades.length}, Closed: ${closedTrades.length}. Execution Mode: STRICTLY PAPER ONLY.`,
      createdAt: new Date().toISOString()
    };

    this.reportRepo.upsertDailyReport(report);
    return report;
  }
}
