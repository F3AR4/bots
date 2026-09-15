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
import androidx.compose.ui.text.style.TextOverflow
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
// Wallet Research Screen
// ============================================================

data class ResearchState(
    val isLoading: Boolean = true,
    val isOffline: Boolean = false,
    val lastFetchTime: String? = null,
    val wallets: List<Wallet> = emptyList(),
    val evaluations: List<WalletEvaluation> = emptyList(),
    val errorMessage: String? = null,
    val selectedWallet: WalletEvaluation? = null
)

class ResearchViewModel(
    private val repo: BackendRepository = BackendRepository()
) : ViewModel() {

    private val _state = MutableStateFlow(ResearchState())
    val state: StateFlow<ResearchState> = _state

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = _state.value.evaluations.isEmpty())
            val result = repo.getWallets()
            val now = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
            if (result.isSuccess) {
                val data = result.getOrThrow()
                _state.value = _state.value.copy(
                    isLoading = false,
                    isOffline = false,
                    lastFetchTime = now,
                    wallets = data.wallets,
                    evaluations = data.evaluations,
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

    fun selectWallet(eval: WalletEvaluation?) {
        _state.value = _state.value.copy(selectedWallet = eval)
    }
}

@Composable
fun ResearchScreen(
    viewModel: ResearchViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsState()

    Column(modifier = modifier.fillMaxSize()) {
        if (state.isOffline) {
            OfflineBanner(lastFetchTime = state.lastFetchTime)
        }

        if (state.isLoading && state.evaluations.isEmpty()) {
            LoadingSkeleton()
        } else if (state.evaluations.isEmpty()) {
            EmptyState("No wallet evaluations available")
        } else {
            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(state.evaluations.sortedByDescending { it.globalScore }) { eval ->
                    WalletEvalCard(
                        eval = eval,
                        rank = state.evaluations.sortedByDescending { it.globalScore }.indexOf(eval) + 1,
                        onClick = { viewModel.selectWallet(eval) }
                    )
                }
                item { Spacer(modifier = Modifier.height(80.dp)) }
            }
        }

        state.selectedWallet?.let { eval ->
            WalletDetailSheet(eval = eval, onDismiss = { viewModel.selectWallet(null) })
        }
    }
}

@Composable
private fun WalletEvalCard(eval: WalletEvaluation, rank: Int, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Rank badge
            Box(
                modifier = Modifier.size(36.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "#$rank",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = when {
                        rank <= 3 -> CyberPrimary
                        rank <= 10 -> StatusAmber
                        else -> TextSecondary
                    }
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = eval.walletAddress.take(12) + "..." + eval.walletAddress.takeLast(6),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    MiniStat("Score", String.format("%.1f", eval.globalScore), StatusGreen)
                    MiniStat("Category", eval.bestCategory.take(8), CyberPrimary)
                    MiniStat("Copy", String.format("%.0f", eval.copyability), StatusBlue)
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = String.format("%.1f", eval.globalScore),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = when {
                        eval.globalScore >= 70 -> StatusGreen
                        eval.globalScore >= 40 -> StatusAmber
                        else -> StatusRed
                    }
                )
                Text(
                    text = "Global",
                    fontSize = 10.sp,
                    color = TextMuted
                )
            }
        }
    }
}

@Composable
private fun MiniStat(label: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = value, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = color)
        Text(text = label, fontSize = 9.sp, color = TextMuted)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WalletDetailSheet(eval: WalletEvaluation, onDismiss: () -> Unit) {
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
                text = "Wallet Detail",
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = eval.walletAddress,
                style = MaterialTheme.typography.bodySmall,
                color = CyberPrimary
            )
            Spacer(modifier = Modifier.height(12.dp))
            HorizontalDivider(color = SurfaceDivider)
            Spacer(modifier = Modifier.height(8.dp))

            DataRow("Global Score", String.format("%.2f", eval.globalScore))
            DataRow("Best Category", eval.bestCategory)
            DataRow("Category Edge", String.format("%.2f", eval.categoryEdge))
            DataRow("Copyability", String.format("%.2f", eval.copyability))
            DataRow("Consistency", String.format("%.2f", eval.consistency))
            DataRow("Liquidity Quality", String.format("%.2f", eval.liquidityQuality))
            DataRow("One-Hit Penalty", String.format("%.2f", eval.oneHitPenalty),
                valueColor = if (eval.oneHitPenalty > 0) StatusRed else StatusGreen)
            DataRow("Data Completeness", String.format("%.2f", eval.dataCompleteness))
            DataRow("Evaluated At", eval.evaluatedAt)

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
