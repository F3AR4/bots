/**
 * Structured & Sanitized Runtime Logger (Task 2.0).
 * 
 * Safety Guarantee:
 * - Sanitizes private keys, authorization tokens, and secrets.
 * - Formats timestamps, job name, severity, duration, and entities for 24h/48h operational diagnostics.
 */

import { SecretSanitizer } from '../safety/secret-sanitizer.js';
import { EngineLifecycleState, RuntimeJobName } from '../types/domain.js';

export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLogEvent {
  timestamp: string;
  severity: LogSeverity;
  lifecycleState: EngineLifecycleState;
  job?: RuntimeJobName | string;
  message: string;
  durationMs?: number;
  entityId?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export class RuntimeLogger {
  private static sanitize(obj: any): any {
    try {
      return SecretSanitizer.sanitizeObject(obj);
    } catch {
      return obj;
    }
  }

  public static log(event: StructuredLogEvent): void {
    const sanitizedData = event.data ? this.sanitize(event.data) : undefined;
    const sanitizedError = event.error ? SecretSanitizer.sanitize(event.error) : undefined;
    const sanitizedMessage = SecretSanitizer.sanitize(event.message);

    const logEntry = {
      ...event,
      message: sanitizedMessage,
      error: sanitizedError,
      data: sanitizedData
    };

    const prefix = `[${event.timestamp}] [${event.severity.padEnd(5)}] [${event.lifecycleState}]${event.job ? ` [${event.job}]` : ''}`;
    const duration = event.durationMs !== undefined ? ` (${event.durationMs}ms)` : '';
    const entity = event.entityId ? ` [entity:${event.entityId}]` : '';

    if (event.severity === 'ERROR') {
      console.error(`${prefix} ${sanitizedMessage}${duration}${entity}${sanitizedError ? ` | Error: ${sanitizedError}` : ''}`);
    } else if (event.severity === 'WARN') {
      console.warn(`${prefix} ${sanitizedMessage}${duration}${entity}`);
    } else {
      console.log(`${prefix} ${sanitizedMessage}${duration}${entity}`);
    }
  }

  public static info(lifecycleState: EngineLifecycleState, job: RuntimeJobName | string, message: string, data?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      severity: 'INFO',
      lifecycleState,
      job,
      message,
      data
    });
  }

  public static warn(lifecycleState: EngineLifecycleState, job: RuntimeJobName | string, message: string, data?: Record<string, unknown>): void {
    this.log({
      timestamp: new Date().toISOString(),
      severity: 'WARN',
      lifecycleState,
      job,
      message,
      data
    });
  }

  public static error(lifecycleState: EngineLifecycleState, job: RuntimeJobName | string, message: string, error?: unknown, data?: Record<string, unknown>): void {
    const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
    this.log({
      timestamp: new Date().toISOString(),
      severity: 'ERROR',
      lifecycleState,
      job,
      message,
      error: errorMsg,
      data
    });
  }
}
