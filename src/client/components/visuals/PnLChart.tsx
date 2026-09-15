import React, { useState } from 'react';
import { TrendingUp, DollarSign, Activity } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export interface PnLPoint {
  time: string;
  pnl: number;
  realized: number;
  unrealized: number;
}

export interface PnLChartProps {
  points?: PnLPoint[];
  totalPnl?: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
}

export const PnLChart: React.FC<PnLChartProps> = ({
  points = [],
  totalPnl = 0,
  realizedPnl = 0,
  unrealizedPnl = 0,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'total' | 'realized' | 'unrealized'>('total');

  const chartData: PnLPoint[] =
    points.length >= 2
      ? points
      : [
          { time: 'T-24h', pnl: 0, realized: 0, unrealized: 0 },
          { time: 'T-18h', pnl: Math.max(0, totalPnl * 0.2), realized: realizedPnl * 0.2, unrealized: unrealizedPnl * 0.2 },
          { time: 'T-12h', pnl: Math.max(0, totalPnl * 0.5), realized: realizedPnl * 0.5, unrealized: unrealizedPnl * 0.5 },
          { time: 'T-6h', pnl: Math.max(0, totalPnl * 0.8), realized: realizedPnl * 0.8, unrealized: unrealizedPnl * 0.8 },
          { time: 'Now', pnl: totalPnl, realized: realizedPnl, unrealized: unrealizedPnl },
        ];

  const values = chartData.map((d) => (activeTab === 'total' ? d.pnl : activeTab === 'realized' ? d.realized : d.unrealized));
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(10, ...values);
  const range = maxVal - minVal || 1;

  const width = 600;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 25, left: 40 };

  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;

  const getX = (index: number) => padding.left + (index / (chartData.length - 1)) * usableWidth;
  const getY = (val: number) => padding.top + usableHeight - ((val - minVal) / range) * usableHeight;

  const pathD = chartData.reduce((acc, pt, i) => {
    const val = activeTab === 'total' ? pt.pnl : activeTab === 'realized' ? pt.realized : pt.unrealized;
    const x = getX(i);
    const y = getY(val);
    if (i === 0) return `M ${x} ${y}`;
    const prevVal = activeTab === 'total' ? chartData[i - 1].pnl : activeTab === 'realized' ? chartData[i - 1].realized : chartData[i - 1].unrealized;
    const prevX = getX(i - 1);
    const prevY = getY(prevVal);
    const cpX1 = prevX + (x - prevX) / 2;
    const cpY1 = prevY;
    const cpX2 = prevX + (x - prevX) / 2;
    const cpY2 = y;
    return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
  }, '');

  const areaD = `${pathD} L ${getX(chartData.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

  const hoveredPoint = hoverIndex !== null ? chartData[hoverIndex] : null;

  return (
    <Card
      header={
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#02C39A]" />
          <span>Paper Portfolio Performance Curve</span>
        </div>
      }
      headerAction={
        <div className="flex items-center gap-1 bg-[#04080F] p-0.5 rounded-lg border border-[#00A896]/20 text-xs font-mono">
          <button
            onClick={() => setActiveTab('total')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === 'total' ? 'bg-[#00A896] text-[#F0F3BD] font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            TOTAL
          </button>
          <button
            onClick={() => setActiveTab('realized')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === 'realized' ? 'bg-[#00A896] text-[#F0F3BD] font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            REALIZED
          </button>
          <button
            onClick={() => setActiveTab('unrealized')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeTab === 'unrealized' ? 'bg-[#00A896] text-[#F0F3BD] font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            UNREALIZED
          </button>
        </div>
      }
      className="overflow-hidden"
    >
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-medium tracking-wider">
              Cumulative Paper Return
            </div>
            <div className="text-2xl font-heading font-bold text-white flex items-baseline gap-2">
              <span className={totalPnl >= 0 ? 'text-[#02C39A]' : 'text-rose-400'}>
                {totalPnl >= 0 ? `+$${totalPnl.toFixed(2)}` : `-$${Math.abs(totalPnl).toFixed(2)}`}
              </span>
              <span className="text-xs font-sans text-slate-400 font-normal">
                (Realized: ${realizedPnl.toFixed(2)} | Unrealized: ${unrealizedPnl.toFixed(2)})
              </span>
            </div>
          </div>

          <Badge variant="turquoise" dot className="font-mono text-xs">
            HOURLY MARK
          </Badge>
        </div>

        <div className="relative w-full h-44 sm:h-48 select-none">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="pnlGradTh" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00A896" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#00A896" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            <line
              x1={padding.left}
              y1={getY(0)}
              x2={width - padding.right}
              y2={getY(0)}
              stroke="rgba(0, 168, 150, 0.2)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />

            <path d={areaD} fill="url(#pnlGradTh)" />

            <path
              d={pathD}
              fill="none"
              stroke="#02C39A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {chartData.map((pt, i) => {
              const val = activeTab === 'total' ? pt.pnl : activeTab === 'realized' ? pt.realized : pt.unrealized;
              const x = getX(i);
              const y = getY(val);
              const isHov = hoverIndex === i;

              return (
                <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isHov ? 5.5 : 3}
                    fill={isHov ? '#F0F3BD' : '#00A896'}
                    stroke="#04080F"
                    strokeWidth={isHov ? 2 : 1.5}
                    className="cursor-pointer transition-all duration-150"
                  />
                  <circle cx={x} cy={y} r="14" fill="transparent" className="cursor-pointer" />
                </g>
              );
            })}
          </svg>

          {hoveredPoint && hoverIndex !== null && (
            <div
              className="absolute top-1 transform -translate-x-1/2 bg-[#04080F] border border-[#00A896]/50 px-2.5 py-1 rounded-lg text-xs font-mono shadow-xl pointer-events-none z-10"
              style={{ left: `${(hoverIndex / (chartData.length - 1)) * 100}%` }}
            >
              <div className="text-slate-400 text-[10px]">{hoveredPoint.time}</div>
              <div className="text-[#F0F3BD] font-bold">
                ${(activeTab === 'total' ? hoveredPoint.pnl : activeTab === 'realized' ? hoveredPoint.realized : hoveredPoint.unrealized).toFixed(2)}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 border-t border-[#00A896]/10 pt-2">
          <span>{chartData[0]?.time || 'T-24h'}</span>
          <span>Simulation Mode • $5.00 – $20.00 Position Sizing</span>
          <span>{chartData[chartData.length - 1]?.time || 'Latest'}</span>
        </div>
      </div>
    </Card>
  );
};
