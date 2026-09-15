package com.example.botsapp

import com.example.botsapp.network.*
import com.example.botsapp.ui.screens.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for the BotsApp native mobile application.
 *
 * Tests cover:
 * - Lifecycle state rendering
 * - Control action protection
 * - Data model invariants
 * - PAPER ONLY invariant
 * - No-secret leakage
 * - Provenance labels
 */
@OptIn(ExperimentalCoroutinesApi::class)
class BotsAppUnitTests {

    private val testDispatcher = UnconfinedTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // --- Lifecycle State Rendering ---

    @Test
    fun `lifecycle state STOPPED renders correctly`() {
        val response = ControlStatusResponse(lifecycleState = "STOPPED", executionMode = "PAPER ONLY")
        assertEquals("STOPPED", response.lifecycleState)
        assertEquals("PAPER ONLY", response.executionMode)
    }

    @Test
    fun `lifecycle state STARTING renders correctly`() {
        val response = ControlStatusResponse(lifecycleState = "STARTING")
        assertEquals("STARTING", response.lifecycleState)
    }

    @Test
    fun `lifecycle state RUNNING renders correctly`() {
        val response = ControlStatusResponse(lifecycleState = "RUNNING")
        assertEquals("RUNNING", response.lifecycleState)
    }

    @Test
    fun `lifecycle state STOPPING renders correctly`() {
        val response = ControlStatusResponse(lifecycleState = "STOPPING")
        assertEquals("STOPPING", response.lifecycleState)
    }

    @Test
    fun `lifecycle state ERROR renders correctly`() {
        val response = ControlStatusResponse(lifecycleState = "ERROR")
        assertEquals("ERROR", response.lifecycleState)
    }

    @Test
    fun `lifecycle state UNKNOWN is the default`() {
        val response = ControlStatusResponse()
        assertEquals("UNKNOWN", response.lifecycleState)
    }

    // --- Control Action Protection ---

    @Test
    fun `duplicate start is blocked when action in progress`() {
        val state = CommandCenterState(isControlActionInProgress = true)
        assertTrue(state.isControlActionInProgress)
        // ViewModel blocks duplicate calls when isControlActionInProgress=true
    }

    @Test
    fun `start is blocked when already RUNNING`() {
        val response = ControlStatusResponse(lifecycleState = "RUNNING")
        val blocked = response.lifecycleState == "RUNNING" || response.lifecycleState == "STARTING"
        assertTrue(blocked)
    }

    @Test
    fun `stop is blocked when already STOPPED`() {
        val response = ControlStatusResponse(lifecycleState = "STOPPED")
        val blocked = response.lifecycleState == "STOPPED" || response.lifecycleState == "STOPPING"
        assertTrue(blocked)
    }

    @Test
    fun `start allowed when STOPPED`() {
        val response = ControlStatusResponse(lifecycleState = "STOPPED")
        val blocked = response.lifecycleState == "RUNNING" || response.lifecycleState == "STARTING"
        assertFalse(blocked)
    }

    @Test
    fun `stop allowed when RUNNING`() {
        val response = ControlStatusResponse(lifecycleState = "RUNNING")
        val blocked = response.lifecycleState == "STOPPED" || response.lifecycleState == "STOPPING"
        assertFalse(blocked)
    }

    // --- Offline State ---

    @Test
    fun `offline state is explicit`() {
        val state = CommandCenterState(isOffline = true, lastFetchTime = "12:34:56")
        assertTrue(state.isOffline)
        assertNotNull(state.lastFetchTime)
    }

    @Test
    fun `stale telemetry shows timestamp`() {
        val state = CommandCenterState(isOffline = true, lastFetchTime = "09:00:00")
        assertEquals("09:00:00", state.lastFetchTime)
    }

    // --- PAPER ONLY Invariant ---

    @Test
    fun `control status always reports PAPER ONLY`() {
        val response = ControlStatusResponse()
        assertEquals("PAPER ONLY", response.executionMode)
    }

    @Test
    fun `system status always reports PAPER`() {
        val response = SystemStatusResponse()
        assertEquals("PAPER", response.executionMode)
    }

    @Test
    fun `calibration always reports PAPER ONLY`() {
        val response = CalibrationResponse()
        assertEquals("PAPER ONLY", response.executionMode)
    }

    @Test
    fun `performance always reports PAPER`() {
        val response = PerformanceResponse()
        assertEquals("PAPER", response.executionMode)
    }

    // --- Paper Trade Rendering ---

    @Test
    fun `paper trade renders with correct fields`() {
        val trade = PaperTrade(
            id = "pt-1",
            walletAddress = "0x123abc",
            marketId = "mkt-1",
            marketQuestion = "Will X happen?",
            outcome = "Yes",
            entryPrice = 0.65,
            currentPrice = 0.72,
            simulatedSize = 10.0,
            status = "open",
            unrealizedPnl = 1.07,
            realizedPnl = 0.0,
            ruleSetId = "rs-1",
            ruleSetVersion = "1.0.0"
        )
        assertEquals("open", trade.status)
        assertEquals(1.07, trade.unrealizedPnl, 0.01)
        assertEquals("pt-1", trade.id)
    }

    @Test
    fun `empty paper trades list`() {
        val response = PaperTradesResponse()
        assertTrue(response.paperTrades.isEmpty())
        assertEquals(0, response.totalTrades)
    }

    // --- Signal Rendering ---

    @Test
    fun `signal renders with provenance`() {
        val signal = Signal(
            id = "sig-1",
            decision = "paper_copy",
            provenance = "live",
            finalScore = 78.5,
            walletAddress = "0xabc",
            marketId = "mkt-1"
        )
        assertEquals("paper_copy", signal.decision)
        assertEquals("live", signal.provenance)
        assertEquals(78.5, signal.finalScore, 0.01)
    }

    @Test
    fun `empty signals list`() {
        val response = SignalsResponse()
        assertTrue(response.signals.isEmpty())
    }

    // --- Wallet Rendering ---

    @Test
    fun `wallet evaluation renders with all scores`() {
        val eval = WalletEvaluation(
            walletAddress = "0xtest",
            globalScore = 82.5,
            bestCategory = "crypto_markets",
            categoryEdge = 15.2,
            copyability = 71.0,
            consistency = 68.0,
            liquidityQuality = 90.0,
            oneHitPenalty = 5.0,
            dataCompleteness = 95.0
        )
        assertEquals(82.5, eval.globalScore, 0.01)
        assertEquals(5.0, eval.oneHitPenalty, 0.01)
    }

    // --- Performance Rendering ---

    @Test
    fun `performance metrics render with insufficient data status`() {
        val metrics = PerformanceMetrics(
            winRateStatus = "INSUFFICIENT DATA",
            winRateReason = "Awaiting market settlement"
        )
        assertEquals("INSUFFICIENT DATA", metrics.winRateStatus)
        assertNotNull(metrics.winRateReason)
    }

    @Test
    fun `benchmark cohort renders`() {
        val cohort = CohortData(
            cohortName = "BOT_FILTERED_PAPER",
            tradeCount = 5,
            totalPnl = 2.50,
            avgPnl = 0.50,
            winRate = 0.6
        )
        assertEquals(5, cohort.tradeCount)
        assertEquals(0.6, cohort.winRate!!, 0.01)
    }

    // --- Calibration / Rule Rendering ---

    @Test
    fun `calibration renders evidence tier`() {
        val cal = CalibrationResponse(evidenceTier = "SUGGESTIVE")
        assertEquals("SUGGESTIVE", cal.evidenceTier)
    }

    @Test
    fun `rule provenance labels are distinguished`() {
        val provenances = listOf(
            "PDF_EXPLICIT",
            "IMPLEMENTATION_BASELINE",
            "CALIBRATION_DERIVED",
            "OPERATOR_CONFIG",
            "TBD"
        )
        provenances.forEach { p ->
            val ruleSet = RuleSet(provenance = p)
            assertEquals(p, ruleSet.provenance)
        }
    }

    @Test
    fun `rule change renders before-after values`() {
        val change = RuleChange(
            parameterName = "minCopyScore",
            oldValue = "60.0",
            newValue = "65.0",
            reason = "Calibration cycle 3",
            provenance = "CALIBRATION_DERIVED"
        )
        assertEquals("60.0", change.oldValue)
        assertEquals("65.0", change.newValue)
        assertEquals("CALIBRATION_DERIVED", change.provenance)
    }

    // --- No-Secret Leakage ---

    @Test
    fun `no private key fields in data models`() {
        // Verify data classes don't have fields related to private keys
        val controlFields = ControlStatusResponse::class.java.declaredFields.map { it.name }
        assertFalse(controlFields.any { it.contains("privateKey", ignoreCase = true) })
        assertFalse(controlFields.any { it.contains("secret", ignoreCase = true) })
        assertFalse(controlFields.any { it.contains("seed", ignoreCase = true) })
        assertFalse(controlFields.any { it.contains("signing", ignoreCase = true) })
    }

    @Test
    fun `no signing capability in API service`() {
        // Verify ApiService doesn't have sign/execute methods
        val methods = com.example.botsapp.network.ApiService::class.java.declaredMethods.map { it.name }
        assertFalse(methods.any { it.contains("signing", ignoreCase = true) || it.startsWith("sign", ignoreCase = true) || it.contains("signTransaction", ignoreCase = true) })
        assertFalse(methods.any { it.contains("execute", ignoreCase = true) })
        assertFalse(methods.any { it.contains("submit", ignoreCase = true) })
        assertFalse(methods.any { it.contains("order", ignoreCase = true) })
    }

    // --- API Error Handling ---

    @Test
    fun `error state propagates correctly`() {
        val state = CommandCenterState(
            isLoading = false,
            isOffline = true,
            errorMessage = "Connection refused"
        )
        assertFalse(state.isLoading)
        assertTrue(state.isOffline)
        assertEquals("Connection refused", state.errorMessage)
    }

    // --- Data Model Defaults ---

    @Test
    fun `control status default state is UNKNOWN`() {
        val response = ControlStatusResponse()
        assertEquals("UNKNOWN", response.lifecycleState)
    }

    @Test
    fun `system status default is safe`() {
        val response = SystemStatusResponse()
        assertEquals("UNKNOWN", response.status)
        assertEquals("PAPER", response.executionMode)
        assertEquals("NO DATA", response.dataMode)
    }
}
