/**
 * Repository for DailyReport entities.
 */

import { DatabaseSync } from 'node:sqlite';
import { DailyReport } from '../../types/domain.js';

export class ReportRepository {
  constructor(private db: DatabaseSync) {}

  public upsertDailyReport(report: DailyReport): void {
    const stmt = this.db.prepare(`
      INSERT INTO daily_reports (
        id, report_date, paper_pnl_today, total_paper_pnl, win_rate,
        best_paper_trade_id, worst_paper_trade_id, best_wallet_today,
        trades_copied_count, trades_watched_count, trades_skipped_count,
        active_rule_version, summary_notes, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
      ON CONFLICT(report_date) DO UPDATE SET
        paper_pnl_today = excluded.paper_pnl_today,
        total_paper_pnl = excluded.total_paper_pnl,
        win_rate = excluded.win_rate,
        best_paper_trade_id = excluded.best_paper_trade_id,
        worst_paper_trade_id = excluded.worst_paper_trade_id,
        best_wallet_today = excluded.best_wallet_today,
        trades_copied_count = excluded.trades_copied_count,
        trades_watched_count = excluded.trades_watched_count,
        trades_skipped_count = excluded.trades_skipped_count,
        active_rule_version = excluded.active_rule_version,
        summary_notes = excluded.summary_notes
    `);

    stmt.run(
      report.id,
      report.reportDate,
      report.paperPnlToday,
      report.totalPaperPnl,
      report.winRate,
      report.bestPaperTradeId || null,
      report.worstPaperTradeId || null,
      report.bestWalletToday || null,
      report.tradesCopiedCount,
      report.tradesWatchedCount,
      report.tradesSkippedCount,
      report.activeRuleVersion,
      report.summaryNotes,
      report.createdAt
    );
  }

  public getDailyReportByDate(date: string): DailyReport | null {
    const stmt = this.db.prepare('SELECT * FROM daily_reports WHERE report_date = ?');
    const row = stmt.get(date) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listRecentReports(limit = 30): DailyReport[] {
    const stmt = this.db.prepare('SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT ?');
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: Record<string, unknown>): DailyReport {
    return {
      id: String(row.id),
      reportDate: String(row.report_date),
      paperPnlToday: Number(row.paper_pnl_today),
      totalPaperPnl: Number(row.total_paper_pnl),
      winRate: Number(row.win_rate),
      bestPaperTradeId: row.best_paper_trade_id ? String(row.best_paper_trade_id) : null,
      worstPaperTradeId: row.worst_paper_trade_id ? String(row.worst_paper_trade_id) : null,
      bestWalletToday: row.best_wallet_today ? String(row.best_wallet_today) : null,
      tradesCopiedCount: Number(row.trades_copied_count),
      tradesWatchedCount: Number(row.trades_watched_count),
      tradesSkippedCount: Number(row.trades_skipped_count),
      activeRuleVersion: String(row.active_rule_version),
      summaryNotes: String(row.summary_notes),
      createdAt: String(row.created_at)
    };
  }
}
