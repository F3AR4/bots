import React, { useState, useEffect } from 'react';
import { Menu, Activity, RefreshCw } from 'lucide-react';
import { HealthIndicator } from '../ui/HealthIndicator';
import { FreshnessIndicator } from '../ui/FreshnessIndicator';
import { Badge } from '../ui/Badge';
import { EngineLifecycleControl } from '../ui/EngineLifecycleControl';
import { HorizontalNav } from './HorizontalNav';
import { useIngestionStatus, useSystemStatus } from '../../hooks/useDashboardData';

export interface TopBarProps {
  onMenuToggle?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuToggle }) => {
  const { data: ingestion } = useIngestionStatus();
  const { data: status, isFetching, refetch } = useSystemStatus();
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setTimeStr(new Date().toLocaleTimeString(undefined, { hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const dataMode = ingestion?.dataMode || status?.dataMode || 'LIVE READ-ONLY DATA';
  const providerStatus = ingestion?.providerHealth?.status || 'OPERATIONAL';

  return (
    <header className="sticky top-0 z-40 bg-[#04080F]/95 backdrop-blur-xl border-b border-[#00A896]/15 shadow-sm">
      <div className="px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#07111E] transition-colors focus-visible:ring-2 focus-visible:ring-[#00A896] focus-visible:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#05668D]/20 border border-[#00A896]/30 flex items-center justify-center text-[#02C39A] shrink-0">
              <Activity className="w-4 h-4 text-[#02C39A]" />
            </div>
            <div>
              <div className="font-heading text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span className="truncate">Research Console</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#07111E] text-[#F0F3BD] border border-[#00A896]/30">
                  v1.14
                </span>
              </div>
              <div className="text-[11px] text-slate-400 hidden lg:block">
                Polymarket Copy-Trading Research & Paper Workstation
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Engine Lifecycle State Pill */}
          <EngineLifecycleControl compact />

          <div className="hidden xl:flex items-center gap-3 pr-3 border-r border-[#00A896]/15">
            <HealthIndicator status={providerStatus} />
            <FreshnessIndicator
              lastIngestionTime={ingestion?.dataFreshness?.lastIngestionTime || null}
              ageSeconds={ingestion?.dataFreshness?.ageSeconds || null}
              freshnessLabel={ingestion?.dataFreshness?.freshnessLabel}
            />
          </div>

          <Badge
            variant={dataMode === 'LIVE READ-ONLY DATA' ? 'live' : 'demo'}
            dot
            className="hidden sm:inline-flex"
          >
            {dataMode}
          </Badge>

          <div className="font-mono text-xs text-[#F0F3BD] px-2.5 py-1 rounded bg-[#07111E] border border-[#00A896]/20 hidden sm:block">
            {timeStr || '--:--:--'}
          </div>

          <button
            onClick={() => refetch()}
            title="Refresh telemetry"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#07111E] transition-colors focus-visible:ring-2 focus-visible:ring-[#00A896] focus-visible:outline-none"
            aria-label="Refresh telemetry data"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#02C39A]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Horizontal Category Navigation Bar */}
      <HorizontalNav />
    </header>
  );
};
