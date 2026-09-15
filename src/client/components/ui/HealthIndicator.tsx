import React from 'react';
import { clsx } from 'clsx';
import { ProviderHealthStatus } from '../../api/types';

export interface HealthIndicatorProps {
  status: ProviderHealthStatus;
  label?: string;
  showText?: boolean;
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  status,
  label,
  showText = true,
}) => {
  const config = {
    OPERATIONAL: {
      color: 'bg-emerald-500',
      text: 'text-emerald-400',
      ping: 'bg-emerald-400',
      defaultLabel: 'Operational',
    },
    DEGRADED: {
      color: 'bg-amber-500',
      text: 'text-amber-400',
      ping: 'bg-amber-400',
      defaultLabel: 'Degraded',
    },
    IDLE: {
      color: 'bg-slate-500',
      text: 'text-slate-400',
      ping: 'bg-slate-400',
      defaultLabel: 'Idle',
    },
  }[status] || {
    color: 'bg-slate-500',
    text: 'text-slate-400',
    ping: 'bg-slate-400',
    defaultLabel: status,
  };

  return (
    <div className="inline-flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        {status === 'OPERATIONAL' && (
          <span className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', config.ping)} />
        )}
        <span className={clsx('relative inline-flex rounded-full h-2 w-2', config.color)} />
      </span>
      {showText && (
        <span className={clsx('text-xs font-medium font-mono uppercase tracking-wider', config.text)}>
          {label || config.defaultLabel}
        </span>
      )}
    </div>
  );
};
