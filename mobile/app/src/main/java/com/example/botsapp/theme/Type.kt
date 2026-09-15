package com.example.botsapp.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// ============================================================
// Typography System:
// - Asimovian (Headings / Major Titles)
// - Geomini (Body text, navigation, labels, buttons, cards)
// - Taprom (Technical accents, code, mono indicators)
// ============================================================

val AsimovianFontFamily = FontFamily.SansSerif
val GeominiFontFamily = FontFamily.Default
val TapromFontFamily = FontFamily.Monospace

val Typography = Typography(
    titleLarge = TextStyle(
        fontFamily = AsimovianFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
        letterSpacing = (-0.5).sp,
        color = TextPrimary
    ),
    titleMedium = TextStyle(
        fontFamily = AsimovianFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 24.sp,
        letterSpacing = (-0.25).sp,
        color = TextPrimary
    ),
    bodyLarge = TextStyle(
        fontFamily = GeominiFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.25.sp,
        color = TextPrimary
    ),
    bodyMedium = TextStyle(
        fontFamily = GeominiFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.2.sp,
        color = TextMuted
    ),
    labelSmall = TextStyle(
        fontFamily = TapromFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 10.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.5.sp,
        color = TextSecondary
    )
)
