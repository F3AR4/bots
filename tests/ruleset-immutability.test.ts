/**
 * Test Suite C & N: RuleSet Immutability, Audit Trail, and Version Mismatch Protection.
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { DEFAULT_RULESET } from '../src/config/ruleset.default.js';
import { LearningBoundary, ParameterProposal } from '../src/core/learning-boundary.js';
import { SafetyViolationError } from '../src/safety/execution-boundary.js';

describe('RuleSet Immutability & Adaptation Guardrails', () => {
  test('RuleSet configuration cannot be mutated in place; produces new version', () => {
    const proposals: ParameterProposal[] = [
      {
        paramKey: 'maxAllowedSpread',
        newValue: 0.035, // Tighten spread from 0.04 to 0.035
        reason: 'Empirical review indicates spread drag on 4c spreads',
        evidence: 'Last 15 trades with spread > 3.5c lost an aggregate of -$24.50',
        expectedImprovement: 'Improve win rate by 4.2%'
      }
    ];

    const { newRuleSet, ruleChange } = LearningBoundary.proposeAndActivateRuleChange(
      DEFAULT_RULESET,
      proposals,
      'operator_learning_engine'
    );

    // Assert parent remains untouched
    assert.strictEqual(DEFAULT_RULESET.config.maxAllowedSpread, 0.04);
    assert.strictEqual(DEFAULT_RULESET.version, '1.0.0');

    // Assert new version spawned
    assert.strictEqual(newRuleSet.config.maxAllowedSpread, 0.035);
    assert.strictEqual(newRuleSet.version, '1.1.0');
    assert.notStrictEqual(newRuleSet.id, DEFAULT_RULESET.id);

    // Assert complete audit record
    assert.strictEqual(ruleChange.oldRuleSetId, DEFAULT_RULESET.id);
    assert.strictEqual(ruleChange.newRuleSetId, newRuleSet.id);
    assert.strictEqual(ruleChange.changedBy, 'operator_learning_engine');
    assert.ok(ruleChange.beforeJson.includes('0.04'));
    assert.ok(ruleChange.afterJson.includes('0.035'));
  });

  test('Guardrails reject parameter proposals outside invariant envelope', () => {
    // Attempt to propose spread wider than max guardrail (0.060)
    const illegalSpreadProposal: ParameterProposal[] = [
      {
        paramKey: 'maxAllowedSpread',
        newValue: 0.08, // Exceeds 0.060 limit
        reason: 'Accept wider spreads',
        evidence: 'None',
        expectedImprovement: 'None'
      }
    ];

    assert.throws(
      () => LearningBoundary.proposeAndActivateRuleChange(DEFAULT_RULESET, illegalSpreadProposal, 'operator'),
      SafetyViolationError
    );

    // Attempt to propose bet size outside [$5.00, $20.00]
    const illegalBetProposal: ParameterProposal[] = [
      {
        paramKey: 'simulatedBetMax',
        newValue: 50.0, // Exceeds explicit $20.00 ceiling
        reason: 'Increase simulated bets',
        evidence: 'None',
        expectedImprovement: 'None'
      }
    ];

    assert.throws(
      () => LearningBoundary.proposeAndActivateRuleChange(DEFAULT_RULESET, illegalBetProposal, 'operator'),
      SafetyViolationError
    );
  });
});
