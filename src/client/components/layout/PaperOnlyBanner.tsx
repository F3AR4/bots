import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const PaperOnlyBanner: React.FC = () => {
  return (
    <aside
      aria-label="Paper Mode Safety Notice"
      className="bg-[#04080F] border-b border-[#00A896]/30 px-3 sm:px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-md z-50 sticky top-0"
    >
      <div className="flex items-center gap-2 text-slate-200">
        <ShieldCheck className="w-4 h-4 text-[#02C39A] shrink-0" />
        <span className="font-bold tracking-wider uppercase text-[11px] text-[#F0F3BD] font-mono bg-[#05668D]/40 px-2 py-0.5 rounded border border-[#00A896]/40">
          PAPER ONLY
        </span>
        <span className="text-slate-100 font-medium">
          No real-money execution.
        </span>
        <span className="text-slate-400 hidden md:inline">
          Live orders, private keys, and transaction signing are permanently disabled.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#07111E] border border-[#00A896]/30 text-[#F0F3BD] font-mono text-[10px] sm:text-[11px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#02C39A] animate-pulse" />
          SIMULATION SAFEGUARD ACTIVE
        </span>
      </div>
    </aside>
  );
};
