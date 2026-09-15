import React from 'react';
import { Terminal, Database } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description: string;
  command?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  command,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
      <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-4">
        {icon || <Database className="w-6 h-6" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 max-w-sm mb-4">{description}</p>
      {command && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300">
          <Terminal className="w-3.5 h-3.5 text-slate-500" />
          <code>{command}</code>
        </div>
      )}
    </div>
  );
};
