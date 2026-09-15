import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant = 
  | 'paper'
  | 'track'
  | 'watch'
  | 'ignore'
  | 'live'
  | 'demo'
  | 'neutral'
  | 'warning'
  | 'success'
  | 'danger'
  | 'indigo'
  | 'blue'
  | 'cyan'
  | 'turquoise'
  | 'primrose';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  paper: 'bg-[#05668D]/30 text-[#F0F3BD] border-[#00A896]/40 font-mono tracking-wider',
  track: 'bg-[#00A896]/25 text-[#02C39A] border-[#02C39A]/40 font-medium',
  watch: 'bg-[#07111E] text-slate-300 border-slate-700/60 font-medium',
  ignore: 'bg-black/70 text-slate-400 border-slate-800 font-medium',
  live: 'bg-[#00A896]/25 text-[#F0F3BD] border-[#02C39A]/50 font-mono font-semibold',
  demo: 'bg-[#07111E] text-slate-300 border-slate-700 font-mono font-semibold',
  neutral: 'bg-[#07111E]/70 text-slate-300 border-slate-800 font-normal',
  warning: 'bg-[#07111E] text-[#F0F3BD] border-amber-500/40 font-medium',
  success: 'bg-[#00A896]/20 text-[#02C39A] border-[#02C39A]/40 font-medium',
  danger: 'bg-black/80 text-rose-300 border-rose-800/40 font-medium',
  indigo: 'bg-[#05668D]/30 text-[#F0F3BD] border-[#00A896]/40 font-medium',
  blue: 'bg-[#05668D]/25 text-[#02C39A] border-[#00A896]/40 font-medium',
  cyan: 'bg-[#028090]/25 text-[#F0F3BD] border-[#00A896]/40 font-medium',
  turquoise: 'bg-[#00A896]/25 text-[#02C39A] border-[#02C39A]/50 font-medium',
  primrose: 'bg-[#05668D]/40 text-[#F0F3BD] border-[#F0F3BD]/40 font-mono font-bold',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  className,
  children,
  dot = false,
  ...props
}) => {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border transition-all duration-200',
          variantStyles[variant],
          className
        )
      )}
      {...props}
    >
      {dot && (
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full shrink-0',
            variant === 'track' || variant === 'live' || variant === 'turquoise' ? 'bg-[#02C39A] animate-pulse' :
            variant === 'watch' || variant === 'demo' ? 'bg-slate-400' :
            variant === 'ignore' ? 'bg-slate-600' :
            variant === 'paper' || variant === 'primrose' ? 'bg-[#F0F3BD]' :
            variant === 'danger' ? 'bg-rose-400' : 'bg-[#028090]'
          )}
        />
      )}
      {children}
    </span>
  );
};
