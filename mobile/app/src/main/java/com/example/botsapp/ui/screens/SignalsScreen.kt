package com.example.botsapp.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
// Signals Screen
// ============================================================

data class SignalsState(
    val isLoading: Boolean = true,
    val isOffline: Boolean = false,
    val lastFetchTime: String? = null,
    val signals: List<Signal> = emptyList(),
    val errorMessage: String? = null
)

class SignalsViewModel(
    private val repo: BackendRepository = BackendRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(SignalsState())
    val state: StateFlow<SignalsState> = _state

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = _state.value.signals.isEmpty())
            val result = repo.getSignals()
            val now = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
            if (result.isSuccess) {
                val data = result.getOrThrow()
                _state.value = _state.value.copy(
                    isLoading = false,
                    isOffline = false,
                    lastFetchTime = now,
                    signals = data.signals,
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
fun SignalsScreen(
    viewModel: SignalsViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = modifier.fillMaxSize()) {
        if (state.isOffline) {
            OfflineBanner(lastFetchTime = state.lastFetchTime)
        }

        if (state.isLoading && state.signals.isEmpty()) {
            LoadingSkeleton()
        } else if (state.signals.isEmpty()) {
            EmptyState("No live signals detected yet")
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(state.signals) { signal ->
                    SignalCard(signal = signal)
                }
                item { Spacer(modifier = Modifier.height(80.dp)) }
            }
        }
    }
}

@Composable
private fun SignalCard(signal: Signal) {
    val decisionColor = when (signal.decision.lowercase()) {
        "paper_copy" -> StatusGreen
        "watchlist" -> StatusAmber
        "skip" -> StatusRed
        else -> TextSecondary
    }

    val provenanceLabel = when {
        signal.provenance.contains("fixture", ignoreCase = true) ||
            signal.provenance.contains("demo", ignoreCase = true) -> "FIXTURE"
        signal.provenance.contains("historical", ignoreCase = true) ||
            signal.provenance.contains("hypothetical", ignoreCase = true) -> "HISTORICAL"
        else -> "LIVE OBSERVED"
    }
    val provenanceColor = when (provenanceLabel) {
        "LIVE OBSERVED" -> StatusGreen
        "FIXTURE" -> StatusAmber
        else -> TextMuted
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusChip(
                    label = signal.decision.uppercase().replace("_", " "),
                    status = when (signal.decision.lowercase()) {
                        "paper_copy" -> ChipStatus.RUNNING
                        "watchlist" -> ChipStatus.WARNING
                        else -> ChipStatus.IDLE
                    }
                )
                StatusChip(
                    label = provenanceLabel,
                    status = when (provenanceLabel) {
                        "LIVE OBSERVED" -> ChipStatus.HEALTHY
                        "FIXTURE" -> ChipStatus.WARNING
                        else -> ChipStatus.IDLE
                    }
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            if (signal.marketQuestion != null) {
                Text(
                    text = signal.marketQuestion,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextPrimary,
                    maxLines = 2,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(6.dp))
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Score", fontSize = 10.sp, color = TextMuted)
                    Text(
                        text = String.format("%.1f", signal.finalScore),
                        fontWeight = FontWeight.Bold,
                        color = CyberPrimary,
                        fontSize = 18.sp
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Entry", fontSize = 10.sp, color = TextMuted)
                    Text(String.format("%.3f", signal.entryPrice), fontSize = 13.sp, color = TextPrimary)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Current", fontSize = 10.sp, color = TextMuted)
                    Text(String.format("%.3f", signal.currentPrice), fontSize = 13.sp, color = TextPrimary)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Spread", fontSize = 10.sp, color = TextMuted)
                    Text(String.format("%.3f", signal.spread), fontSize = 13.sp, color = TextPrimary)
                }
            }

            Spacer(modifier = Modifier.height(6.dp))
            HorizontalDivider(color = SurfaceDivider)
            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Wallet: ${signal.walletAddress.take(10)}...",
                    fontSize = 11.sp,
                    color = TextMuted
                )
                Text(
                    text = signal.detectedAt.take(19),
                    fontSize = 11.sp,
                    color = TextMuted
                )
            }

            // Score breakdown
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                ScoreLabel("Wallet", signal.walletScore)
                ScoreLabel("Spread", signal.spreadScore)
                ScoreLabel("Liquid", signal.liquidityScore)
                ScoreLabel("Consist", signal.consistencyScore)
                ScoreLabel("Timing", signal.entryTimingScore)
            }
        }
    }
}

@Composable
private fun ScoreLabel(label: String, score: Double) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, fontSize = 9.sp, color = TextMuted)
        Text(
            text = String.format("%.0f", score),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = when {
                score >= 70 -> StatusGreen
                score >= 40 -> StatusAmber
                else -> StatusRed
            }
        )
    }
}
