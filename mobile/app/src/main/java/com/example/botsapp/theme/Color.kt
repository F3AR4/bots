package com.example.botsapp.theme

import androidx.compose.ui.graphics.Color

// ============================================================
// Exact Turquoise Harmony Palette (Mobile)
// #05668D, #028090, #00A896, #02C39A, #F0F3BD
// ============================================================

// Brand Primary Tokens
val TurquoiseDeepOcean = Color(0xFF05668D)
val TurquoiseTeal = Color(0xFF028090)
val TurquoiseGreen = Color(0xFF00A896)
val TurquoiseMint = Color(0xFF02C39A)
val TurquoisePrimrose = Color(0xFFF0F3BD)

// Operational App Tokens
val CyberPrimary = TurquoiseGreen
val CyberPrimaryDark = TurquoiseDeepOcean
val CyberPrimaryLight = TurquoiseMint

// Surface Hierarchy (Dark / Obsidian with Turquoise Glass Tint)
val SurfaceDark = Color(0xFF04080F)
val SurfaceCard = Color(0xFF07111E)
val SurfaceElevated = Color(0xFF0B192C)
val SurfaceDivider = Color(0x2B00A896) // 17% Turquoise border

// Text & Typography Hierarchy
val TextPrimary = Color(0xFFFFFFFF)
val TextSecondary = TurquoisePrimrose
val TextMuted = Color(0xFF94A3B8)

// Status & Metric Highlights
val StatusGreen = TurquoiseMint
val StatusRed = Color(0xFFF87171)
val StatusAmber = TurquoisePrimrose
val StatusBlue = TurquoiseTeal

// PAPER ONLY Safety Invariant Banner
val PaperBannerBackground = Color(0xFF04080F)
val PaperBannerText = TurquoisePrimrose
val PaperBannerBorder = TurquoiseMint

// PnL Visuals
val PnlPositive = TurquoiseMint
val PnlNegative = Color(0xFFF87171)
val PnlNeutral = Color(0xFF94A3B8)

// Legacy Fallbacks
val Purple80 = TurquoisePrimrose
val PurpleGrey80 = Color(0xFF94A3B8)
val Pink80 = TurquoiseMint
val Purple40 = TurquoiseDeepOcean
val PurpleGrey40 = Color(0xFF07111E)
val Pink40 = TurquoiseTeal
