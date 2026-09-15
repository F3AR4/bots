import React from 'react';
import { Construction, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export interface PlaceholderModulePageProps {
  title: string;
  moduleName: string;
  milestonePhase: string;
  description: string;
  endpointHint?: string;
}

export const PlaceholderModulePage: React.FC<PlaceholderModulePageProps> = ({
  title,
  moduleName,
  milestonePhase,
  description,
  endpointHint,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-indigo-400 font-semibold">{moduleName}</span>
            <Badge variant="paper">{milestonePhase}</Badge>
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight mt-1">{title}</h1>
        </div>

        <Link href="/overview">
          <Button variant="secondary" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Command Center
          </Button>
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/60 flex items-center justify-center text-indigo-400 mb-4 border border-slate-700/50">
          <Construction className="w-7 h-7" />
        </div>

        <h3 className="text-base font-semibold text-slate-200 mb-2">Module Foundation Ready</h3>
        <p className="text-xs text-slate-400 max-w-md mb-4">{description}</p>

        {endpointHint && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-400">
            <span>Backed by API:</span>
            <code className="text-emerald-400">{endpointHint}</code>
          </div>
        )}
      </div>
    </div>
  );
};
