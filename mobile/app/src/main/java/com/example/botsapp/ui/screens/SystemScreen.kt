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
// System Screen — Health + Learning/Rules
// No rule editing from mobile. Read-only.
// ============================================================

data class SystemState(
    val isLoading: Boolean = true,
    val isOffline: Boolean = false,
    val lastFetchTime: String? = null,
    val monitor: MonitorStatusResponse? = null,
    val calibration: CalibrationResponse? = null,
    val rules: RulesResponse? = null,
    val ingestion: IngestionHealthResponse? = null,
    val errorMessage: String? = null
)

class SystemViewModel(
    private val repo: BackendRepository = BackendRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(SystemState())
    val state: StateFlow<SystemState> = _state

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = _state.value.monitor == null)

            val monitorResult = repo.getMonitorStatus()
            val calibrationResult = repo.getCalibration()
            val rulesResult = repo.getRules()
            val ingestionResult = repo.getIngestionHealth()

            val now = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())

            if (monitorResult.isSuccess || calibrationResult.isSuccess) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    isOffline = false,
                    lastFetchTime = now,
                    monitor = monitorResult.getOrNull() ?: _state.value.monitor,
                    calibration = calibrationResult.getOrNull() ?: _state.value.calibration,
                    rules = rulesResult.getOrNull() ?: _state.value.rules,
                    ingestion = ingestionResult.getOrNull() ?: _state.value.ingestion,
                    errorMessage = null
                )
            } else {
                _state.value = _state.value.copy(
                    isLoading = false,
                    isOffline = true,
                    errorMessage = monitorResult.exceptionOrNull()?.message
                )
            }
        }
    }
}

@Composable
fun SystemScreen(
    viewModel: SystemViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = modifier.fillMaxSize()) {
        if (state.isOffline) {
            OfflineBanner(lastFetchTime = state.lastFetchTime)
        }

        if (state.isLoading && state.monitor == null) {
            LoadingSkeleton()
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Spacer(modifier = Modifier.height(4.dp))

                // Daemon State
                val mon = state.monitor
                if (mon != null) {
                    InfoCard(title = "Daemon Health") {
                        DataRow("Engine State", mon.engineLifecycleState,
                            valueColor = stateColor(mon.engineLifecycleState))
                        DataRow("Monitor Status", mon.walletMonitorStatus,
                            valueColor = stateColor(mon.walletMonitorStatus))
                        DataRow("Paper Engine", mon.paperEngineStatus,
                            valueColor = stateColor(mon.paperEngineStatus))
                        DataRow("Last Poll", mon.lastPollAt ?: "N/A")
                        DataRow("Active Wallets", "${mon.activeTrackedWallets}")

                        if (mon.lastErrorMessage != null) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Last Error: ${mon.lastErrorMessage}",
                                color = StatusRed,
                                fontSize = 12.sp
                            )
                        }
                    }

                    // Observability
                    val obs = mon.observability
                    if (obs != null) {
                        InfoCard(title = "Observability Timeline") {
                            DataRow("Monitor Process", obs.monitorProcessStatus,
                                valueColor = stateColor(obs.monitorProcessStatus))
                            DataRow("Last Monitoring Cycle", obs.lastSuccessfulMonitoringCycle ?: "N/A")
                            DataRow("Last Leaderboard Scan", obs.lastSuccessfulLeaderboardScan ?: "N/A")
                            DataRow("Last Wallet Scan", obs.lastSuccessfulWalletScan ?: "N/A")
                            DataRow("Last Trade Detection", obs.lastSuccessfulTradeObservation ?: "N/A")
                            DataRow("Last PnL Update", obs.lastSuccessfulPnlUpdate ?: "N/A")
                            DataRow("Last Outcome Review", obs.lastSuccessfulOutcomeReview ?: "N/A")
                            DataRow("Ingestion Provider", obs.ingestionProviderHealth,
                                valueColor = stateColor(obs.ingestionProviderHealth))

                            if (obs.lastError != null) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Error: ${obs.lastError} (${obs.lastErrorTimestamp ?: "N/A"})",
                                    color = StatusRed,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }

                // Ingestion Health
                val ing = state.ingestion
                if (ing != null) {
                    InfoCard(title = "Ingestion Health") {
                        DataRow("Data Mode", ing.dataMode)
                        val df = ing.dataFreshness
                        if (df != null) {
                            DataRow("Last Ingestion", df.lastIngestionTime ?: "N/A")
                            DataRow("Freshness", df.freshnessLabel)
                        }
                        val ph = ing.providerHealth
                        if (ph != null) {
                            DataRow("Provider Status", ph.status, valueColor = stateColor(ph.status))
                        }
                        val scan = ing.latestLeaderboardScan
                        if (scan != null) {
                            DataRow("Last Scan", scan.scannedAt)
                            DataRow("Wallets Scanned", "${scan.walletCount}")
                            DataRow("Demo Data", if (scan.isDemo) "Yes" else "No",
                                valueColor = if (scan.isDemo) StatusAmber else StatusGreen)
                        }
                        val cov = ing.databaseCoverage
                        if (cov != null) {
                            DataRow("Wallets Discovered", "${cov.walletsDiscovered}")
                            DataRow("Observed Trades", "${cov.observedTradesCount}")
                        }
                    }
                }

                // Calibration / Learning
                val cal = state.calibration
                if (cal != null) {
                    InfoCard(title = "Calibration / Learning") {
                        DataRow("Status", cal.status, valueColor = stateColor(cal.status))
                        DataRow("Evidence Tier", cal.evidenceTier, valueColor = tierColor(cal.evidenceTier))
                        DataRow("Active RuleSet", cal.activeRuleSetVersion)
                        DataRow("RuleSet ID", cal.activeRuleSetId.take(12) + "...")
                        DataRow("Total Cycles", "${cal.totalCalibrationCycles}")
                        DataRow("Candidate RuleSets", "${cal.candidateRuleSetsCount}")
                        DataRow("Rejected RuleSets", "${cal.rejectedRuleSetsCount}")

                        val event = cal.latestLearningEvent
                        if (event != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Latest Learning Event",
                                style = MaterialTheme.typography.labelSmall,
                                color = CyberPrimary,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            DataRow("Policy", event.policyName)
                            DataRow("Status", event.status)
                            DataRow("Evidence", event.evidenceTier)
                            if (event.parameterName != null) {
                                DataRow("Parameter", event.parameterName)
                                if (event.beforeValue != null) {
                                    DataRow("Before", String.format("%.4f", event.beforeValue))
                                }
                                if (event.afterValue != null) {
                                    DataRow("After", String.format("%.4f", event.afterValue))
                                }
                            }
                            if (event.reason != null) {
                                DataRow("Reason", event.reason)
                            }
                            if (event.validationResult != null) {
                                DataRow("Validation", event.validationResult)
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = cal.parameterProvenanceNotice,
                            fontSize = 10.sp,
                            color = TextMuted
                        )
                    }
                }

                // Rules
                val rules = state.rules
                if (rules != null) {
                    InfoCard(title = "Active RuleSet") {
                        val active = rules.activeRuleSet
                        if (active != null) {
                            DataRow("Version", active.version)
                            DataRow("Status", active.status, valueColor = StatusGreen)
                            DataRow("Provenance", active.provenance, valueColor = provenanceColor(active.provenance))
                            DataRow("Created", active.createdAt)
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        DataRow("Total Versions", "${rules.allRulesets.size}")
                        DataRow("Candidates", "${rules.candidateRuleSets.size}")
                        DataRow("Rejected", "${rules.rejectedRuleSets.size}")
                    }

                    // Rule Changes
                    if (rules.auditChanges.isNotEmpty()) {
                        InfoCard(title = "Recent Rule Changes") {
                            rules.auditChanges.take(5).forEach { change ->
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = SurfaceElevated),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.padding(vertical = 4.dp)
                                ) {
                                    Column(modifier = Modifier.padding(10.dp)) {
                                        DataRow("Parameter", change.parameterName)
                                        DataRow("Old", change.oldValue)
                                        DataRow("New", change.newValue)
                                        DataRow("Reason", change.reason)
                                        DataRow("Provenance", change.provenance,
                                            valueColor = provenanceColor(change.provenance))
                                        DataRow("Time", change.createdAt)
                                    }
                                }
                            }
                        }
                    }
                }

                // Execution mode notice
                Text(
                    text = "📋 Rules are read-only from mobile. Modifications must be made through the calibration pipeline.",
                    fontSize = 11.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )

                Spacer(modifier = Modifier.height(80.dp))
            }
        }
    }
}

@Composable
private fun stateColor(state: String): androidx.compose.ui.graphics.Color {
    return when (state.uppercase()) {
        "RUNNING", "OPERATIONAL", "HEALTHY", "ACTIVE", "APPLIED" -> StatusGreen
        "IDLE", "STOPPED", "INSUFFICIENT_DATA" -> TextMuted
        "DEGRADED", "STARTING", "STOPPING", "STALE", "WARNING" -> StatusAmber
        "ERROR", "FAILED" -> StatusRed
        else -> TextSecondary
    }
}

@Composable
private fun tierColor(tier: String): androidx.compose.ui.graphics.Color {
    return when (tier.uppercase()) {
        "STRONG" -> StatusGreen
        "MODERATE" -> StatusBlue
        "SUGGESTIVE" -> StatusAmber
        "INSUFFICIENT" -> StatusRed
        else -> TextMuted
    }
}

@Composable
private fun provenanceColor(provenance: String): androidx.compose.ui.graphics.Color {
    return when (provenance.uppercase()) {
        "PDF_EXPLICIT" -> StatusGreen
        "IMPLEMENTATION_BASELINE" -> StatusBlue
        "CALIBRATION_DERIVED" -> CyberPrimary
        "OPERATOR_CONFIG" -> StatusAmber
        "TBD" -> StatusRed
        else -> TextSecondary
    }
}
