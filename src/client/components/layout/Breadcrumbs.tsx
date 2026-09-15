import React from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  const [location] = useLocation();

  // If custom items are provided, use them
  if (items && items.length > 0) {
    return (
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mb-3">
        <Link
          href="/"
          className="hover:text-slate-200 transition-colors flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded px-1"
        >
          <Home className="w-3.5 h-3.5" />
          <span className="sr-only">Home</span>
        </Link>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-slate-200 transition-colors focus-visible:ring-1 focus-visible:ring-indigo-500 rounded px-1"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'text-slate-200 font-semibold truncate max-w-[200px] sm:max-w-none' : ''}>
                  {item.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    );
  }

  // Derive breadcrumbs from path
  const segments = location.split('/').filter(Boolean);
  if (segments.length <= 1 && (segments[0] === 'overview' || segments.length === 0)) {
    return null; // Don't show breadcrumbs on root
  }

  const segmentLabels: Record<string, string> = {
    overview: 'Command Center',
    research: 'Research',
    wallets: 'Rankings',
    wallet: 'Wallet Profile',
    copyability: 'Copyability Lab',
    operations: 'Operations',
    signals: 'Signals',
    'paper-trades': 'Paper Trades',
    'decision-journal': 'Decision Journal',
    performance: 'Performance',
    system: 'System Health',
    ingestion: 'Ingestion Health',
    rules: 'Rules Governance',
    reports: 'Research Reports',
  };

  let accPath = '';
  const derivedItems: BreadcrumbItem[] = segments.map((seg, idx) => {
    accPath += `/${seg}`;
    const label = segmentLabels[seg] || (seg.startsWith('0x') ? `${seg.slice(0, 6)}...${seg.slice(-4)}` : seg);
    return {
      label,
      href: idx === segments.length - 1 ? undefined : accPath,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mb-3 overflow-x-auto py-0.5">
      <Link
        href="/overview"
        className="hover:text-slate-200 transition-colors flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded px-1 shrink-0"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="sr-only">Command Center</span>
      </Link>
      {derivedItems.map((item, idx) => {
        const isLast = idx === derivedItems.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-slate-200 transition-colors focus-visible:ring-1 focus-visible:ring-indigo-500 rounded px-1 shrink-0"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`shrink-0 ${isLast ? 'text-indigo-300 font-semibold' : ''}`}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
