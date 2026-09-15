-- ==============================================================================
-- Polymarket Copy-Trading Research & Paper System
-- SQLite Schema Definition - Version 1.1.0
-- Invariant: strictly PAPER trading; no live order execution tables exist.
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. Leaderboard Scans
CREATE TABLE IF NOT EXISTS leaderboard_scans (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    scanned_at TEXT NOT NULL,
    wallet_count INTEGER NOT NULL,
    lookback_days INTEGER NOT NULL,
    raw_summary_json TEXT NOT NULL,
    provenance_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_scans_scanned_at ON leaderboard_scans(scanned_at);

-- 1b. Ingestion Operations & Data Quality Diagnostics
CREATE TABLE IF NOT EXISTS ingestion_operations (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL CHECK(operation_type IN ('leaderboard', 'wallet_activity', 'market_data', 'resolution')),
    target_identifier TEXT,
    status TEXT NOT NULL CHECK(status IN ('requested', 'running', 'completed', 'completed_with_warnings', 'failed', 'partial')),
    is_live INTEGER NOT NULL CHECK(is_live IN (0, 1)),
    provider TEXT NOT NULL,
    endpoint TEXT,
    requested_window_days INTEGER,
    actual_start_timestamp TEXT,
    actual_end_timestamp TEXT,
    records_requested INTEGER NOT NULL,
    records_received INTEGER NOT NULL,
    records_accepted INTEGER NOT NULL,
    records_rejected INTEGER NOT NULL,
    duplicates_count INTEGER NOT NULL,
    errors_count INTEGER NOT NULL,
    diagnostics_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ingestion_ops_type ON ingestion_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_ingestion_ops_status ON ingestion_operations(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_ops_created_at ON ingestion_operations(created_at);

-- 9. Immutable RuleSets (Created before dependent FKs)
CREATE TABLE IF NOT EXISTS rule_sets (
    id TEXT PRIMARY KEY,
    version TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('active', 'retired', 'candidate', 'rejected', 'superseded')),
    source_reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    effective_at TEXT NOT NULL,
    retired_at TEXT,
    config_json TEXT NOT NULL,
    parameter_metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_rule_sets_version ON rule_sets(version);
CREATE INDEX IF NOT EXISTS idx_rule_sets_status ON rule_sets(status);

-- Invariant Trigger: RuleSets parameters cannot be mutated in place
CREATE TRIGGER IF NOT EXISTS trg_prevent_ruleset_mutation
BEFORE UPDATE OF config_json, version, parameter_metadata_json ON rule_sets
BEGIN
    SELECT RAISE(FAIL, 'RuleSet immutability violation: RuleSet parameters cannot be mutated in place.');
END;

-- 2. Wallet Profiles
CREATE TABLE IF NOT EXISTS wallet_profiles (
    id TEXT PRIMARY KEY,
    address TEXT UNIQUE NOT NULL,
    label TEXT,
    source_rank INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('track', 'watch', 'ignore')),
    status_reason TEXT NOT NULL,
    roi30d REAL NOT NULL,
    consistency_score REAL NOT NULL,
    copyability_score REAL NOT NULL,
    one_hit_wonder_penalty REAL NOT NULL,
    global_score REAL NOT NULL,
    best_category TEXT NOT NULL,
    category_strengths_json TEXT NOT NULL,
    average_trade_size REAL NOT NULL,
    trade_count30d INTEGER NOT NULL,
    resolved_trade_count30d INTEGER NOT NULL,
    win_rate30d REAL NOT NULL,
    average_liquidity REAL NOT NULL,
    average_spread REAL NOT NULL,
    average_entry_timing REAL NOT NULL,
    copyability_notes TEXT NOT NULL,
    risk_notes TEXT NOT NULL,
    rule_set_id TEXT NOT NULL,
    last_scanned_at TEXT NOT NULL,
    provenance_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(rule_set_id) REFERENCES rule_sets(id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_profiles_address ON wallet_profiles(address);
CREATE INDEX IF NOT EXISTS idx_wallet_profiles_status ON wallet_profiles(status);
CREATE INDEX IF NOT EXISTS idx_wallet_profiles_global_score ON wallet_profiles(global_score DESC);

-- 3. Observed Trades
CREATE TABLE IF NOT EXISTS observed_trades (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    market_id TEXT NOT NULL,
    condition_id TEXT NOT NULL,
    market_question TEXT NOT NULL,
    market_category TEXT NOT NULL,
    outcome TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
    wallet_entry_price REAL NOT NULL,
    detected_price REAL NOT NULL,
    size REAL NOT NULL,
    source_tx_hash TEXT UNIQUE,
    source_timestamp TEXT NOT NULL,
    raw_trade_json TEXT NOT NULL,
    provenance_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_observed_trades_wallet ON observed_trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_observed_trades_market ON observed_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_observed_trades_created_at ON observed_trades(created_at);
-- Composite unique index preventing duplicate event ingestion even if source_tx_hash is null
CREATE UNIQUE INDEX IF NOT EXISTS idx_observed_trades_dedup ON observed_trades(wallet_address, market_id, outcome, side, source_timestamp);

-- Invariant Trigger: Observed trades are immutable records
CREATE TRIGGER IF NOT EXISTS trg_prevent_observed_trade_update
BEFORE UPDATE ON observed_trades
BEGIN
    SELECT RAISE(FAIL, 'ObservedTrade immutability violation: Observed trades cannot be modified.');
END;

-- 4. Market Snapshots
CREATE TABLE IF NOT EXISTS market_snapshots (
    id TEXT PRIMARY KEY,
    market_id TEXT NOT NULL,
    condition_id TEXT NOT NULL,
    question TEXT NOT NULL,
    category TEXT NOT NULL,
    yes_price REAL NOT NULL,
    no_price REAL NOT NULL,
    best_bid REAL NOT NULL,
    best_ask REAL NOT NULL,
    spread REAL NOT NULL,
    liquidity REAL NOT NULL,
    volume REAL NOT NULL,
    time_to_resolution REAL NOT NULL,
    collected_at TEXT NOT NULL,
    raw_market_json TEXT NOT NULL,
    provenance_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_market_id ON market_snapshots(market_id);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_collected_at ON market_snapshots(collected_at);

-- 5. Decision Journals (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS decision_journals (
    id TEXT PRIMARY KEY,
    observed_trade_id TEXT NOT NULL,
    market_snapshot_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    market_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK(decision IN ('paper_copy', 'watchlist', 'skip')),
    copy_score REAL NOT NULL,
    confidence REAL,
    reasons_json TEXT NOT NULL,
    risks_json TEXT NOT NULL,
    wallet_quality_score REAL NOT NULL,
    roi_score REAL NOT NULL,
    consistency_score REAL NOT NULL,
    copyability_score REAL NOT NULL,
    category_fit_score REAL NOT NULL,
    entry_timing_score REAL NOT NULL,
    spread_score REAL NOT NULL,
    liquidity_score REAL NOT NULL,
    thesis_score REAL NOT NULL,
    simulated_position_size REAL NOT NULL,
    rule_set_id TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    evaluated_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(observed_trade_id) REFERENCES observed_trades(id),
    FOREIGN KEY(market_snapshot_id) REFERENCES market_snapshots(id),
    FOREIGN KEY(rule_set_id) REFERENCES rule_sets(id)
);
CREATE INDEX IF NOT EXISTS idx_decision_journals_trade_id ON decision_journals(observed_trade_id);
CREATE INDEX IF NOT EXISTS idx_decision_journals_wallet ON decision_journals(wallet_address);
CREATE INDEX IF NOT EXISTS idx_decision_journals_decision ON decision_journals(decision);
CREATE INDEX IF NOT EXISTS idx_decision_journals_rule_set_id ON decision_journals(rule_set_id);

-- Invariant Trigger: DecisionJournal entries are immutable historical audits
CREATE TRIGGER IF NOT EXISTS trg_prevent_decision_update
BEFORE UPDATE ON decision_journals
BEGIN
    SELECT RAISE(FAIL, 'DecisionJournal immutability violation: Decisions are immutable audit artifacts.');
END;

-- 6. Paper Trades
CREATE TABLE IF NOT EXISTS paper_trades (
    id TEXT PRIMARY KEY,
    decision_journal_id TEXT NOT NULL,
    observed_trade_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    market_id TEXT NOT NULL,
    condition_id TEXT NOT NULL,
    outcome TEXT NOT NULL,
    side TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
    entry_price REAL NOT NULL,
    current_price REAL NOT NULL,
    simulated_position_size REAL NOT NULL CHECK(simulated_position_size >= 5.0 AND simulated_position_size <= 20.0),
    shares REAL NOT NULL,
    unrealized_pnl REAL NOT NULL,
    realized_pnl REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('open', 'closed', 'resolved')),
    execution_mode TEXT NOT NULL CHECK(execution_mode = 'PAPER'),
    rule_set_id TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(decision_journal_id) REFERENCES decision_journals(id),
    FOREIGN KEY(observed_trade_id) REFERENCES observed_trades(id),
    FOREIGN KEY(rule_set_id) REFERENCES rule_sets(id)
);
CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON paper_trades(status);
CREATE INDEX IF NOT EXISTS idx_paper_trades_wallet ON paper_trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_paper_trades_opened_at ON paper_trades(opened_at);

-- 7. PnL Snapshots (Hourly mark-to-market)
CREATE TABLE IF NOT EXISTS pnl_snapshots (
    id TEXT PRIMARY KEY,
    paper_trade_id TEXT NOT NULL,
    snapshot_hour TEXT NOT NULL,
    price_at_snapshot REAL NOT NULL,
    unrealized_pnl REAL NOT NULL,
    realized_pnl REAL NOT NULL,
    total_position_value REAL NOT NULL,
    captured_at TEXT NOT NULL,
    FOREIGN KEY(paper_trade_id) REFERENCES paper_trades(id)
);
CREATE INDEX IF NOT EXISTS idx_pnl_snapshots_trade_hour ON pnl_snapshots(paper_trade_id, snapshot_hour);

-- 8. Outcome Reviews
CREATE TABLE IF NOT EXISTS outcome_reviews (
    id TEXT PRIMARY KEY,
    paper_trade_id TEXT NOT NULL,
    decision_journal_id TEXT NOT NULL,
    milestone TEXT NOT NULL CHECK(milestone IN ('T+1h', 'T+6h', 'T+24h', 'resolution')),
    price_at_milestone REAL NOT NULL,
    simulated_pnl_at_milestone REAL NOT NULL,
    final_outcome TEXT,
    was_decision_good INTEGER NOT NULL CHECK(was_decision_good IN (0, 1)),
    decision_quality_score REAL NOT NULL,
    timing_quality_score REAL NOT NULL,
    spread_liquidity_impact REAL NOT NULL,
    lessons_json TEXT NOT NULL,
    rule_set_id TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(paper_trade_id) REFERENCES paper_trades(id),
    FOREIGN KEY(decision_journal_id) REFERENCES decision_journals(id),
    FOREIGN KEY(rule_set_id) REFERENCES rule_sets(id)
);
CREATE INDEX IF NOT EXISTS idx_outcome_reviews_paper_trade ON outcome_reviews(paper_trade_id);
CREATE INDEX IF NOT EXISTS idx_outcome_reviews_milestone ON outcome_reviews(milestone);

-- 10. Rule Change Audit Trail
CREATE TABLE IF NOT EXISTS rule_changes (
    id TEXT PRIMARY KEY,
    old_rule_set_id TEXT NOT NULL,
    new_rule_set_id TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    evidence_summary TEXT NOT NULL,
    before_json TEXT NOT NULL,
    after_json TEXT NOT NULL,
    expected_improvement TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(old_rule_set_id) REFERENCES rule_sets(id),
    FOREIGN KEY(new_rule_set_id) REFERENCES rule_sets(id)
);
CREATE INDEX IF NOT EXISTS idx_rule_changes_timestamp ON rule_changes(timestamp);

-- 11. Daily Reports
CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY,
    report_date TEXT UNIQUE NOT NULL,
    paper_pnl_today REAL NOT NULL,
    total_paper_pnl REAL NOT NULL,
    win_rate REAL NOT NULL,
    best_paper_trade_id TEXT,
    worst_paper_trade_id TEXT,
    best_wallet_today TEXT,
    trades_copied_count INTEGER NOT NULL,
    trades_watched_count INTEGER NOT NULL,
    trades_skipped_count INTEGER NOT NULL,
    active_rule_version TEXT NOT NULL,
    summary_notes TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);

-- 12. Wallet Research Evaluations (Immutable historical evaluations across RuleSets and windows)
CREATE TABLE IF NOT EXISTS wallet_evaluations (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    rule_set_id TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    analysis_window_days INTEGER NOT NULL,
    window_start_timestamp TEXT,
    window_end_timestamp TEXT,
    global_rank INTEGER NOT NULL,
    category_rank INTEGER NOT NULL,
    best_category TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('track', 'watch', 'ignore')),
    status_reasons_json TEXT NOT NULL,
    final_score REAL NOT NULL,
    raw_composite_score REAL NOT NULL,
    total_penalty_deduction REAL NOT NULL,
    roi_provenance_json TEXT NOT NULL,
    data_completeness_json TEXT NOT NULL,
    one_hit_wonder_json TEXT NOT NULL,
    frequency_metrics_json TEXT NOT NULL,
    copyability_factors_json TEXT NOT NULL,
    factor_results_json TEXT NOT NULL,
    penalties_json TEXT NOT NULL,
    evaluated_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(wallet_address) REFERENCES wallet_profiles(address),
    FOREIGN KEY(rule_set_id) REFERENCES rule_sets(id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_evaluations_address ON wallet_evaluations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_evaluations_ruleset ON wallet_evaluations(rule_set_id);
CREATE INDEX IF NOT EXISTS idx_wallet_evaluations_global_rank ON wallet_evaluations(global_rank);
CREATE INDEX IF NOT EXISTS idx_wallet_evaluations_status ON wallet_evaluations(status);

-- Invariant Trigger: Wallet research evaluations are immutable historical records
CREATE TRIGGER IF NOT EXISTS trg_prevent_wallet_evaluation_update
BEFORE UPDATE ON wallet_evaluations
BEGIN
    SELECT RAISE(FAIL, 'WalletEvaluation immutability violation: Evaluations are immutable historical records.');
END;

-- 13. Historical Copy Evaluations (Task 1.5 - Trade-Level Realistic Copyability Research)
CREATE TABLE IF NOT EXISTS historical_copy_evaluations (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    observed_trade_id TEXT NOT NULL,
    market_id TEXT NOT NULL,
    timeline_json TEXT NOT NULL,
    wallet_entry_price REAL NOT NULL,
    wallet_entry_size REAL NOT NULL,
    wallet_entry_timestamp TEXT NOT NULL,
    observed_price REAL,
    observed_timestamp TEXT,
    modeled_copy_price REAL,
    modeled_copy_timestamp TEXT,
    fill_model TEXT NOT NULL CHECK(fill_model IN ('EXACT_OBSERVED', 'TOP_OF_BOOK', 'MIDPOINT', 'STALE_SNAPSHOT', 'UNAVAILABLE')),
    spread_at_entry REAL,
    spread_at_observation REAL,
    spread_at_copy REAL,
    liquidity_at_entry REAL,
    liquidity_at_observation REAL,
    liquidity_at_copy REAL,
    relative_trade_size_to_depth REAL,
    price_drift REAL,
    adverse_drift REAL,
    latency_seconds REAL,
    wallet_outcome TEXT CHECK(wallet_outcome IN ('WIN', 'LOSS', 'UNRESOLVED') OR wallet_outcome IS NULL),
    wallet_pnl REAL,
    modeled_copy_outcome TEXT CHECK(modeled_copy_outcome IN ('WIN', 'LOSS', 'UNRESOLVED') OR modeled_copy_outcome IS NULL),
    modeled_copy_pnl REAL,
    copy_pnl_delta REAL,
    classification TEXT NOT NULL CHECK(classification IN ('COPYABLE', 'DIFFICULT', 'UNFOLLOWABLE', 'INSUFFICIENT_DATA')),
    cohort TEXT NOT NULL CHECK(cohort IN ('GOOD_COPY', 'BAD_COPY', 'MISSED_WINNER', 'AVOIDED_LOSER', 'INSUFFICIENT_DATA')),
    reason_codes_json TEXT NOT NULL,
    analysis_window TEXT NOT NULL,
    rule_set_id TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    normalization_version TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    dataset_version TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    provenance_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(observed_trade_id) REFERENCES observed_trades(id),
    FOREIGN KEY(wallet_address) REFERENCES wallet_profiles(address),
    FOREIGN KEY(rule_set_id) REFERENCES rule_sets(id)
);
CREATE INDEX IF NOT EXISTS idx_hist_copy_wallet ON historical_copy_evaluations(wallet_address);
CREATE INDEX IF NOT EXISTS idx_hist_copy_trade ON historical_copy_evaluations(observed_trade_id);
CREATE INDEX IF NOT EXISTS idx_hist_copy_market ON historical_copy_evaluations(market_id);
CREATE INDEX IF NOT EXISTS idx_hist_copy_classification ON historical_copy_evaluations(classification);
CREATE INDEX IF NOT EXISTS idx_hist_copy_cohort ON historical_copy_evaluations(cohort);
CREATE INDEX IF NOT EXISTS idx_hist_copy_ruleset ON historical_copy_evaluations(rule_set_id);
CREATE INDEX IF NOT EXISTS idx_hist_copy_window ON historical_copy_evaluations(analysis_window);

-- Invariant Trigger: Historical copy evaluations are immutable research records
CREATE TRIGGER IF NOT EXISTS trg_prevent_hist_copy_eval_update
BEFORE UPDATE ON historical_copy_evaluations
BEGIN
    SELECT RAISE(FAIL, 'HistoricalCopyEvaluation immutability violation: Historical copy evaluations are immutable.');
END;

-- 14. Detected Trade Events (Task 1.6 - Real-Time Wallet Trade Monitoring)
CREATE TABLE IF NOT EXISTS detected_trade_events (
    id TEXT PRIMARY KEY,
    observed_trade_id TEXT UNIQUE NOT NULL,
    wallet_address TEXT NOT NULL,
    market_id TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    source_timestamp TEXT NOT NULL,
    detection_latency_ms INTEGER NOT NULL,
    data_source TEXT NOT NULL,
    normalization_version TEXT NOT NULL,
    processed INTEGER NOT NULL CHECK(processed IN (0, 1)),
    created_at TEXT NOT NULL,
    FOREIGN KEY(observed_trade_id) REFERENCES observed_trades(id),
    FOREIGN KEY(wallet_address) REFERENCES wallet_profiles(address)
);
CREATE INDEX IF NOT EXISTS idx_detected_trades_wallet ON detected_trade_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_detected_trades_market ON detected_trade_events(market_id);
CREATE INDEX IF NOT EXISTS idx_detected_trades_detected_at ON detected_trade_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_detected_trades_processed ON detected_trade_events(processed);

-- Invariant Trigger: Detected trade events are immutable detection audit records
CREATE TRIGGER IF NOT EXISTS trg_prevent_detected_trade_update
BEFORE UPDATE OF observed_trade_id, wallet_address, market_id, detected_at, source_timestamp, detection_latency_ms ON detected_trade_events
BEGIN
    SELECT RAISE(FAIL, 'DetectedTradeEvent immutability violation: Detection audit fields cannot be modified.');
END;

-- Invariant Idempotency Unique Indexes (1 Observed Trade = 1 Decision = at most 1 Paper Trade)
CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_journals_trade_id_uniq ON decision_journals(observed_trade_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_paper_trades_observed_trade_uniq ON paper_trades(observed_trade_id);

-- 15. Runtime Daemon Singleton State (Task 2.0 - Persistent Paper-Trading Runtime)
CREATE TABLE IF NOT EXISTS runtime_state (
    id TEXT PRIMARY KEY,
    lifecycle_state TEXT NOT NULL CHECK(lifecycle_state IN ('STOPPED', 'STARTING', 'RUNNING', 'STOPPING', 'ERROR', 'UNKNOWN')),
    started_at TEXT,
    stopped_at TEXT,
    last_heartbeat_at TEXT,
    last_successful_cycle_at TEXT,
    cycle_count INTEGER NOT NULL DEFAULT 0,
    active_jobs_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_error_at TEXT,
    last_error_job TEXT,
    telemetry_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
);

-- 16. Runtime Historical Telemetry Snapshots
CREATE TABLE IF NOT EXISTS runtime_telemetry (
    id TEXT PRIMARY KEY,
    lifecycle_state TEXT NOT NULL,
    cycle_count INTEGER NOT NULL,
    active_jobs_count INTEGER NOT NULL,
    tracked_wallets_count INTEGER NOT NULL,
    open_paper_trades_count INTEGER NOT NULL,
    total_paper_trades_count INTEGER NOT NULL,
    unrealized_pnl REAL NOT NULL,
    realized_pnl REAL NOT NULL,
    total_pnl REAL NOT NULL,
    last_successful_cycle TEXT,
    last_leaderboard_scan TEXT,
    last_wallet_scan TEXT,
    last_trade_observation TEXT,
    last_pnl_update TEXT,
    last_outcome_review TEXT,
    last_daily_report TEXT,
    ingestion_health TEXT NOT NULL,
    market_freshness TEXT NOT NULL,
    last_error TEXT,
    last_error_job TEXT,
    telemetry_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runtime_telemetry_created_at ON runtime_telemetry(created_at);
CREATE INDEX IF NOT EXISTS idx_runtime_telemetry_state ON runtime_telemetry(lifecycle_state);

-- 17. Learning Events (Task 2.1 - Empirical Calibration & Controlled Rule Learning)
CREATE TABLE IF NOT EXISTS learning_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    input_ruleset_id TEXT NOT NULL,
    candidate_ruleset_id TEXT,
    output_ruleset_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('PROMOTED', 'REJECTED', 'INSUFFICIENT_DATA', 'NO_CHANGES_NEEDED')),
    calibration_window_start TEXT NOT NULL,
    calibration_window_end TEXT NOT NULL,
    train_window_start TEXT NOT NULL,
    train_window_end TEXT NOT NULL,
    validation_window_start TEXT NOT NULL,
    validation_window_end TEXT NOT NULL,
    observations_count INTEGER NOT NULL,
    excluded_observations_count INTEGER NOT NULL,
    exclusions_json TEXT NOT NULL,
    cohort_metrics_json TEXT NOT NULL,
    proposed_changes_json TEXT NOT NULL,
    accepted_changes_json TEXT NOT NULL,
    rejected_changes_json TEXT NOT NULL,
    evidence_tier TEXT NOT NULL CHECK(evidence_tier IN ('INSUFFICIENT', 'WEAK', 'MODERATE', 'STRONG')),
    reason TEXT NOT NULL,
    expected_improvement TEXT NOT NULL,
    validation_result_json TEXT,
    provenance_json TEXT NOT NULL,
    config_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(input_ruleset_id) REFERENCES rule_sets(id),
    FOREIGN KEY(candidate_ruleset_id) REFERENCES rule_sets(id),
    FOREIGN KEY(output_ruleset_id) REFERENCES rule_sets(id)
);
CREATE INDEX IF NOT EXISTS idx_learning_events_timestamp ON learning_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_learning_events_status ON learning_events(status);
CREATE INDEX IF NOT EXISTS idx_learning_events_input_ruleset ON learning_events(input_ruleset_id);



