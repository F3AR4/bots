package com.example.botsapp.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

/**
 * BotsApp theme — operational dark-mode control panel.
 * Always dark, no dynamic color (consistent across devices).
 */
private val BotsColorScheme = darkColorScheme(
    primary = CyberPrimary,
    onPrimary = SurfaceDark,
    primaryContainer = CyberPrimaryDark,
    onPrimaryContainer = TextPrimary,
    secondary = StatusBlue,
    onSecondary = TextPrimary,
    secondaryContainer = SurfaceElevated,
    onSecondaryContainer = TextPrimary,
    tertiary = StatusAmber,
    onTertiary = SurfaceDark,
    background = SurfaceDark,
    onBackground = TextPrimary,
    surface = SurfaceCard,
    onSurface = TextPrimary,
    surfaceVariant = SurfaceElevated,
    onSurfaceVariant = TextSecondary,
    outline = SurfaceDivider,
    error = StatusRed,
    onError = TextPrimary
)

@Composable
fun BotsAppTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = BotsColorScheme,
        typography = Typography,
        content = content
    )
}
