package com.example.botsapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
// Paper Trades Screen
// ============================================================

data class TradesState(
    val isLoading: Boolean = true,
    val isOffline: Boolean = false,
    val lastFetchTime: String? = null,
    val trades: List<PaperTrade> = emptyList(),
    val totalPnl: Double = 0.0,
    val totalTrades: Int = 0,
    val errorMessage: String? = null,
    val selectedTrade: PaperTrade? = null
)

class TradesViewModel(
    private val repo: BackendRepository = BackendRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(TradesState())
    val state: StateFlow<TradesState> = _state

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = _state.value.trades.isEmpty())
            val result = repo.getPaperTrades()
            val now = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
            if (result.isSuccess) {
                val data = result.getOrThrow()
                _state.value = _state.value.copy(
                    isLoading = false,
                    isOffline = false,
                    lastFetchTime = now,
                    trades = data.paperTrades,
                    totalPnl = data.totalPnl,
                    totalTrades = data.totalTrades,
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

    fun selectTrade(trade: PaperTrade?) {
        _state.value = _state.value.copy(selectedTrade = trade)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TradesScreen(
    viewModel: TradesViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = modifier.fillMaxSize()) {
        if (state.isOffline) {
            OfflineBanner(lastFetchTime = state.lastFetchTime)
        }

        if (state.isLoading && state.trades.isEmpty()) {
            LoadingSkeleton()
        } else if (state.trades.isEmpty()) {
            EmptyState("No paper trades yet")
        } else {
            // Header summary
            InfoCard(
                title = "Paper Trades Summary",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    PnlDisplay("Total PnL", state.totalPnl, large = true)
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Total", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                        Text("${state.totalTrades}", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Open", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                        Text(
                            "${state.trades.count { it.status == "open" }}",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = StatusGreen
                        )
                    }
                }
            }

            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(state.trades) { trade ->
                    TradeCard(trade = trade, onClick = { viewModel.selectTrade(trade) })
                }
                item { Spacer(modifier = Modifier.height(80.dp)) }
            }
        }

        // Trade detail bottom sheet
        state.selectedTrade?.let { trade ->
            TradeDetailSheet(
                trade = trade,
                onDismiss = { viewModel.selectTrade(null) }
            )
        }
    }
}

@Composable
private fun TradeCard(trade: PaperTrade, onClick: () -> Unit) {
    val pnl = if (trade.status == "open") trade.unrealizedPnl else trade.realizedPnl
    val pnlColor = when {
        pnl > 0 -> PnlPositive
        pnl < 0 -> PnlNegative
        else -> PnlNeutral
    }
    val statusColor = when (trade.status) {
        "open" -> StatusGreen
        "closed", "resolved" -> TextMuted
        else -> StatusAmber
    }

    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = trade.marketQuestion.take(50) + if (trade.marketQuestion.length > 50) "..." else "",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextPrimary,
                        fontWeight = FontWeight.Medium,
                        maxLines = 2
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatusChip(
                            label = trade.status.uppercase(),
                            status = if (trade.status == "open") ChipStatus.RUNNING else ChipStatus.IDLE
                        )
                        Text(
                            text = trade.outcome,
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "${if (pnl >= 0) "+" else ""}$${String.format("%.2f", pnl)}",
                        color = pnlColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                    Text(
                        text = "$${String.format("%.2f", trade.simulatedSize)}",
                        fontSize = 11.sp,
                        color = TextMuted
                    )
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Entry: ${String.format("%.3f", trade.entryPrice)}",
                    fontSize = 11.sp,
                    color = TextSecondary
                )
                Text(
                    text = "Current: ${String.format("%.3f", trade.currentPrice)}",
                    fontSize = 11.sp,
                    color = TextSecondary
                )
                Text(
                    text = trade.walletAddress.take(8) + "...",
                    fontSize = 11.sp,
                    color = TextMuted
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TradeDetailSheet(trade: PaperTrade, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState()
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = SurfaceElevated
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp)
        ) {
            Text(
                text = "Trade Details",
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = trade.marketQuestion,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary
            )
            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = SurfaceDivider)
            Spacer(modifier = Modifier.height(8.dp))

            DataRow("Status", trade.status.uppercase())
            DataRow("Outcome", trade.outcome)
            DataRow("Entry Price", String.format("%.4f", trade.entryPrice))
            DataRow("Current Price", String.format("%.4f", trade.currentPrice))
            DataRow("Position Size", "$${String.format("%.2f", trade.simulatedSize)}")
            DataRow("Unrealized PnL", "$${String.format("%.2f", trade.unrealizedPnl)}",
                valueColor = if (trade.unrealizedPnl >= 0) PnlPositive else PnlNegative)
            DataRow("Realized PnL", "$${String.format("%.2f", trade.realizedPnl)}",
                valueColor = if (trade.realizedPnl >= 0) PnlPositive else PnlNegative)
            DataRow("RuleSet", trade.ruleSetVersion)
            DataRow("Wallet", trade.walletAddress)
            DataRow("Created", trade.createdAt)
            DataRow("Updated", trade.updatedAt)
            if (trade.closedAt != null) {
                DataRow("Closed", trade.closedAt)
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
