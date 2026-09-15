import React from 'react';
import { Link } from 'wouter';
import { AlertOctagon, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-950/50">
        <AlertOctagon className="w-8 h-8" />
      </div>

      <h1 className="text-xl font-bold text-slate-100 mb-2 font-mono">404: ROUTE NOT FOUND</h1>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        The requested endpoint or view does not exist in the Research Console routing table.
      </p>

      <Link href="/overview">
        <Button variant="primary" icon={<ArrowLeft className="w-4 h-4" />}>
          Return to Command Center
        </Button>
      </Link>
    </div>
  );
};
