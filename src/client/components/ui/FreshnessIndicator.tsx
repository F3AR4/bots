import React from 'react';
import { Clock } from 'lucide-react';
import { clsx } from 'clsx';

export interface FreshnessIndicatorProps {
  lastIngestionTime: string | null;
  ageSeconds: number | null;
  freshnessLabel?: string;
}

export const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({
  lastIngestionTime,
  ageSeconds,
  freshnessLabel,
}) => {
  if (!lastIngestionTime || ageSeconds === null) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-mono">
        <Clock className="w-3.5 h-3.5 text-slate-600" />
        <span>NO INGESTION DATA</span>
      </div>
    );
  }

  const isStale = ageSeconds > 3600;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-mono">
      <Clock className={clsx('w-3.5 h-3.5', isStale ? 'text-amber-500' : 'text-slate-400')} />
      <span className={isStale ? 'text-amber-400' : 'text-slate-300'}>
        {freshnessLabel || (ageSeconds < 60 ? `${ageSeconds}s ago` : `${Math.floor(ageSeconds / 60)}m ago`)}
      </span>
    </div>
  );
};
