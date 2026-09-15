import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  subtle?: boolean;
  noPadding?: boolean;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  header,
  headerAction,
  subtle = false,
  noPadding = false,
  hoverable = false,
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-xl border transition-all duration-200',
          subtle 
            ? 'bg-[#07111E]/80 border-[#00A896]/10 backdrop-blur-sm' 
            : 'bg-[#0B192C]/85 border-[#00A896]/16 backdrop-blur-md shadow-lg shadow-black/50',
          hoverable && 'hover:border-[#02C39A]/30 hover:shadow-black/70',
          className
        )
      )}
      {...props}
    >
      {header && (
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#00A896]/12">
          <div className="font-heading font-semibold text-[#F8FAFC] text-sm tracking-wide flex items-center gap-2">
            {header}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4 sm:p-5'}>{children}</div>
    </div>
  );
};
