import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface MetricProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  trend?: 'positive' | 'negative' | 'neutral' | 'warning';
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

export const Metric: React.FC<MetricProps> = ({
  title,
  value,
  subtext,
  trend = 'neutral',
  badge,
  icon,
  className,
  ...props
}) => {
  const trendColors = {
    positive: 'text-[#02C39A]',
    negative: 'text-rose-400',
    warning: 'text-[#F0F3BD]',
    neutral: 'text-[#F8FAFC]',
  };

  const isInsufficient = typeof value === 'string' && (value.includes('INSUFFICIENT') || value.includes('UNAVAILABLE'));

  return (
    <div
      className={twMerge(
        clsx(
          'p-4 sm:p-5 rounded-xl bg-[#0B192C]/90 border border-[#00A896]/16 shadow-md shadow-black/40 relative overflow-hidden transition-all duration-200 hover:border-[#02C39A]/30 group',
          className
        )
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 truncate">
          {title}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          {icon && <span className="text-[#028090] group-hover:text-[#00A896] transition-colors">{icon}</span>}
        </div>
      </div>

      <div
        className={clsx(
          'font-heading tracking-tight font-bold flex items-baseline gap-2',
          isInsufficient ? 'text-xs sm:text-sm text-slate-400 font-sans' : 'text-xl sm:text-2xl lg:text-3xl',
          trendColors[trend]
        )}
      >
        {value}
      </div>

      {subtext && (
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5 truncate">
          {subtext}
        </div>
      )}
    </div>
  );
};
