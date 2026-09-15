/**
 * Deterministic Interval Scheduler for Autonomous Operator Pipeline (Task 2.0).
 * 
 * Safety Guarantee:
 * - Strictly prevents duplicate/overlapping executions of the same job.
 * - Handles exceptions without crashing the scheduler loop.
 * - Tracks execution timestamps, durations, and health status for each job.
 */

import { RuntimeJobName, RuntimeJobExecutionRecord, EngineLifecycleState } from '../types/domain.js';
import { RuntimeLogger } from './runtime-logger.js';

export interface ScheduledJobDef {
  name: RuntimeJobName;
  intervalMs: number;
  runImmediately?: boolean;
  execute: () => Promise<void>;
}

export class RuntimeScheduler {
  private jobs: Map<RuntimeJobName, ScheduledJobDef> = new Map();
  private records: Map<RuntimeJobName, RuntimeJobExecutionRecord> = new Map();
  private timers: Map<RuntimeJobName, NodeJS.Timeout> = new Map();
  private isRunning = false;

  constructor(private getLifecycleState: () => EngineLifecycleState) {}

  /**
   * Registers a job with its interval and async worker function.
   */
  public registerJob(def: ScheduledJobDef): void {
    this.jobs.set(def.name, def);
    if (!this.records.has(def.name)) {
      this.records.set(def.name, {
        jobName: def.name,
        lastStartedAt: null,
        lastCompletedAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        consecutiveFailures: 0,
        totalExecutions: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        isRunning: false
      });
    }
  }

  /**
   * Starts all registered jobs on their respective interval timers.
   */
  public startAll(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    for (const [name, def] of this.jobs.entries()) {
      if (def.runImmediately) {
        // Trigger initial execution asynchronously
        this.executeJob(name).catch(() => {});
      }

      const timer = setInterval(() => {
        this.executeJob(name).catch(() => {});
      }, def.intervalMs);

      this.timers.set(name, timer);
    }
  }

  /**
   * Stops all active intervals and awaits running tasks up to timeout.
   */
  public async stopAll(timeoutMs = 5000): Promise<void> {
    this.isRunning = false;

    // Clear all interval timers
    for (const [, timer] of this.timers.entries()) {
      clearInterval(timer);
    }
    this.timers.clear();

    // Wait for any in-flight jobs to complete
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const anyRunning = Array.from(this.records.values()).some(r => r.isRunning);
      if (!anyRunning) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Executes a single job deterministically with concurrency and error protection.
   */
  public async executeJob(name: RuntimeJobName): Promise<boolean> {
    const job = this.jobs.get(name);
    const record = this.records.get(name);
    if (!job || !record) return false;

    // Concurrency Protection: Avoid overlapping executions of the same job
    if (record.isRunning) {
      RuntimeLogger.warn(this.getLifecycleState(), name, `Skipping scheduled tick: job ${name} is already executing.`);
      return false;
    }

    record.isRunning = true;
    record.lastStartedAt = new Date().toISOString();
    record.totalExecutions++;
    const startMs = Date.now();

    try {
      await job.execute();
      const durationMs = Date.now() - startMs;
      const completedAt = new Date().toISOString();

      record.lastCompletedAt = completedAt;
      record.lastSuccessAt = completedAt;
      record.consecutiveFailures = 0;
      record.totalSuccesses++;
      record.lastErrorMessage = null;

      RuntimeLogger.info(this.getLifecycleState(), name, `Job ${name} completed successfully`, { durationMs });
      return true;
    } catch (err: unknown) {
      const durationMs = Date.now() - startMs;
      const errorAt = new Date().toISOString();
      const errorMsg = err instanceof Error ? err.message : String(err);

      record.lastCompletedAt = errorAt;
      record.lastErrorAt = errorAt;
      record.lastErrorMessage = errorMsg;
      record.consecutiveFailures++;
      record.totalFailures++;

      RuntimeLogger.error(this.getLifecycleState(), name, `Job ${name} failed: ${errorMsg}`, err, { durationMs });
      return false;
    } finally {
      record.isRunning = false;
    }
  }

  /**
   * Returns copy of job records.
   */
  public getJobRecords(): RuntimeJobExecutionRecord[] {
    return Array.from(this.records.values()).map(r => ({ ...r }));
  }

  /**
   * Returns a specific job record.
   */
  public getJobRecord(name: RuntimeJobName): RuntimeJobExecutionRecord | undefined {
    const r = this.records.get(name);
    return r ? { ...r } : undefined;
  }

  /**
   * Returns count of currently active in-flight jobs.
   */
  public getActiveJobsCount(): number {
    return Array.from(this.records.values()).filter(r => r.isRunning).length;
  }
}
