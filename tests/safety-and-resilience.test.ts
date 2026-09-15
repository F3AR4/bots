/**
 * Test Suite J & K: Safety Invariants, Live Barriers, and External Failure Resilience.
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { ExecutionBoundary, SafetyViolationError } from '../src/safety/execution-boundary.js';
import { SecretSanitizer } from '../src/safety/secret-sanitizer.js';
import { FixtureLeaderboardAdapter } from '../src/adapters/leaderboard.adapter.js';
import { FixtureWalletActivityAdapter } from '../src/adapters/wallet-activity.adapter.js';
import { FixtureMarketDataAdapter } from '../src/adapters/market-data.adapter.js';
import { StructuredAdapterError } from '../src/types/adapters.js';

describe('Safety Invariants & Adversarial Failure Tests', () => {
  test('Safety Barrier: Non-PAPER modes throw hard safety violation error', () => {
    assert.throws(() => ExecutionBoundary.validateExecutionMode('SHADOW'), SafetyViolationError);
    assert.throws(() => ExecutionBoundary.validateExecutionMode('FUTURE_PRODUCTION'), SafetyViolationError);
  });

  test('Safety Barrier: Live signing and order execution attempts are unconditionally blocked', () => {
    assert.throws(() => ExecutionBoundary.preventLiveSigning(), SafetyViolationError);
    assert.throws(() => ExecutionBoundary.preventLiveOrderExecution(), SafetyViolationError);
    assert.throws(() => ExecutionBoundary.preventTokenApproval(), SafetyViolationError);
  });

  test('Safety Barrier: Private key ingestion is intercepted and rejected', () => {
    const rawPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    assert.throws(() => ExecutionBoundary.rejectPrivateKeyInput(rawPrivateKey), SafetyViolationError);
  });

  test('Observability: Secrets and API keys are redacted from logs and serialized payloads', () => {
    const logMessage = 'User connected with key=secretApiKey12345678 and Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
    const sanitized = SecretSanitizer.sanitize(logMessage);

    assert.ok(!sanitized.includes('secretApiKey12345678'));
    assert.ok(sanitized.includes('[REDACTED_SECRET]'));
  });

  test('Adversarial Resilience: Adapter network failures return structured errors without data fabrication', async () => {
    // 1. Leaderboard failure
    const failingLeaderboard = new FixtureLeaderboardAdapter([], true);
    await assert.rejects(
      async () => failingLeaderboard.fetchLeaderboard(),
      (err: StructuredAdapterError) => {
        assert.strictEqual(err.errorCode, 'API_TIMEOUT');
        assert.strictEqual(err.provider, 'fixture_leaderboard');
        return true;
      }
    );

    // 2. Wallet activity failure
    const failingWalletAdapter = new FixtureWalletActivityAdapter(new Map(), [], true);
    await assert.rejects(
      async () => failingWalletAdapter.fetchHistoricalActivity('0xwallet_test'),
      (err: StructuredAdapterError) => {
        assert.strictEqual(err.errorCode, 'NETWORK_ERROR');
        return true;
      }
    );

    // 3. Market snapshot failure
    const failingMarketAdapter = new FixtureMarketDataAdapter(new Map(), true);
    await assert.rejects(
      async () => failingMarketAdapter.fetchMarketSnapshot('mkt-missing'),
      (err: StructuredAdapterError) => {
        assert.strictEqual(err.errorCode, 'NETWORK_ERROR');
        return true;
      }
    );
  });
});
