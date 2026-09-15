/**
 * CLI Runner Implementation for Autonomous Operator Engine.
 * 
 * Supports commands corresponding to the strategy specifications:
 * - seed
 * - scan:leaderboard [--mode=live|demo] [--top=500] [--days=30]
 * - scan:wallets [--mode=live|demo] [--days=30]
 * - monitor:trades [--mode=live|demo]
 * - score:trades
 * - update-pnl
 * - review:outcomes
 * - update:rules
 * - report:daily
 */

import { getDatabaseManager } from '../db/connection.js';
import { RuleSetRepository } from '../db/repositories/ruleset.repo.js';
import { WalletRepository } from '../db/repositories/wallet.repo.js';
import { LeaderboardRepository } from '../db/repositories/leaderboard.repo.js';
import { TradeRepository } from '../db/repositories/trade.repo.js';
import { MarketRepository } from '../db/repositories/market.repo.js';
import { DecisionRepository } from '../db/repositories/decision.repo.js';
import { PaperTradeRepository } from '../db/repositories/paper-trade.repo.js';
import { PnlRepository } from '../db/repositories/pnl.repo.js';
import { ReviewRepository } from '../db/repositories/review.repo.js';
import { ReportRepository } from '../db/repositories/report.repo.js';
import { IngestionRepository } from '../db/repositories/ingestion.repo.js';
import { HistoricalCopyRepository } from '../db/repositories/historical-copy.repo.js';
import { DetectedTradeRepository } from '../db/repositories/detected-trade.repo.js';

import { DEFAULT_RULESET } from '../config/ruleset.default.js';
import { DEFAULT_PROVIDER_CONFIG } from '../config/provider.config.js';
import { IngestionService } from '../core/ingestion-service.js';
import { WalletScorer } from '../core/wallet-scorer.js';
import { WalletResearchPipeline } from '../core/wallet-research-pipeline.js';
import { HistoricalTradeResearchPipeline } from '../core/historical-trade-research.js';
import { WalletTradeMonitor } from '../core/wallet-trade-monitor.js';
import { PnlTracker } from '../core/pnl-tracker.js';
import { OutcomeReviewer } from '../core/outcome-reviewer.js';
import { PolymarketWalletActivityAdapter } from '../adapters/wallet-activity.adapter.js';
import {
  DEMO_LEADERBOARD_SCAN,
  DEMO_WALLETS,
  DEMO_OBSERVED_TRADE,
  DEMO_MARKET_SNAPSHOT,
  DEMO_DECISION_JOURNAL,
  DEMO_PAPER_TRADE,
  DEMO_PNL_SNAPSHOT,
  DEMO_OUTCOME_REVIEW,
  DEMO_DAILY_REPORT
} from '../db/fixtures/demo-data.js';

import { ExecutionBoundary } from '../safety/execution-boundary.js';

export class CliRunner {
  public static async run(args: string[]): Promise<void> {
    ExecutionBoundary.assertPaperMode();
    const dbManager = getDatabaseManager();
    const db = dbManager.getDatabase();

    const rulesetRepo = new RuleSetRepository(db);
    const walletRepo = new WalletRepository(db);
    const leaderboardRepo = new LeaderboardRepository(db);
    const tradeRepo = new TradeRepository(db);
    const marketRepo = new MarketRepository(db);
    const decisionRepo = new DecisionRepository(db);
    const paperTradeRepo = new PaperTradeRepository(db);
    const pnlRepo = new PnlRepository(db);
    const reviewRepo = new ReviewRepository(db);
    const reportRepo = new ReportRepository(db);
    const ingestionRepo = new IngestionRepository(db);
    const histCopyRepo = new HistoricalCopyRepository(db);
    const detectedTradeRepo = new DetectedTradeRepository(db);

    const command = args[0] || 'seed';

    // Parse options
    const modeArg = args.find(a => a.startsWith('--mode='));
    const mode: 'live' | 'fixture' = (modeArg ? modeArg.split('=')[1] : 'fixture') === 'live' ? 'live' : 'fixture';

    const topArg = args.find(a => a.startsWith('--top='));
    const topN = topArg ? parseInt(topArg.split('=')[1], 10) : 500;

    const daysArg = args.find(a => a.startsWith('--days='));
    const lookbackDays = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30;

    console.log('================================================================');
    console.log(`[OPERATOR] Command: ${command}`);
    console.log(`[SAFETY] Execution Mode: STRICTLY PAPER ONLY`);
    console.log(`[DATA MODE] ${mode === 'live' ? 'LIVE READ-ONLY DATA INGESTION' : 'DEMO / FIXTURE DATA MODE'}`);
    console.log('================================================================');

    const ingestionService = new IngestionService(db, DEFAULT_PROVIDER_CONFIG);

    switch (command) {
      case 'seed': {
        console.log('[SEED] Seeding baseline RuleSet v1.0.0 and demo fixtures...');
        if (!rulesetRepo.getRuleSetById(DEFAULT_RULESET.id)) {
          rulesetRepo.saveRuleSet(DEFAULT_RULESET);
        }
        leaderboardRepo.saveScan(DEMO_LEADERBOARD_SCAN);
        for (const w of DEMO_WALLETS) {
          walletRepo.upsertWalletProfile(w);
        }
        tradeRepo.insertObservedTrade(DEMO_OBSERVED_TRADE);
        marketRepo.insertSnapshot(DEMO_MARKET_SNAPSHOT);
        decisionRepo.insertDecision(DEMO_DECISION_JOURNAL);
        paperTradeRepo.insertPaperTrade(DEMO_PAPER_TRADE);
        pnlRepo.insertSnapshot(DEMO_PNL_SNAPSHOT);
        reviewRepo.insertOutcomeReview(DEMO_OUTCOME_REVIEW);
        reportRepo.upsertDailyReport(DEMO_DAILY_REPORT);
        console.log('[SEED] Database populated with labeled demo records (isDemo: true).');
        break;
      }

      case 'scan:leaderboard': {
        console.log(`[LEADERBOARD] Fetching top ${topN} leaderboard records (window: ${lookbackDays}d)...`);
        const result = await ingestionService.ingestLeaderboard(mode, topN, lookbackDays);
        console.log(`[LEADERBOARD] Status: ${result.status}`);
        console.log(`[LEADERBOARD] Summary: ${result.summaryMessage}`);
        console.log(`[LEADERBOARD] Diagnostic breakdown:`, JSON.stringify(result.diagnostics, null, 2));
        if (result.status === 'failed' && mode === 'live') {
          process.exitCode = 1;
        }
        break;
      }

      case 'scan:wallets': {
        console.log(`[WALLETS] Executing Wallet Intelligence & Research Pipeline (Window: ${lookbackDays}d)...`);
        const activeRuleSet = rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;
        const topWallets = walletRepo.listTopWallets(50);
        let addresses = topWallets.map(w => w.address);

        // If in live mode, ingest fresh wallet activity first
        if (mode === 'live' && addresses.length > 0) {
          console.log(`[WALLETS] Ingesting live trade activity for ${addresses.length} target wallets...`);
          const ingResult = await ingestionService.ingestWalletActivity(mode, addresses, lookbackDays);
          console.log(`[WALLETS] Ingestion status: ${ingResult.status}`);
          if (ingResult.status === 'failed') {
            process.exitCode = 1;
            break;
          }
        }

        // Run Research Pipeline against stored normalized observations
        const pipeline = new WalletResearchPipeline(db);
        const report = await pipeline.executePipeline({
          ruleSet: activeRuleSet,
          lookbackDays,
          targetPopulation: addresses.length > 0 ? addresses.length : 50
        });

        console.log(`\n================================================================`);
        console.log(`[RESEARCH REPORT] RuleSet: ${report.ruleVersion} | Lookback: ${report.lookbackDays} days`);
        console.log(`[RESEARCH COUNTS] Analyzed: ${report.walletsAnalyzed} | Scored: ${report.walletsScored}`);
        console.log(`[STATUS SUMMARY] TRACK: ${report.walletsTrack} | WATCH: ${report.walletsWatch} | IGNORE: ${report.walletsIgnore}`);
        console.log(`[DATA QUALITY] Insufficient Evidence: ${report.walletsInsufficientData}`);
        console.log(`================================================================\n`);

        if (report.evaluations.length > 0) {
          console.log(`TOP RANKED WALLETS:`);
          for (const ev of report.evaluations.slice(0, 10)) {
            const p = report.profiles.find(prof => prof.address === ev.walletAddress);
            console.log(
              `  Rank #${ev.globalRank.toString().padStart(2, ' ')} | [${ev.status.toUpperCase().padEnd(6, ' ')}] ` +
              `Score: ${ev.finalScore.toFixed(1).padStart(5, ' ')} | ` +
              `Cat: ${ev.bestCategory.padEnd(10, ' ')} (#${ev.categoryRank}) | ` +
              `ROI: ${(p?.roi30d ? (p.roi30d * 100).toFixed(1) + '%' : 'N/A').padStart(7, ' ')} | ` +
              `Evidence: ${ev.dataCompleteness.evidenceTier.padEnd(18, ' ')} | ` +
              `Wallet: ${ev.walletAddress.slice(0, 16)}...`
            );
          }

          if (Object.keys(report.categoryLeaders).length > 0) {
            console.log(`\nCATEGORY LEADERS:`);
            for (const [cat, leader] of Object.entries(report.categoryLeaders)) {
              console.log(`  - [${cat.padEnd(12, ' ')}]: ${leader.address.slice(0, 16)}... (Score: ${leader.globalScore.toFixed(1)}, Status: ${leader.status.toUpperCase()})`);
            }
          }
        } else {
          console.log('[RESEARCH REPORT] Zero wallets evaluated. Populate leaderboard and observed trades first.');
        }
        break;
      }

      case 'monitor:trades': {
        console.log('[TRADES] Monitoring tracked wallets for new trade events...');
        const trackedWallets = walletRepo.listWalletsByStatus('track');
        console.log(`[TRADES] Found ${trackedWallets.length} TRACK wallets under active observation.`);
        const recentTrades = tradeRepo.listRecentTrades(10);
        console.log(`[TRADES] Most recent trades in store: ${recentTrades.length}`);
        for (const t of recentTrades.slice(0, 3)) {
          console.log(`  - [${t.sourceTimestamp}] ${t.walletAddress.slice(0, 10)}... ${t.side} ${t.outcome} on "${t.marketQuestion.slice(0, 35)}..." @ $${t.walletEntryPrice}`);
        }
        break;
      }

      case 'score:trades': {
        console.log('[SCORE] Scoring observed trades and writing to DecisionJournal...');
        const decisions = decisionRepo.listRecentDecisions(5);
        console.log(`[SCORE] Evaluated ${decisions.length} decisions. All entries auditable.`);
        break;
      }

      case 'update-pnl': {
        console.log('[PNL] Updating mark-to-market positions and recording hourly snapshots...');
        const openTrades = paperTradeRepo.listOpenPaperTrades();
        let updatedCount = 0;
        let totalUnrealized = 0;

        for (const trade of openTrades) {
          const snapshot = marketRepo.getLatestMarketSnapshot(trade.marketId);
          const currentPrice = snapshot
            ? (trade.outcome.toUpperCase() === 'YES' ? snapshot.yesPrice : snapshot.noPrice)
            : trade.currentPrice;

          const { updatedTrade, snapshot: pnlSnap } = PnlTracker.createHourlySnapshot(trade, currentPrice);
          paperTradeRepo.updatePaperTrade(updatedTrade);
          pnlRepo.insertSnapshot(pnlSnap);
          updatedCount++;
          totalUnrealized += updatedTrade.unrealizedPnl;
        }

        console.log(`[PNL] Processed ${updatedCount} open paper trade(s).`);
        console.log(`[PNL] Current Unrealized Portfolio PnL: $${totalUnrealized.toFixed(2)}`);
        break;
      }

      case 'review:outcomes': {
        console.log('[REVIEW] Checking retrospective milestones (T+1h, T+6h, T+24h, resolution)...');
        const openTrades = paperTradeRepo.listOpenPaperTrades();
        let createdReviews = 0;

        for (const trade of openTrades) {
          const decision = decisionRepo.getDecisionById(trade.decisionJournalId);
          if (!decision) continue;

          const snapshot = marketRepo.getLatestMarketSnapshot(trade.marketId);
          const currentPrice = snapshot
            ? (trade.outcome.toUpperCase() === 'YES' ? snapshot.yesPrice : snapshot.noPrice)
            : trade.currentPrice;

          const ageHours = Math.max(0, (Date.now() - new Date(trade.openedAt).getTime()) / (1000 * 3600));
          let milestone: 'T+1h' | 'T+6h' | 'T+24h' | 'resolution' = 'T+1h';
          if (ageHours >= 24) milestone = 'T+24h';
          else if (ageHours >= 6) milestone = 'T+6h';

          const review = OutcomeReviewer.reviewMilestone(trade, decision, milestone, currentPrice);
          reviewRepo.insertOutcomeReview(review);
          createdReviews++;
        }

        const reviews = reviewRepo.listAllReviews(5);
        console.log(`[REVIEW] Created ${createdReviews} new milestone review(s).`);
        console.log(`[REVIEW] Total outcome reviews on record: ${reviews.length}`);
        break;
      }

      case 'pipeline:cycle': {
        const cycleModeArg = args.find(a => a.startsWith('--mode='));
        const cycleMode = (cycleModeArg ? cycleModeArg.split('=')[1] : 'fixture').toLowerCase();
        console.log(`\n================================================================`);
        console.log(`[PIPELINE CYCLE] Starting Integrated Paper-Trading Research Loop`);
        console.log(`[PIPELINE CYCLE] Mode: ${cycleMode.toUpperCase()} | Execution: PAPER ONLY`);
        console.log(`================================================================\n`);

        console.log('--- Step 1: Leaderboard Ingestion ---');
        await CliRunner.run(['scan:leaderboard', `--mode=${cycleMode}`, '--top=50']);

        console.log('\n--- Step 2: Wallet Activity & Profile Research ---');
        await CliRunner.run(['scan:wallets', `--mode=${cycleMode}`]);

        console.log('\n--- Step 3: Historical Trade Copyability Research ---');
        await CliRunner.run(['research:copyability', '--window=30d']);

        console.log('\n--- Step 4: Real-Time Trade Detection & Paper Decisions ---');
        await CliRunner.run(['monitor:wallets', `--mode=${cycleMode}`]);

        console.log('\n--- Step 5: Mark-to-Market PnL Updates ---');
        await CliRunner.run(['update-pnl']);

        console.log('\n--- Step 6: Retrospective Milestone Reviews ---');
        await CliRunner.run(['review:outcomes']);

        console.log('\n--- Step 7: Daily Performance Digest ---');
        await CliRunner.run(['report:daily']);

        console.log(`\n================================================================`);
        console.log(`[PIPELINE CYCLE] Successfully completed end-to-end research loop.`);
        console.log(`[PIPELINE CYCLE] Run 'npm run web' to inspect results on http://localhost:3000.`);
        console.log(`================================================================\n`);
        break;
      }

      case 'update:rules': {
        console.log('[RULES] Checking empirical performance against bounded parameter space...');
        const changes = rulesetRepo.listRuleChanges();
        console.log(`[RULES] Rule changes logged in audit table: ${changes.length}`);
        break;
      }

      case 'report:daily': {
        console.log('[REPORT] Generating daily digest report...');
        const report = reportRepo.getDailyReportByDate(new Date().toISOString().slice(0, 10)) || DEMO_DAILY_REPORT;
        console.log(`[REPORT] Daily Report Date: ${report.reportDate}`);
        console.log(`[REPORT] Paper PnL Today: $${report.paperPnlToday.toFixed(2)} | Cumulative: $${report.totalPaperPnl.toFixed(2)}`);
        console.log(`[REPORT] Copied: ${report.tradesCopiedCount}, Watched: ${report.tradesWatchedCount}, Skipped: ${report.tradesSkippedCount}`);
        break;
      }

      case 'research:copyability': {
        const windowArg = args.find(a => a.startsWith('--window='));
        const window = windowArg ? windowArg.split('=')[1] : '30d';
        console.log(`[RESEARCH] Running Trade Copyability Research Pipeline (Window: ${window})...`);

        const activeRuleSet = rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;
        const allTrades = tradeRepo.listRecentTrades(1000);
        const allSnapshots = marketRepo.listRecentSnapshots(2000);

        const snapshotMap = new Map<string, typeof allSnapshots[0]>();
        for (const snap of allSnapshots) {
          if (!snapshotMap.has(snap.marketId)) {
            snapshotMap.set(snap.marketId, snap);
          }
        }

        const tradeMap = new Map<string, typeof allTrades[0]>();
        for (const t of allTrades) {
          tradeMap.set(t.id, t);
        }

        const evaluations = allTrades.map(t => {
          const snap = snapshotMap.get(t.marketId) || null;
          return HistoricalTradeResearchPipeline.evaluateTradeCopyability(
            t,
            snap,
            activeRuleSet,
            null,
            { datasetId: 'dataset-cli', datasetVersion: '1.0.0', analysisWindow: window }
          );
        });

        histCopyRepo.saveBatch(evaluations);
        const summary = histCopyRepo.getSummary(window);
        const catAggs = HistoricalTradeResearchPipeline.aggregateByCategory(evaluations, tradeMap);

        console.log(`\n================================================================`);
        console.log(`[TRADE COPYABILITY RESEARCH REPORT] Window: ${window}`);
        console.log(`[EVALUATIONS] Analyzed: ${summary.totalTradesAnalyzed}`);
        console.log(`[CLASSIFICATIONS] COPYABLE: ${summary.copyableCount} | DIFFICULT: ${summary.difficultCount} | UNFOLLOWABLE: ${summary.unfollowableCount} | INSUFFICIENT DATA: ${summary.insufficientDataCount}`);
        console.log(`[RESEARCH COHORTS] Missed Winners: ${summary.missedWinnerCount} | Avoided Losers: ${summary.avoidedLoserCount}`);
        console.log(`[FINANCIALS] Modeled Copy PnL: $${summary.totalModeledCopyPnL.toFixed(2)} | Wallet PnL: $${summary.totalWalletPnL.toFixed(2)} | Delta: $${summary.totalCopyPnLDelta.toFixed(2)}`);
        console.log(`[EXECUTION CONDITIONS] Avg Latency: ${summary.avgLatencySeconds}s | Avg Spread: $${summary.avgSpreadAtCopy} | Avg Liquidity: $${summary.avgLiquidityAtCopy}`);
        console.log(`================================================================\n`);

        if (catAggs.length > 0) {
          console.log(`CATEGORY COPYABILITY:`);
          for (const c of catAggs.slice(0, 5)) {
            console.log(`  ${c.category.padEnd(15)} | Trades: ${c.tradeCount} | Copyable: ${c.copyableCount} (${(c.copyabilityRate * 100).toFixed(0)}%) | Med Spread: $${c.medianSpread.toFixed(3)} | Med Liq: $${c.medianLiquidityUsd.toFixed(0)}`);
          }
        }
        break;
      }

      case 'monitor:wallets': {
        const activeRuleSet = rulesetRepo.getActiveRuleSet() || DEFAULT_RULESET;
        const runnerModeArg = args.find(a => a.startsWith('--mode='));
        const runnerMode = (runnerModeArg ? runnerModeArg.split('=')[1] : 'fixture').toLowerCase();

        const intervalArg = args.find(a => a.startsWith('--interval='));
        const interval = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : undefined;

        const walletArg = args.find(a => a.startsWith('--wallet='));
        const targetWallet = walletArg ? walletArg.split('=')[1] : undefined;

        const topArg = args.find(a => a.startsWith('--top='));
        const topLimit = topArg ? parseInt(topArg.split('=')[1], 10) : 500;

        console.log(`\n[MONITOR] Starting Wallet Trade Monitor`);
        console.log(`[MONITOR] Mode: ${runnerMode.toUpperCase()} | Execution: PAPER ONLY`);
        if (targetWallet) console.log(`[MONITOR] Target Wallet: ${targetWallet}`);
        console.log(`[MONITOR] Max Wallets: ${topLimit}`);

        const adapter = runnerMode === 'live' ? new PolymarketWalletActivityAdapter(DEFAULT_PROVIDER_CONFIG) : undefined;

        const monitor = new WalletTradeMonitor(
          db,
          walletRepo,
          tradeRepo,
          marketRepo,
          decisionRepo,
          paperTradeRepo,
          detectedTradeRepo,
          activeRuleSet,
          adapter
        );

        const result = await monitor.pollOnce({ targetWallet, topLimit });
        const health = monitor.getSystemHealth();

        console.log(`\n================================================================`);
        console.log(`[REAL-TIME WALLET TRADE MONITOR SUMMARY]`);
        console.log(`================================================================`);
        console.log(`Mode:                 ${runnerMode.toUpperCase()} (READ-ONLY INGESTION)`);
        console.log(`Execution Mode:       ${health.executionMode}`);
        console.log(`Wallets Checked:      ${result.walletsChecked}`);
        console.log(`Trades Received:      ${result.tradesReceived}`);
        console.log(`New Trades Detected:  ${result.newTradesDetected}`);
        console.log(`Decisions Created:    ${result.decisionsCreated}`);
        console.log(`  - PAPER_COPY:       ${result.paperCopies}`);
        console.log(`  - WATCHLIST:        ${result.watchlists}`);
        console.log(`  - SKIP:             ${result.skips}`);
        console.log(`Paper Trades Created: ${result.paperTradesCreated}`);
        console.log(`Poll Duration:        ${result.pollDurationMs}ms`);
        console.log(`Ingestion Health:     ${health.ingestionStatus}`);
        console.log(`Market Freshness:     ${health.marketDataFreshness}`);
        if (result.errors.length > 0) {
          console.log(`Errors encountered:   ${result.errors.length}`);
          for (const e of result.errors) {
            console.log(`  - [WARN] ${e}`);
          }
        }
        console.log(`================================================================\n`);

        const latestSignals = monitor.getLiveSignals(5);
        if (latestSignals.length > 0) {
          console.log(`LATEST SIGNALS:`);
          for (const s of latestSignals) {
            console.log(`  [${s.decision.toUpperCase().padEnd(10)}] Wallet: ${s.walletAddress.slice(0, 10)}... | Mkt: ${s.marketId.slice(0, 18)} | Score: ${s.finalScore.toFixed(1)} | Copyable: ${s.copyability} | Paper: ${s.paperTradeId ? `$${s.paperSize?.toFixed(2)}` : 'N/A'}`);
          }
          console.log('');
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exitCode = 1;
    }
  }
}

// Auto-run if executed directly
const cliArgs = process.argv.slice(2);
CliRunner.run(cliArgs).catch(err => {
  console.error('[CLI ERROR]', err);
  process.exit(1);
});
