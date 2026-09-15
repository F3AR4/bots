package com.example.botsapp.network

import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Retrofit service interface for the paper-trading daemon backend.
 *
 * Safety: All endpoints are read-only observations or lifecycle control.
 * No signing, no private keys, no live execution endpoints.
 */
interface ApiService {

    // --- Lifecycle Control ---
    @GET("api/v1/control/status")
    suspend fun getControlStatus(): ControlStatusResponse

    @POST("api/v1/mobile/control/start")
    suspend fun startRuntime(): ControlActionResponse

    @POST("api/v1/mobile/control/stop")
    suspend fun stopRuntime(): ControlActionResponse

    // --- System Status (Command Center) ---
    @GET("api/v1/mobile/status")
    suspend fun getSystemStatus(): SystemStatusResponse

    // --- Monitor / Observability ---
    @GET("api/v1/mobile/monitor")
    suspend fun getMonitorStatus(): MonitorStatusResponse

    // --- Paper Trades ---
    @GET("api/v1/paper-trades")
    suspend fun getPaperTrades(): PaperTradesResponse

    // --- Signals ---
    @GET("api/v1/mobile/signals")
    suspend fun getSignals(): SignalsResponse

    // --- Wallets ---
    @GET("api/v1/mobile/wallets")
    suspend fun getWallets(): WalletsResponse

    // --- Performance ---
    @GET("api/v1/mobile/performance")
    suspend fun getPerformance(): PerformanceResponse

    // --- Calibration ---
    @GET("api/v1/mobile/calibration")
    suspend fun getCalibration(): CalibrationResponse

    // --- Rules ---
    @GET("api/v1/rules")
    suspend fun getRules(): RulesResponse

    // --- Ingestion Health ---
    @GET("api/v1/mobile/ingestion")
    suspend fun getIngestionHealth(): IngestionHealthResponse
}
