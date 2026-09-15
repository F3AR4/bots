import React from 'react';
import { useLocation, Link } from 'wouter';
import {
  LayoutDashboard,
  Users,
  GitCompare,
  Radio,
  FileCheck2,
  BookOpen,
  TrendingUp,
  Server,
  Database,
  Sliders,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavTab {
  label: string;
  path: string;
  icon: React.ReactNode;
  matchPrefix?: boolean;
}

export const HorizontalNav: React.FC = () => {
  const [location] = useLocation();

  const tabs: NavTab[] = [
    {
      label: 'Overview',
      path: '/overview',
      icon: <LayoutDashboard className="w-3.5 h-3.5" />,
    },
    {
      label: 'Wallets',
      path: '/research/wallets',
      icon: <Users className="w-3.5 h-3.5" />,
      matchPrefix: true,
    },
    {
      label: 'Copyability',
      path: '/research/copyability',
      icon: <GitCompare className="w-3.5 h-3.5" />,
    },
    {
      label: 'Signals',
      path: '/operations/signals',
      icon: <Radio className="w-3.5 h-3.5" />,
    },
    {
      label: 'Paper Trades',
      path: '/operations/paper-trades',
      icon: <FileCheck2 className="w-3.5 h-3.5" />,
    },
    {
      label: 'Journal',
      path: '/operations/decision-journal',
      icon: <BookOpen className="w-3.5 h-3.5" />,
    },
    {
      label: 'Performance',
      path: '/performance',
      icon: <TrendingUp className="w-3.5 h-3.5" />,
    },
    {
      label: 'Health',
      path: '/system',
      icon: <Server className="w-3.5 h-3.5" />,
    },
    {
      label: 'Ingestion',
      path: '/system/ingestion',
      icon: <Database className="w-3.5 h-3.5" />,
    },
    {
      label: 'Rules',
      path: '/system/rules',
      icon: <Sliders className="w-3.5 h-3.5" />,
    },
    {
      label: 'Reports',
      path: '/system/reports',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
  ];

  const isTabActive = (tab: NavTab) => {
    if (tab.path === '/overview') {
      return location === '/' || location === '/overview';
    }
    if (tab.path === '/system') {
      return location === '/system';
    }
    if (tab.matchPrefix) {
      return location.startsWith('/research/wallet');
    }
    return location === tab.path || location.startsWith(tab.path + '/');
  };

  return (
    <nav
      aria-label="Horizontal Navigation"
      className="border-t border-[#00A896]/15 bg-[#03060C]/90 backdrop-blur-md px-2 sm:px-4 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none"
    >
      <div className="flex items-center gap-1 py-1.5 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const active = isTabActive(tab);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'relative flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all duration-200 ease-out shrink-0 focus-visible:ring-2 focus-visible:ring-[#00A896] focus-visible:outline-none',
                active
                  ? 'text-[#F0F3BD] font-semibold bg-[#00A896]/15 border border-[#02C39A]/30 shadow-inner'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#07111E] border border-transparent'
              )}
            >
              <span
                className={clsx(
                  'transition-colors duration-200',
                  active ? 'text-[#02C39A]' : 'text-slate-400'
                )}
              >
                {tab.icon}
              </span>
              <span>{tab.label}</span>

              {/* Turquoise active indicator underline */}
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#02C39A] rounded-full shadow-[0_0_8px_rgba(2,195,154,0.6)] animate-in fade-in duration-200" />
              )}
            </Link>
          );
        })}
      </div>

      <div className="hidden lg:flex items-center pl-2 shrink-0">
        <a
          href="/legacy"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-slate-400 hover:text-[#F0F3BD] hover:bg-[#07111E] border border-[#00A896]/15 transition-colors"
        >
          <ExternalLink className="w-3 h-3 text-[#00A896]" />
          <span>Legacy</span>
        </a>
      </div>
    </nav>
  );
};
