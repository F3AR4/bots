package com.example.botsapp.network

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// ============================================================
// API Data Models — matching backend JSON contracts exactly.
// These are read-only DTOs. No strategy mutation, no signing,
// no private keys, no live execution capability.
// ============================================================

// --- Control Status ---
@JsonClass(generateAdapter = true)
data class ControlStatusResponse(
    val lifecycleState: String = "UNKNOWN",
    val executionMode: String = "PAPER ONLY",
    val telemetry: RuntimeTelemetry? = null,
    val timestamp: String = ""
)

@JsonClass(generateAdapter = true)
data class RuntimeTelemetry(
    val uptimeSeconds: Long = 0,
    val lastCycleAt: String? = null,
    val totalCycles: Long = 0,
    val lastHeartbeat: String? = null,
    val schedulerHealth: String? = null,
    val activeJobs: List<String> = emptyList(),
    val errors: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class ControlActionResponse(
    val success: Boolean = false,
    val state: String = "UNKNOWN",
    val message: String = "",
    val executionMode: String = "PAPER ONLY",
    val timestamp: String = ""
)

// --- System Status ---
@JsonClass(generateAdapter = true)
data class SystemStatusResponse(
    val status: String = "UNKNOWN",
    val executionMode: String = "PAPER",
    val safetyNotice: String = "",
    val dataMode: String = "NO DATA",
    val ingestionStatus: IngestionStatusBrief? = null,
    val walletMonitorStatus: WalletMonitorStatusBrief? = null,
    val marketDataFreshness: MarketFreshness? = null,
    val activeRuleVersion: String? = null,
    val trackedWalletsCount: Int = 0,
    val openPaperTradesCount: Int = 0,
    val totalPaperTradesCount: Int = 0,
    val currentPnl: PnlSummary? = null,
    val totalUnrealizedPnl: Double = 0.0,
    val latestSignal: LatestSignalBrief? = null,
    val latestDecision: LatestDecisionBrief? = null,
    val lastSuccessfulIngestion: String? = null,
    val lastError: String? = null,
    val timestamp: String = ""
)

@JsonClass(generateAdapter = true)
data class IngestionStatusBrief(
    val health: String = "IDLE",
    val lastIngestionTime: String? = null,
    val dataMode: String = "NO DATA"
)

@JsonClass(generateAdapter = true)
data class WalletMonitorStatusBrief(
    val status: String = "IDLE",
    val executionMode: String = "PAPER",
    val marketDataFreshness: String? = null
)

@JsonClass(generateAdapter = true)
data class MarketFreshness(
    val lastSnapshotTime: String? = null,
    val ageSeconds: Long? = null,
    val freshnessLabel: String = "NO DATA"
)

@JsonClass(generateAdapter = true)
data class PnlSummary(
    val unrealizedPnl: Double = 0.0,
    val realizedPnl: Double = 0.0,
    val totalPnl: Double = 0.0
)

@JsonClass(generateAdapter = true)
data class LatestSignalBrief(
    val id: String = "",
    val decision: String = "",
    val marketId: String = "",
    val walletAddress: String = "",
    val finalScore: Double = 0.0,
    val timestamp: String? = null
)

@JsonClass(generateAdapter = true)
data class LatestDecisionBrief(
    val id: String = "",
    val decision: String = "",
    val marketId: String = "",
    val walletAddress: String = "",
    val copyScore: Double = 0.0,
    val evaluatedAt: String? = null
)

// --- Monitor Status (observability) ---
@JsonClass(generateAdapter = true)
data class MonitorStatusResponse(
    val walletMonitorStatus: String = "IDLE",
    val paperEngineStatus: String = "STOPPED",
    val engineLifecycleState: String = "UNKNOWN",
    val ingestionStatus: String? = null,
    val executionMode: String = "PAPER",
    val marketDataFreshness: String? = null,
    val activeTrackedWallets: Int = 0,
    val lastPollAt: String? = null,
    val lastErrorMessage: String? = null,
    val observability: Observability? = null
)

@JsonClass(generateAdapter = true)
data class Observability(
    val monitorProcessStatus: String = "IDLE",
    val engineLifecycleState: String = "UNKNOWN",
    val lastSuccessfulMonitoringCycle: String? = null,
    val lastSuccessfulLeaderboardScan: String? = null,
    val lastSuccessfulWalletScan: String? = null,
    val lastSuccessfulTradeObservation: String? = null,
    val lastSuccessfulPnlUpdate: String? = null,
    val lastSuccessfulOutcomeReview: String? = null,
    val lastError: String? = null,
    val lastErrorTimestamp: String? = null,
    val currentDataFreshness: String? = null,
    val trackedWalletCount: Int = 0,
    val currentPaperTradeCount: Int = 0,
    val currentPaperPnl: PnlSummary? = null,
    val ingestionProviderHealth: String = "IDLE",
    val currentRuleSetId: String? = null,
    val executionMode: String = "PAPER ONLY"
)

// --- Paper Trades ---
@JsonClass(generateAdapter = true)
data class PaperTradesResponse(
    val paperTrades: List<PaperTrade> = emptyList(),
    val totalTrades: Int = 0,
    val totalPnl: Double = 0.0,
    val executionMode: String = "PAPER"
)

@JsonClass(generateAdapter = true)
data class PaperTrade(
    val id: String = "",
    val decisionJournalId: String = "",
    val walletAddress: String = "",
    val marketId: String = "",
    val marketQuestion: String = "",
    val outcome: String = "",
    val entryPrice: Double = 0.0,
    val currentPrice: Double = 0.0,
    val simulatedSize: Double = 0.0,
    val status: String = "open",
    val unrealizedPnl: Double = 0.0,
    val realizedPnl: Double = 0.0,
    val ruleSetId: String = "",
    val ruleSetVersion: String = "",
    val createdAt: String = "",
    val updatedAt: String = "",
    val closedAt: String? = null
)

// --- Signals ---
@JsonClass(generateAdapter = true)
data class SignalsResponse(
    val signals: List<Signal> = emptyList(),
    val total: Int = 0
)

@JsonClass(generateAdapter = true)
data class Signal(
    val id: String = "",
    val walletAddress: String = "",
    val marketId: String = "",
    val marketQuestion: String? = null,
    val outcome: String? = null,
    val entryPrice: Double = 0.0,
    val currentPrice: Double = 0.0,
    val spread: Double = 0.0,
    val liquidity: Double = 0.0,
    val finalScore: Double = 0.0,
    val decision: String = "",
    val provenance: String = "",
    val detectedAt: String = "",
    val walletScore: Double = 0.0,
    val spreadScore: Double = 0.0,
    val liquidityScore: Double = 0.0,
    val consistencyScore: Double = 0.0,
    val entryTimingScore: Double = 0.0
)

// --- Wallets ---
@JsonClass(generateAdapter = true)
data class WalletsResponse(
    val wallets: List<Wallet> = emptyList(),
    val evaluations: List<WalletEvaluation> = emptyList(),
    val total: Int = 0
)

@JsonClass(generateAdapter = true)
data class Wallet(
    val address: String = "",
    val status: String = "discovered",
    val globalScore: Double = 0.0,
    val bestCategory: String = "",
    val totalTrades: Int = 0,
    val winRate: Double = 0.0,
    val profitLoss: Double = 0.0,
    val rank: Int = 0,
    val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class WalletEvaluation(
    val id: String = "",
    val walletAddress: String = "",
    val globalScore: Double = 0.0,
    val bestCategory: String = "",
    val categoryEdge: Double = 0.0,
    val copyability: Double = 0.0,
    val consistency: Double = 0.0,
    val liquidityQuality: Double = 0.0,
    val oneHitPenalty: Double = 0.0,
    val dataCompleteness: Double = 0.0,
    val evaluatedAt: String = ""
)

// --- Performance ---
@JsonClass(generateAdapter = true)
data class PerformanceResponse(
    val dataMode: String = "NO DATA",
    val executionMode: String = "PAPER",
    val safetyNotice: String = "",
    val metrics: PerformanceMetrics? = null,
    val decisionsSummary: DecisionsSummary? = null,
    val benchmarkCohorts: Map<String, CohortData>? = null,
    val cohortDataStatus: String = "INSUFFICIENT DATA",
    val cohortDataReason: String? = null,
    val historicalResearchBenchmark: HistoricalBenchmark? = null,
    val recentPaperTrades: List<PaperTrade> = emptyList()
)

@JsonClass(generateAdapter = true)
data class PerformanceMetrics(
    val totalPaperTrades: Int = 0,
    val openPaperTrades: Int = 0,
    val closedPaperTrades: Int = 0,
    val realizedPnl: Double = 0.0,
    val unrealizedPnl: Double = 0.0,
    val totalPnl: Double = 0.0,
    val wins: Int = 0,
    val losses: Int = 0,
    val winRate: Double? = null,
    val winRateStatus: String = "INSUFFICIENT DATA",
    val winRateReason: String? = null
)

@JsonClass(generateAdapter = true)
data class DecisionsSummary(
    val totalDecisions: Int = 0,
    val paperCopyCount: Int = 0,
    val watchlistCount: Int = 0,
    val skippedCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class CohortData(
    val cohortName: String = "",
    val tradeCount: Int = 0,
    val totalPnl: Double = 0.0,
    val avgPnl: Double = 0.0,
    val winRate: Double? = null,
    val status: String = "AVAILABLE"
)

@JsonClass(generateAdapter = true)
data class HistoricalBenchmark(
    val dataMode: String = "",
    val totalTradesAnalyzed: Int = 0,
    val copyableCount: Int = 0,
    val modeledCopyPnL: Double = 0.0,
    val walletRealizedPnL: Double = 0.0,
    val pnlDelta: Double = 0.0,
    val missedWinners: Int = 0,
    val avoidedLosers: Int = 0,
    val avgLatencySeconds: Double = 0.0
)

// --- Calibration / Learning ---
@JsonClass(generateAdapter = true)
data class CalibrationResponse(
    val executionMode: String = "PAPER ONLY",
    val status: String = "INSUFFICIENT_DATA",
    val evidenceTier: String = "INSUFFICIENT",
    val activeRuleSetVersion: String = "",
    val activeRuleSetId: String = "",
    val totalCalibrationCycles: Int = 0,
    val latestLearningEvent: LearningEvent? = null,
    val candidateRuleSetsCount: Int = 0,
    val rejectedRuleSetsCount: Int = 0,
    val parameterProvenanceNotice: String = "",
    val timestamp: String = ""
)

@JsonClass(generateAdapter = true)
data class LearningEvent(
    val id: String = "",
    val status: String = "",
    val evidenceTier: String = "",
    val policyName: String = "",
    val parameterName: String? = null,
    val beforeValue: Double? = null,
    val afterValue: Double? = null,
    val reason: String? = null,
    val validationResult: String? = null,
    val createdAt: String = ""
)

// --- Rules ---
@JsonClass(generateAdapter = true)
data class RulesResponse(
    val activeRuleSet: RuleSet? = null,
    val allRulesets: List<RuleSet> = emptyList(),
    val auditChanges: List<RuleChange> = emptyList(),
    val candidateRuleSets: List<RuleSet> = emptyList(),
    val rejectedRuleSets: List<RuleSet> = emptyList(),
    val latestLearningEvent: LearningEvent? = null
)

@JsonClass(generateAdapter = true)
data class RuleSet(
    val id: String = "",
    val version: String = "",
    val status: String = "active",
    val provenance: String = "IMPLEMENTATION_BASELINE",
    val createdAt: String = ""
)

@JsonClass(generateAdapter = true)
data class RuleChange(
    val id: String = "",
    val ruleSetId: String = "",
    val parameterName: String = "",
    val oldValue: String = "",
    val newValue: String = "",
    val reason: String = "",
    val provenance: String = "",
    val createdAt: String = ""
)

// --- Ingestion Status ---
@JsonClass(generateAdapter = true)
data class IngestionHealthResponse(
    val dataMode: String = "NO DATA",
    val executionMode: String = "PAPER",
    val dataFreshness: DataFreshness? = null,
    val providerHealth: ProviderHealth? = null,
    val latestLeaderboardScan: LeaderboardScanBrief? = null,
    val latestMarketSnapshot: MarketSnapshotBrief? = null,
    val databaseCoverage: DatabaseCoverage? = null,
    val recentOperations: List<IngestionOperation> = emptyList()
)

@JsonClass(generateAdapter = true)
data class DataFreshness(
    val lastIngestionTime: String? = null,
    val ageSeconds: Long? = null,
    val freshnessLabel: String = "NO DATA"
)

@JsonClass(generateAdapter = true)
data class ProviderHealth(
    val status: String = "IDLE",
    val lastVerifiedService: String? = null,
    val unsupportedCapabilitiesNotice: String = ""
)

@JsonClass(generateAdapter = true)
data class LeaderboardScanBrief(
    val scanId: String = "",
    val scannedAt: String = "",
    val walletCount: Int = 0,
    val lookbackDays: Int = 0,
    val isDemo: Boolean = true
)

@JsonClass(generateAdapter = true)
data class MarketSnapshotBrief(
    val id: String = "",
    val marketId: String = "",
    val question: String = "",
    val spread: Double = 0.0,
    val liquidity: Double = 0.0,
    val collectedAt: String = ""
)

@JsonClass(generateAdapter = true)
data class DatabaseCoverage(
    val walletsDiscovered: Int = 0,
    val observedTradesCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class IngestionOperation(
    val id: String = "",
    val operationType: String = "",
    val status: String = "",
    val startedAt: String = "",
    val completedAt: String? = null,
    val errorsCount: Int = 0,
    val isLive: Boolean = false
)
