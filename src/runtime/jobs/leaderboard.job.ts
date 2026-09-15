/**
 * Leaderboard Ingestion Job (Task 2.0).
 * 
 * Safety Guarantee:
 * - Read-only public leaderboard ingestion.
 * - Handles transient provider failures with retry/backoff.
 * - Never fabricates fake leaderboard entries if provider fails.
 */

import { DatabaseSync } from 'node:sqlite';
import { IngestionService } from '../../core/ingestion-service.js';
import { DEFAULT_PROVIDER_CONFIG } from '../../config/provider.config.js';
import { ExecutionBoundary } from '../../safety/execution-boundary.js';

export class LeaderboardJob {
  private ingestionService: IngestionService;

  constructor(
    private db: DatabaseSync,
    private mode: 'live' | 'fixture' = 'fixture',
    private topLimit = 50,
    private lookbackDays = 30
  ) {
    ExecutionBoundary.assertPaperMode();
    this.ingestionService = new IngestionService(db, DEFAULT_PROVIDER_CONFIG);
  }

  public async run(): Promise<void> {
    ExecutionBoundary.assertPaperMode();
    const result = await this.ingestionService.ingestLeaderboard(
      this.mode,
      this.topLimit,
      this.lookbackDays
    );

    if (result.status === 'failed') {
      throw new Error(`Leaderboard ingestion failed: ${result.summaryMessage}`);
    }
  }
}
