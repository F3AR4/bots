import React, { useState } from 'react';
import { Play, Square, Activity, AlertTriangle, ShieldCheck, Info, RefreshCw, Cpu, Loader2 } from 'lucide-react';
import { Badge } from './Badge';
import { useMonitorStatus, useStartEngine, useStopEngine } from '../../hooks/useOperationsData';

export type EngineLifecycleState = 
  | 'STOPPED' 
  | 'STARTING' 
  | 'RUNNING' 
  | 'STOPPING' 
  | 'ERROR' 
  | 'UNKNOWN';

export interface EngineLifecycleControlProps {
  compact?: boolean;
  showDetails?: boolean;
}

export const EngineLifecycleControl: React.FC<EngineLifecycleControlProps> = ({
  compact = false,
  showDetails = true,
}) => {
  const { data: monitorData, isLoading } = useMonitorStatus();
  const startMutation = useStartEngine();
  const stopMutation = useStopEngine();
  const [actionError, setActionError] = useState<string | null>(null);
  
  const obs = monitorData?.observability;
  const rawStatus = (obs?.engineLifecycleState || obs?.monitorProcessStatus || monitorData?.walletMonitorStatus) as string | undefined;

  // Map backend status to engine lifecycle state
  let engineState: EngineLifecycleState = 'UNKNOWN';
  if (startMutation.isPending) {
    engineState = 'STARTING';
  } else if (stopMutation.isPending) {
    engineState = 'STOPPING';
  } else if (isLoading) {
    engineState = 'UNKNOWN';
  } else if (rawStatus === 'RUNNING') {
    engineState = 'RUNNING';
  } else if (rawStatus === 'STARTING') {
    engineState = 'STARTING';
  } else if (rawStatus === 'STOPPING') {
    engineState = 'STOPPING';
  } else if (rawStatus === 'IDLE' || rawStatus === 'STOPPED' || monitorData?.paperEngineStatus === 'STOPPED') {
    engineState = 'STOPPED';
  } else if (rawStatus === 'ERROR' || monitorData?.ingestionStatus === 'FAILED') {
    engineState = 'ERROR';
  } else if (rawStatus === 'STALE') {
    engineState = 'RUNNING'; // running but stale cycle
  }

  const isStale = rawStatus === 'STALE' || obs?.currentDataFreshness === 'STALE';
  const isTransitioning = engineState === 'STARTING' || engineState === 'STOPPING' || startMutation.isPending || stopMutation.isPending;

  const handleStart = async () => {
    setActionError(null);
    try {
      await startMutation.mutateAsync();
    } catch (err: any) {
      setActionError(err.message || 'Failed to start engine');
    }
  };

  const handleStop = async () => {
    setActionError(null);
    try {
      await stopMutation.mutateAsync();
    } catch (err: any) {
      setActionError(err.message || 'Failed to stop engine');
    }
  };

  const getStateColor = (state: EngineLifecycleState) => {
    switch (state) {
      case 'RUNNING':
        return isStale 
          ? { bg: 'bg-amber-950/40', border: 'border-amber-500/40', text: 'text-amber-300', dot: 'bg-amber-400 animate-pulse' }
          : { bg: 'bg-emerald-950/40', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400 animate-pulse' };
      case 'STARTING':
      case 'STOPPING':
        return { bg: 'bg-blue-950/40', border: 'border-blue-500/40', text: 'text-blue-300', dot: 'bg-blue-400 animate-ping' };
      case 'STOPPED':
        return { bg: 'bg-slate-900', border: 'border-slate-800', text: 'text-slate-400', dot: 'bg-slate-500' };
      case 'ERROR':
        return { bg: 'bg-rose-950/40', border: 'border-rose-500/40', text: 'text-rose-300', dot: 'bg-rose-400 animate-pulse' };
      case 'UNKNOWN':
      default:
        return { bg: 'bg-slate-900', border: 'border-slate-800', text: 'text-slate-400', dot: 'bg-slate-600' };
    }
  };

  const stateTheme = getStateColor(engineState);

  if (compact) {
    return (
      <div 
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono ${stateTheme.bg} ${stateTheme.border} ${stateTheme.text}`}
        title={`Engine State: ${engineState}${isStale ? ' (Cycle Stale)' : ''}`}
      >
        <span className={`w-2 h-2 rounded-full ${stateTheme.dot}`} />
        <span className="font-semibold">{engineState}</span>
        {isStale && <span className="text-[10px] text-amber-400 font-normal">STALE</span>}
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border ${stateTheme.bg} ${stateTheme.border} space-y-3 transition-colors`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 shrink-0">
            <Cpu className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 tracking-wide font-mono">
                ENGINE DAEMON STATUS
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${stateTheme.bg} ${stateTheme.border} ${stateTheme.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stateTheme.dot}`} />
                {engineState}
                {isStale && <span className="text-amber-400 font-normal ml-1">(STALE)</span>}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Single backend paper-trading engine observed concurrently by Web & future Mobile client.
            </p>
          </div>
        </div>

        {/* Real Daemon Control Actions */}
        <div className="flex items-center gap-2">
          {engineState === 'RUNNING' ? (
            <button
              onClick={handleStop}
              disabled={isTransitioning}
              aria-label="Stop Engine"
              className={`px-3 py-1.5 rounded-lg bg-rose-900/60 border border-rose-700 text-rose-200 hover:bg-rose-800 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${isTransitioning ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-95'}`}
              title="Stop persistent background paper-trading runtime"
            >
              {isTransitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
              <span>{isTransitioning ? 'Stopping...' : 'Stop Engine'}</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={isTransitioning}
              aria-label="Start Engine"
              className={`px-3 py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-600 text-emerald-200 hover:bg-emerald-800 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${isTransitioning ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-95'}`}
              title="Start persistent background paper-trading runtime"
            >
              {isTransitioning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isTransitioning ? 'Starting...' : 'Start Engine'}</span>
            </button>
          )}

          <span className="text-[10px] font-mono text-slate-400 px-2 py-1 rounded bg-slate-950/60 border border-slate-800">
            Task 2.0 Runtime
          </span>
        </div>
      </div>

      {actionError && (
        <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Control Error: {actionError}</span>
        </div>
      )}

      {showDetails && (
        <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Execution Invariant:</span>
            <span className="text-emerald-400 font-semibold">STRICTLY PAPER ONLY</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Client Disconnection Persistence:</span>
            <span className="text-slate-200">Server daemon persists independently</span>
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800">
            <span className="font-semibold text-slate-300">Architecture Guarantee: </span>
            The paper-trading engine runs autonomously on the server. Closing the web browser or disconnecting a phone will not terminate background observation or mark-to-market valuations.
          </div>
        </div>
      )}
    </div>
  );
};
