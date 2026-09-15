package com.example.botsapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

// ============================================================
// Command Center — primary operational view
// ============================================================

data class CommandCenterState(
    val isLoading: Boolean = true,
    val isOffline: Boolean = false,
    val lastFetchTime: String? = null,
    val controlStatus: ControlStatusResponse? = null,
    val systemStatus: SystemStatusResponse? = null,
    val calibration: CalibrationResponse? = null,
    val errorMessage: String? = null,
    val isControlActionInProgress: Boolean = false,
    val controlActionMessage: String? = null
)

class CommandCenterViewModel(
    private val repo: BackendRepository = BackendRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(CommandCenterState())
    val state: StateFlow<CommandCenterState> = _state

    init {
        refresh()
        startPolling()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = _state.value.controlStatus == null)

            val controlResult = repo.getControlStatus()
            val statusResult = repo.getSystemStatus()
            val calibrationResult = repo.getCalibration()

            val now = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())

            if (controlResult.isSuccess || statusResult.isSuccess) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    isOffline = false,
                    lastFetchTime = now,
                    controlStatus = controlResult.getOrNull() ?: _state.value.controlStatus,
                    systemStatus = statusResult.getOrNull() ?: _state.value.systemStatus,
                    calibration = calibrationResult.getOrNull() ?: _state.value.calibration,
                    errorMessage = null
                )
            } else {
                _state.value = _state.value.copy(
                    isLoading = false,
                    isOffline = true,
                    errorMessage = controlResult.exceptionOrNull()?.message ?: "Connection failed"
                )
            }
        }
    }

    fun startEngine() {
        if (_state.value.isControlActionInProgress) return
        val currentState = _state.value.controlStatus?.lifecycleState ?: "UNKNOWN"
        if (currentState == "RUNNING" || currentState == "STARTING") return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                isControlActionInProgress = true,
                controlActionMessage = "Starting..."
            )
            val result = repo.startRuntime()
            if (result.isSuccess) {
                _state.value = _state.value.copy(
                    controlActionMessage = result.getOrNull()?.message ?: "Started"
                )
            } else {
                _state.value = _state.value.copy(
                    controlActionMessage = "Start failed: ${result.exceptionOrNull()?.message}"
                )
            }
            delay(1000)
            _state.value = _state.value.copy(
                isControlActionInProgress = false,
                controlActionMessage = null
            )
            refresh()
        }
    }

    fun stopEngine() {
        if (_state.value.isControlActionInProgress) return
        val currentState = _state.value.controlStatus?.lifecycleState ?: "UNKNOWN"
        if (currentState == "STOPPED" || currentState == "STOPPING") return

        viewModelScope.launch {
            _state.value = _state.value.copy(
                isControlActionInProgress = true,
                controlActionMessage = "Stopping..."
            )
            val result = repo.stopRuntime()
            if (result.isSuccess) {
                _state.value = _state.value.copy(
                    controlActionMessage = result.getOrNull()?.message ?: "Stopped"
                )
            } else {
                _state.value = _state.value.copy(
                    controlActionMessage = "Stop failed: ${result.exceptionOrNull()?.message}"
                )
            }
            delay(1000)
            _state.value = _state.value.copy(
                isControlActionInProgress = false,
                controlActionMessage = null
            )
            refresh()
        }
    }

    private fun startPolling() {
        viewModelScope.launch {
            while (true) {
                delay(15_000) // 15s polling for runtime status
                refresh()
            }
        }
    }
}

@Composable
fun CommandCenterScreen(
    viewModel: CommandCenterViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = modifier.fillMaxSize()) {
        // PAPER ONLY banner — always visible
        PaperOnlyBanner(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))

        if (state.isOffline) {
            OfflineBanner(lastFetchTime = state.lastFetchTime)
        }

        if (state.isLoading && state.controlStatus == null) {
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

                // Engine Lifecycle Control
                EngineControlCard(
                    lifecycleState = state.controlStatus?.lifecycleState ?: "UNKNOWN",
                    isActionInProgress = state.isControlActionInProgress,
                    actionMessage = state.controlActionMessage,
                    uptime = state.controlStatus?.telemetry?.uptimeSeconds,
                    lastCycle = state.controlStatus?.telemetry?.lastCycleAt,
                    onStart = { viewModel.startEngine() },
                    onStop = { viewModel.stopEngine() }
                )

                // Summary Row
                val status = state.systemStatus
                if (status != null) {
                    // PnL Card
                    InfoCard(title = "Paper PnL") {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            PnlDisplay("Total", status.currentPnl?.totalPnl ?: 0.0, large = true)
                            PnlDisplay("Unrealized", status.currentPnl?.unrealizedPnl ?: 0.0)
                            PnlDisplay("Realized", status.currentPnl?.realizedPnl ?: 0.0)
                        }
                    }

                    // Operational Summary
                    InfoCard(title = "Operational Summary") {
                        DataRow("Open Trades", "${status.openPaperTradesCount}")
                        DataRow("Total Trades", "${status.totalPaperTradesCount}")
                        DataRow("Tracked Wallets", "${status.trackedWalletsCount}")
                        DataRow("Data Mode", status.dataMode)
                        DataRow("Rule Version", status.activeRuleVersion ?: "N/A")
                    }

                    // Latest Signal
                    InfoCard(title = "Latest Signal") {
                        val sig = status.latestSignal
                        if (sig != null) {
                            DataRow("Decision", sig.decision, valueColor = decisionColor(sig.decision))
                            DataRow("Score", String.format("%.1f", sig.finalScore))
                            DataRow("Market", sig.marketId.take(12) + "...")
                            DataRow("Wallet", sig.walletAddress.take(10) + "...")
                            DataRow("Time", sig.timestamp ?: "N/A")
                        } else {
                            EmptyState("No signals detected yet")
                        }
                    }

                    // Latest Decision
                    InfoCard(title = "Latest Decision") {
                        val dec = status.latestDecision
                        if (dec != null) {
                            DataRow("Verdict", dec.decision, valueColor = decisionColor(dec.decision))
                            DataRow("Copy Score", String.format("%.1f", dec.copyScore))
                            DataRow("Market", dec.marketId.take(12) + "...")
                            DataRow("Time", dec.evaluatedAt ?: "N/A")
                        } else {
                            EmptyState("No decisions made yet")
                        }
                    }

                    // Ingestion Health
                    InfoCard(title = "Ingestion Health") {
                        val ing = status.ingestionStatus
                        if (ing != null) {
                            DataRow("Provider", ing.health, valueColor = healthColor(ing.health))
                            DataRow("Last Ingestion", ing.lastIngestionTime ?: "N/A")
                            DataRow("Data Mode", ing.dataMode)
                        }
                        val mf = status.marketDataFreshness
                        if (mf != null) {
                            DataRow("Market Freshness", mf.freshnessLabel)
                        }
                        DataRow("Last Error", status.lastError ?: "None", valueColor = if (status.lastError != null) StatusRed else StatusGreen)
                    }
                }

                // Calibration Summary
                val cal = state.calibration
                if (cal != null) {
                    InfoCard(title = "Calibration / Learning") {
                        DataRow("Status", cal.status)
                        DataRow("Evidence Tier", cal.evidenceTier)
                        DataRow("Active Rule Version", cal.activeRuleSetVersion)
                        DataRow("Total Cycles", "${cal.totalCalibrationCycles}")
                        DataRow("Candidate RuleSets", "${cal.candidateRuleSetsCount}")
                        DataRow("Rejected RuleSets", "${cal.rejectedRuleSetsCount}")
                    }
                }

                Spacer(modifier = Modifier.height(80.dp)) // nav bar clearance
            }
        }
    }
}

@Composable
private fun EngineControlCard(
    lifecycleState: String,
    isActionInProgress: Boolean,
    actionMessage: String?,
    uptime: Long?,
    lastCycle: String?,
    onStart: () -> Unit,
    onStop: () -> Unit
) {
    val chipStatus = when (lifecycleState) {
        "RUNNING" -> ChipStatus.RUNNING
        "STARTING" -> ChipStatus.WARNING
        "STOPPING" -> ChipStatus.WARNING
        "STOPPED" -> ChipStatus.IDLE
        "ERROR" -> ChipStatus.ERROR
        else -> ChipStatus.UNKNOWN
    }

    InfoCard(title = "Engine Lifecycle") {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            StatusChip(label = lifecycleState, status = chipStatus)

            if (isActionInProgress) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = CyberPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = actionMessage ?: "",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }
            } else {
                when (lifecycleState) {
                    "STOPPED", "ERROR" -> {
                        Button(
                            onClick = onStart,
                            colors = ButtonDefaults.buttonColors(containerColor = StatusGreen)
                        ) {
                            Text("Start Engine", fontWeight = FontWeight.Bold)
                        }
                    }
                    "RUNNING" -> {
                        Button(
                            onClick = onStop,
                            colors = ButtonDefaults.buttonColors(containerColor = StatusRed)
                        ) {
                            Text("Stop Engine", fontWeight = FontWeight.Bold)
                        }
                    }
                    "STARTING", "STOPPING" -> {
                        Text(
                            text = if (lifecycleState == "STARTING") "Starting..." else "Stopping...",
                            color = StatusAmber,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    else -> {
                        Text(
                            text = "State Unknown",
                            color = TextMuted,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        if (uptime != null && uptime > 0) {
            val hours = uptime / 3600
            val mins = (uptime % 3600) / 60
            DataRow("Uptime", "${hours}h ${mins}m")
        }
        DataRow("Last Cycle", lastCycle ?: "N/A")
    }
}

@Composable
private fun decisionColor(decision: String): androidx.compose.ui.graphics.Color {
    return when (decision.lowercase()) {
        "paper_copy" -> StatusGreen
        "watchlist" -> StatusAmber
        "skip" -> StatusRed
        else -> TextSecondary
    }
}

@Composable
private fun healthColor(health: String): androidx.compose.ui.graphics.Color {
    return when (health.uppercase()) {
        "OPERATIONAL", "HEALTHY", "ACTIVE" -> StatusGreen
        "DEGRADED" -> StatusAmber
        "IDLE" -> TextMuted
        else -> StatusRed
    }
}
