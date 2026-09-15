package com.example.botsapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.botsapp.theme.*
import com.example.botsapp.ui.screens.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()
        setContent {
            BotsAppTheme {
                BotsAppShell()
            }
        }
    }
}

enum class BottomNavTab(
    val label: String,
    val icon: ImageVector
) {
    HOME("Home", Icons.Filled.Dashboard),
    TRADES("Trades", Icons.Filled.SwapHoriz),
    SIGNALS("Signals", Icons.Filled.Sensors),
    RESEARCH("Research", Icons.Filled.Analytics),
    PERFORMANCE("Perf", Icons.Filled.TrendingUp),
    SYSTEM("System", Icons.Filled.Settings)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BotsAppShell() {
    var selectedTab by remember { mutableStateOf(BottomNavTab.HOME) }

    // ViewModels — shared across tab switches so they retain state
    val commandCenterVM: CommandCenterViewModel = viewModel { CommandCenterViewModel() }
    val tradesVM: TradesViewModel = viewModel { TradesViewModel() }
    val signalsVM: SignalsViewModel = viewModel { SignalsViewModel() }
    val researchVM: ResearchViewModel = viewModel { ResearchViewModel() }
    val performanceVM: PerformanceViewModel = viewModel { PerformanceViewModel() }
    val systemVM: SystemViewModel = viewModel { SystemViewModel() }

    Scaffold(
        containerColor = SurfaceDark,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = when (selectedTab) {
                            BottomNavTab.HOME -> "Command Center"
                            BottomNavTab.TRADES -> "Paper Trades"
                            BottomNavTab.SIGNALS -> "Live Signals"
                            BottomNavTab.RESEARCH -> "Wallet Research"
                            BottomNavTab.PERFORMANCE -> "Performance"
                            BottomNavTab.SYSTEM -> "System Health"
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SurfaceDark,
                    titleContentColor = TextPrimary
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = SurfaceCard,
                contentColor = TextPrimary
            ) {
                BottomNavTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = {
                            selectedTab = tab
                            // Refresh data on tab entry
                            when (tab) {
                                BottomNavTab.HOME -> commandCenterVM.refresh()
                                BottomNavTab.TRADES -> tradesVM.refresh()
                                BottomNavTab.SIGNALS -> signalsVM.refresh()
                                BottomNavTab.RESEARCH -> researchVM.refresh()
                                BottomNavTab.PERFORMANCE -> performanceVM.refresh()
                                BottomNavTab.SYSTEM -> systemVM.refresh()
                            }
                        },
                        icon = {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.label
                            )
                        },
                        label = {
                            Text(
                                text = tab.label,
                                fontSize = 10.sp,
                                maxLines = 1
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = CyberPrimary,
                            selectedTextColor = CyberPrimary,
                            unselectedIconColor = TextMuted,
                            unselectedTextColor = TextMuted,
                            indicatorColor = CyberPrimary.copy(alpha = 0.12f)
                        )
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(SurfaceDark)
        ) {
            when (selectedTab) {
                BottomNavTab.HOME -> CommandCenterScreen(viewModel = commandCenterVM)
                BottomNavTab.TRADES -> TradesScreen(viewModel = tradesVM)
                BottomNavTab.SIGNALS -> SignalsScreen(viewModel = signalsVM)
                BottomNavTab.RESEARCH -> ResearchScreen(viewModel = researchVM)
                BottomNavTab.PERFORMANCE -> PerformanceScreen(viewModel = performanceVM)
                BottomNavTab.SYSTEM -> SystemScreen(viewModel = systemVM)
            }
        }
    }
}
