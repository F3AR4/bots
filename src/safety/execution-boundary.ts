/**
 * Execution Boundary & Safety Invariants.
 * 
 * HARD SAFETY BOUNDARY: PAPER ONLY.
 * 
 * Enforces:
 * 1. ExecutionMode is permanently locked to PAPER in this version.
 * 2. SHADOW / FUTURE_PRODUCTION modes throw hard invariant exceptions.
 * 3. Any attempt to invoke live signing, fund approval, or order submission throws an invariant error.
 * 4. Zero storage or parsing of private keys or mnemonics.
 */

import { ExecutionMode } from '../types/domain.js';

export class SafetyViolationError extends Error {
  constructor(message: string) {
    super(`[CRITICAL SAFETY VIOLATION] ${message}`);
    this.name = 'SafetyViolationError';
  }
}

export class ExecutionBoundary {
  private static readonly CURRENT_MODE: ExecutionMode = 'PAPER';

  /**
   * Asserts that current runtime is strictly PAPER mode.
   */
  public static assertPaperMode(): void {
    if (this.CURRENT_MODE !== 'PAPER') {
      throw new SafetyViolationError(`System execution mode is ${this.CURRENT_MODE}, but only PAPER is authorized.`);
    }
  }

  /**
   * Blocks any attempt to initialize or switch to a non-paper execution mode.
   */
  public static validateExecutionMode(mode: ExecutionMode): void {
    if (mode !== 'PAPER') {
      throw new SafetyViolationError(
        `ExecutionMode '${mode}' is permanently disabled in Version 1. No live orders, private keys, or wallet signing are supported.`
      );
    }
  }

  /**
   * Barrier guarding against live transaction signing.
   */
  public static preventLiveSigning(): never {
    throw new SafetyViolationError('Live transaction signing is strictly forbidden. The system operates in PAPER mode only.');
  }

  /**
   * Barrier guarding against live order execution endpoints.
   */
  public static preventLiveOrderExecution(): never {
    throw new SafetyViolationError('Live exchange order execution is strictly forbidden. The system operates in PAPER mode only.');
  }

  /**
   * Barrier guarding against token spending approvals.
   */
  public static preventTokenApproval(): never {
    throw new SafetyViolationError('Token spending approval is strictly forbidden. The system operates in PAPER mode only.');
  }

  /**
   * Barrier guarding against private key ingestion.
   */
  public static rejectPrivateKeyInput(potentialSecret: string): void {
    const hexKeyPattern = /^(0x)?[0-9a-fA-F]{64}$/;
    if (hexKeyPattern.test(potentialSecret.trim())) {
      throw new SafetyViolationError('Ingestion of private keys is strictly forbidden by system invariants.');
    }
  }
}
