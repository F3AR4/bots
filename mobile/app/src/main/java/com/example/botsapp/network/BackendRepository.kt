package com.example.botsapp.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Repository wrapping all backend API calls.
 *
 * All methods return Result<T> to enable graceful error handling.
 * The repository is stateless — the backend daemon is the single source of truth.
 *
 * Safety: No local caching of state that could be mistaken for live data.
 * Cached results must always be displayed with their timestamp.
 */
class BackendRepository(
    private val api: ApiService = ApiClient.service
) {

    // --- Lifecycle Control ---

    suspend fun getControlStatus(): Result<ControlStatusResponse> = safeCall {
        api.getControlStatus()
    }

    suspend fun startRuntime(): Result<ControlActionResponse> = safeCall {
        api.startRuntime()
    }

    suspend fun stopRuntime(): Result<ControlActionResponse> = safeCall {
        api.stopRuntime()
    }

    // --- System Status ---

    suspend fun getSystemStatus(): Result<SystemStatusResponse> = safeCall {
        api.getSystemStatus()
    }

    // --- Monitor ---

    suspend fun getMonitorStatus(): Result<MonitorStatusResponse> = safeCall {
        api.getMonitorStatus()
    }

    // --- Paper Trades ---

    suspend fun getPaperTrades(): Result<PaperTradesResponse> = safeCall {
        api.getPaperTrades()
    }

    // --- Signals ---

    suspend fun getSignals(): Result<SignalsResponse> = safeCall {
        api.getSignals()
    }

    // --- Wallets ---

    suspend fun getWallets(): Result<WalletsResponse> = safeCall {
        api.getWallets()
    }

    // --- Performance ---

    suspend fun getPerformance(): Result<PerformanceResponse> = safeCall {
        api.getPerformance()
    }

    // --- Calibration ---

    suspend fun getCalibration(): Result<CalibrationResponse> = safeCall {
        api.getCalibration()
    }

    // --- Rules ---

    suspend fun getRules(): Result<RulesResponse> = safeCall {
        api.getRules()
    }

    // --- Ingestion ---

    suspend fun getIngestionHealth(): Result<IngestionHealthResponse> = safeCall {
        api.getIngestionHealth()
    }

    // --- Helper ---

    private suspend fun <T> safeCall(call: suspend () -> T): Result<T> {
        return withContext(Dispatchers.IO) {
            try {
                Result.success(call())
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
}
