package com.example.botsapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.botsapp.network.*
import com.example.botsapp.theme.*
import com.example.botsapp.ui.components.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

// ============================================================
// Performance Screen
// ============================================================

data class PerformanceState(
    val isLoading: Boolean = true,
    val isOffline: Boolean = false,
    val lastFetchTime: String? = null,
    val performance: PerformanceResponse? = null,
    val errorMessage: String? = null
)

class PerformanceViewModel(
    private val repo: BackendRepository = BackendRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(PerformanceState())
    val state: StateFlow<PerformanceState> = _state

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = _state.value.performance == null)
            val result = repo.getPerformance()
            val now = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
            if (result.isSuccess) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    isOffline = false,
                    lastFetchTime = now,
                    performance = result.getOrThrow(),
                    errorMessage = null
                )
            } else {
                _state.value = _state.value.copy(
                    isLoading = false,
                    isOffline = true,
                    errorMessage = result.exceptionOrNull()?.message
                )
            }
        }
    }
}

@Composable
fun PerformanceScreen(
    viewModel: PerformanceViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = modifier.fillMaxSize()) {
        if (state.isOffline) {
            OfflineBanner(lastFetchTime = state.lastFetchTime)
        }

        if (state.isLoading && state.performance == null) {
            LoadingSkeleton()
        } else if (state.performance == null) {
            ErrorState(message = state.errorMessage ?: "Failed to load performance", onRetry = { viewModel.refresh() })
        } else {
            val perf = state.performance!!
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Spacer(modifier = Modifier.height(4.dp))

                // PnL Summary
                InfoCard(title = "Paper Trading PnL") {
                    val metrics = perf.metrics
                    if (metrics != null) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            PnlDisplay("Total PnL", metrics.totalPnl, large = true)
                            PnlDisplay("Realized", metrics.realizedPnl)
                            PnlDisplay("Unrealized", metrics.unrealizedPnl)
                        }
                    }
                }

                // Trade Statistics
                InfoCard(title = "Trade Statistics") {
                    val metrics = perf.metrics
                    if (metrics != null) {
                        DataRow("Total Trades", "${metrics.totalPaperTrades}")
                        DataRow("Open", "${metrics.openPaperTrades}", valueColor = StatusGreen)
                        DataRow("Closed", "${metrics.closedPaperTrades}")
                        DataRow("Wins", "${metrics.wins}", valueColor = PnlPositive)
                        DataRow("Losses", "${metrics.losses}", valueColor = PnlNegative)

                        Spacer(modifier = Modifier.height(4.dp))
                        if (metrics.winRateStatus == "AVAILABLE" && metrics.winRate != null) {
                            DataRow(
                                "Win Rate",
                                "${String.format("%.1f", metrics.winRate * 100)}%",
                                valueColor = if (metrics.winRate >= 0.5) StatusGreen else StatusRed
                            )
                        } else {
                            DataRow("Win Rate", metrics.winRateReason ?: "INSUFFICIENT DATA", valueColor = StatusAmber)
                        }
                    }
                }

                // Decisions Summary
                InfoCard(title = "Decisions Summary") {
                    val dec = perf.decisionsSummary
                    if (dec != null) {
                        DataRow("Total Decisions", "${dec.totalDecisions}")
                        DataRow("Paper Copy", "${dec.paperCopyCount}", valueColor = StatusGreen)
                        DataRow("Watchlist", "${dec.watchlistCount}", valueColor = StatusAmber)
                        DataRow("Skipped", "${dec.skippedCount}", valueColor = StatusRed)
                    }
                }

                // Benchmark Cohorts
                InfoCard(title = "Benchmark Cohorts") {
                    if (perf.cohortDataStatus == "INSUFFICIENT DATA") {
                        Text(
                            text = perf.cohortDataReason ?: "Insufficient data for cohort comparison",
                            style = MaterialTheme.typography.bodySmall,
                            color = StatusAmber
                        )
                    } else {
                        val cohortNames = listOf(
                            "BOT_FILTERED_PAPER",
                            "BLIND_LEADERBOARD_COPY",
                            "WATCHLIST",
                            "SKIPPED"
                        )
                        cohortNames.forEach { name ->
                            val cohort = perf.benchmarkCohorts?.get(name)
                            if (cohort != null) {
                                CohortRow(name = name, cohort = cohort)
                                Spacer(modifier = Modifier.height(4.dp))
                            }
                        }
                    }
                }

                // Historical Research Benchmark
                val hist = perf.historicalResearchBenchmark
                if (hist != null) {
                    InfoCard(title = "Historical Research Benchmark") {
                        Text(
                            text = hist.dataMode,
                            style = MaterialTheme.typography.labelSmall,
                            color = StatusAmber
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        DataRow("Trades Analyzed", "${hist.totalTradesAnalyzed}")
                        DataRow("Copyable", "${hist.copyableCount}")
                        DataRow("Modeled PnL", "$${String.format("%.2f", hist.modeledCopyPnL)}")
                        DataRow("Wallet PnL", "$${String.format("%.2f", hist.walletRealizedPnL)}")
                        DataRow("PnL Delta", "$${String.format("%.2f", hist.pnlDelta)}",
                            valueColor = if (hist.pnlDelta >= 0) PnlPositive else PnlNegative)
                        DataRow("Missed Winners", "${hist.missedWinners}")
                        DataRow("Avoided Losers", "${hist.avoidedLosers}")
                        DataRow("Avg Latency", "${String.format("%.1f", hist.avgLatencySeconds)}s")
                    }
                }

                Spacer(modifier = Modifier.height(80.dp))
            }
        }
    }
}

@Composable
private fun CohortRow(name: String, cohort: CohortData) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceElevated),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Text(
                text = name.replace("_", " "),
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp,
                color = CyberPrimary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Trades", fontSize = 9.sp, color = TextMuted)
                    Text("${cohort.tradeCount}", fontSize = 13.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Total PnL", fontSize = 9.sp, color = TextMuted)
                    Text(
                        "$${String.format("%.2f", cohort.totalPnl)}",
                        fontSize = 13.sp,
                        color = if (cohort.totalPnl >= 0) PnlPositive else PnlNegative,
                        fontWeight = FontWeight.Medium
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Avg PnL", fontSize = 9.sp, color = TextMuted)
                    Text(
                        "$${String.format("%.2f", cohort.avgPnl)}",
                        fontSize = 13.sp,
                        color = if (cohort.avgPnl >= 0) PnlPositive else PnlNegative,
                        fontWeight = FontWeight.Medium
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Win Rate", fontSize = 9.sp, color = TextMuted)
                    Text(
                        if (cohort.winRate != null) "${String.format("%.0f", cohort.winRate * 100)}%" else "N/A",
                        fontSize = 13.sp,
                        color = if (cohort.winRate != null && cohort.winRate >= 0.5) StatusGreen else StatusAmber,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}
