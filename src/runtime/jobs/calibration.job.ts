/**
 * Scheduled Calibration & Rule Learning Job (Task 2.1).
 * 
 * Safety Guarantee:
 * - Runs asynchronously in background on a controlled scheduled cadence.
 * - Single daemon architecture: integrated directly into RuntimeScheduler.
 * - Strictly within PAPER ONLY mode.
 */

import { DatabaseSync } from 'node:sqlite';
import { CalibrationPipeline, CalibrationCycleResult } from '../../core/calibration-pipeline.js';
import { ExecutionBoundary } from '../../safety/execution-boundary.js';
import { RuleLearningConfig } from '../../types/domain.js';

export class CalibrationJob {
  private pipeline: CalibrationPipeline;

  constructor(private db: DatabaseSync, config?: RuleLearningConfig) {
    ExecutionBoundary.assertPaperMode();
    this.pipeline = new CalibrationPipeline(db, config);
  }

  public async run(): Promise<CalibrationCycleResult> {
    ExecutionBoundary.assertPaperMode();
    return this.pipeline.runCalibrationCycle({
      changedBy: 'daemon_scheduled_calibration_job'
    });
  }

  public getPipeline(): CalibrationPipeline {
    return this.pipeline;
  }
}
