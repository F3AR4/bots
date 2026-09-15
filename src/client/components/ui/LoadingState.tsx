import React from 'react';
import { clsx } from 'clsx';

export interface LoadingStateProps {
  rows?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  rows = 3,
  className,
}) => {
  return (
    <div className={clsx('space-y-3 animate-pulse', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center px-4 justify-between"
        >
          <div className="h-4 bg-slate-800 rounded w-1/3" />
          <div className="h-4 bg-slate-800 rounded w-1/4" />
          <div className="h-4 bg-slate-800 rounded w-1/6" />
        </div>
      ))}
    </div>
  );
};
