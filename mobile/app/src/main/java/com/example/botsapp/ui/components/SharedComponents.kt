package com.example.botsapp.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.botsapp.theme.*

/**
 * PAPER ONLY safety banner — permanently visible on Command Center and navigation headers.
 */
@Composable
fun PaperOnlyBanner(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(PaperBannerBackground)
            .border(1.dp, PaperBannerBorder.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
            .padding(horizontal = 14.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(Color(0xFF38BDF8))
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "PAPER TRADING ONLY — No live execution, no private keys, no signing",
                color = PaperBannerText,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

/**
 * Offline banner shown when connection to daemon is lost.
 */
@Composable
fun OfflineBanner(
    lastFetchTime: String? = null,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(StatusAmber.copy(alpha = 0.15f))
            .border(1.dp, StatusAmber.copy(alpha = 0.3f))
            .padding(horizontal = 16.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "OFFLINE MODE — Telemetry cached${if (lastFetchTime != null) " at $lastFetchTime" else ""}",
            color = StatusAmber,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

/**
 * Status indicator chip with colored dot matching Blue, White, Black system.
 */
@Composable
fun StatusChip(
    label: String,
    status: ChipStatus,
    modifier: Modifier = Modifier
) {
    val (dotColor, bgColor, borderColor) = when (status) {
        ChipStatus.HEALTHY, ChipStatus.RUNNING -> Triple(Color(0xFF38BDF8), Color(0x263B82F6), Color(0x4D3B82F6))
        ChipStatus.WARNING -> Triple(StatusAmber, StatusAmber.copy(alpha = 0.15f), StatusAmber.copy(alpha = 0.3f))
        ChipStatus.ERROR, ChipStatus.OFFLINE -> Triple(StatusRed, StatusRed.copy(alpha = 0.15f), StatusRed.copy(alpha = 0.3f))
        ChipStatus.IDLE, ChipStatus.UNKNOWN -> Triple(TextMuted, SurfaceElevated, SurfaceDivider)
    }
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(bgColor)
            .border(1.dp, borderColor, RoundedCornerShape(16.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(dotColor)
        )
        Text(
            text = label,
            color = if (status == ChipStatus.IDLE || status == ChipStatus.UNKNOWN) TextSecondary else dotColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

enum class ChipStatus {
    HEALTHY, RUNNING, WARNING, ERROR, IDLE, UNKNOWN, OFFLINE
}

/**
 * InfoCard — Obsidian surface card with subtle blue micro-border.
 */
@Composable
fun InfoCard(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, SurfaceDivider, RoundedCornerShape(12.dp)),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = title,
                color = TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
            )
            Spacer(modifier = Modifier.height(10.dp))
            content()
        }
    }
}

/**
 * MetricCard — Minimalist high-contrast KPI display.
 */
@Composable
fun MetricCard(
    title: String,
    value: String,
    valueColor: Color = TextPrimary,
    subtext: String? = null,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .border(1.dp, SurfaceDivider, RoundedCornerShape(12.dp)),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = title,
                color = TextMuted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value,
                color = valueColor,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            if (subtext != null) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = subtext,
                    color = TextMuted,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

/**
 * DataRow — Key/value row for tabular detail sections.
 */
@Composable
fun DataRow(
    label: String,
    value: String,
    valueColor: Color = TextPrimary,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            color = TextMuted,
            fontSize = 12.sp
        )
        Text(
            text = value,
            color = valueColor,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

/**
 * PnlDisplay — Large or compact formatted PnL metric.
 */
@Composable
fun PnlDisplay(
    label: String,
    pnl: Double,
    large: Boolean = false,
    modifier: Modifier = Modifier
) {
    val color = when {
        pnl > 0 -> PnlPositive
        pnl < 0 -> PnlNegative
        else -> PnlNeutral
    }
    val sign = if (pnl > 0) "+" else ""
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = label, style = MaterialTheme.typography.labelSmall, color = TextSecondary)
        Text(
            text = "$sign$${String.format("%.2f", pnl)}",
            fontSize = if (large) 24.sp else 16.sp,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

/**
 * LoadingSkeleton — Placeholder while fetching data.
 */
@Composable
fun LoadingSkeleton(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(120.dp)
            .padding(16.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceCard),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            color = CyberPrimary,
            modifier = Modifier.size(28.dp)
        )
    }
}

/**
 * EmptyState — User-friendly message for zero items.
 */
@Composable
fun EmptyState(
    message: String,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = message,
            color = TextMuted,
            fontSize = 13.sp,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * ErrorState — Error message with retry button.
 */
@Composable
fun ErrorState(
    message: String,
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = message,
            color = StatusRed,
            fontSize = 13.sp,
            textAlign = TextAlign.Center
        )
        if (onRetry != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = onRetry,
                colors = ButtonDefaults.buttonColors(containerColor = CyberPrimary)
            ) {
                Text("Retry", color = Color.White, fontSize = 12.sp)
            }
        }
    }
}

/**
 * Native Jetpack Compose Mini PnL Sparkline Chart.
 */
@Composable
fun MiniPnLChart(
    points: List<Double>,
    totalPnl: Double,
    modifier: Modifier = Modifier
) {
    val effectivePoints = if (points.size >= 2) points else listOf(0.0, totalPnl * 0.3, totalPnl * 0.7, totalPnl)
    val minVal = effectivePoints.minOrNull() ?: 0.0
    val maxVal = effectivePoints.maxOrNull() ?: 10.0
    val range = if (maxVal - minVal == 0.0) 1.0 else (maxVal - minVal)

    val lineColor = if (totalPnl >= 0) Color(0xFF38BDF8) else Color(0xFFF87171)
    val areaGrad = Brush.verticalGradient(
        colors = listOf(lineColor.copy(alpha = 0.35f), Color.Transparent)
    )

    Card(
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, SurfaceDivider, RoundedCornerShape(12.dp)),
        colors = CardDefaults.cardColors(containerColor = SurfaceCard),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "PAPER PNL CURVE",
                    color = TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (totalPnl >= 0) "+$${String.format("%.2f", totalPnl)}" else "-$${String.format("%.2f", Math.abs(totalPnl))}",
                    color = if (totalPnl >= 0) PnlPositive else PnlNegative,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Canvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
            ) {
                val w = size.width
                val h = size.height
                val n = effectivePoints.size

                val path = Path()
                val fillPath = Path()

                effectivePoints.forEachIndexed { i, pt ->
                    val x = (i.toFloat() / (n - 1).toFloat()) * w
                    val y = h - (((pt - minVal) / range).toFloat() * (h - 12f) + 6f)

                    if (i == 0) {
                        path.moveTo(x, y)
                        fillPath.moveTo(x, h)
                        fillPath.lineTo(x, y)
                    } else {
                        val prevPt = effectivePoints[i - 1]
                        val prevX = ((i - 1).toFloat() / (n - 1).toFloat()) * w
                        val prevY = h - (((prevPt - minVal) / range).toFloat() * (h - 12f) + 6f)
                        val cx1 = prevX + (x - prevX) / 2
                        val cx2 = cx1
                        path.cubicTo(cx1, prevY, cx2, y, x, y)
                        fillPath.cubicTo(cx1, prevY, cx2, y, x, y)
                    }
                }

                fillPath.lineTo(w, h)
                fillPath.close()

                drawPath(fillPath, brush = areaGrad)
                drawPath(path, color = lineColor, style = Stroke(width = 4f))
            }
        }
    }
}

/**
 * PnL formatted text component.
 */
@Composable
fun PnlText(
    pnl: Double,
    modifier: Modifier = Modifier,
    fontSize: Int = 14,
    prefix: String = ""
) {
    val color = when {
        pnl > 0 -> PnlPositive
        pnl < 0 -> PnlNegative
        else -> PnlNeutral
    }
    val sign = if (pnl > 0) "+" else ""
    Text(
        text = "$prefix$sign$${String.format("%.2f", pnl)}",
        color = color,
        fontSize = fontSize.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier
    )
}

/**
 * Styled progress bar matching the dark blue theme.
 */
@Composable
fun ProgressBar(
    progress: Float,
    modifier: Modifier = Modifier,
    color: Color = CyberPrimary
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(6.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(SurfaceElevated)
    ) {
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(progress.coerceIn(0f, 1f))
                .clip(RoundedCornerShape(3.dp))
                .background(color)
        )
    }
}
