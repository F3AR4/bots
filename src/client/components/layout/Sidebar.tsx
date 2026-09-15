import React from 'react';
import { useLocation, Link } from 'wouter';
import {
  LayoutDashboard,
  Users,
  GitCompare,
  Activity,
  Radio,
  FileCheck2,
  BookOpen,
  TrendingUp,
  FileText,
  Sliders,
  Database,
  ExternalLink,
  Server,
} from 'lucide-react';
import { clsx } from 'clsx';

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [location] = useLocation();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const sections: NavSection[] = [
    {
      title: 'COMMAND CENTER',
      items: [
        {
          label: 'Overview',
          path: '/overview',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'RESEARCH',
      items: [
        {
          label: 'Wallet Rankings',
          path: '/research/wallets',
          icon: <Users className="w-4 h-4" />,
        },
        {
          label: 'Copyability Engine',
          path: '/research/copyability',
          icon: <GitCompare className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'OPERATIONS',
      items: [
        {
          label: 'Overview',
          path: '/operations',
          icon: <Activity className="w-4 h-4" />,
        },
        {
          label: 'Signals',
          path: '/operations/signals',
          icon: <Radio className="w-4 h-4" />,
        },
        {
          label: 'Paper Trades',
          path: '/operations/paper-trades',
          icon: <FileCheck2 className="w-4 h-4" />,
        },
        {
          label: 'Decision Journal',
          path: '/operations/decision-journal',
          icon: <BookOpen className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'PERFORMANCE',
      items: [
        {
          label: 'Performance',
          path: '/performance',
          icon: <TrendingUp className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        {
          label: 'System Health',
          path: '/system',
          icon: <Server className="w-4 h-4" />,
        },
        {
          label: 'Ingestion',
          path: '/system/ingestion',
          icon: <Database className="w-4 h-4" />,
        },
        {
          label: 'Rules',
          path: '/system/rules',
          icon: <Sliders className="w-4 h-4" />,
        },
        {
          label: 'Reports',
          path: '/system/reports',
          icon: <FileText className="w-4 h-4" />,
        },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#04080F] border-r border-[#00A896]/15 w-64 shadow-2xl">
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            <div className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">
              {section.title}
            </div>
            <div className="space-y-0.5 mt-1">
              {section.items.map((item) => {
                const isActive =
                  item.path === '/overview'
                    ? location === '/' || location === '/overview'
                    : location.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={clsx(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group focus-visible:ring-2 focus-visible:ring-[#00A896] focus-visible:outline-none',
                      isActive
                        ? 'bg-[#00A896]/20 text-[#F0F3BD] border border-[#02C39A]/40 font-semibold shadow-inner'
                        : 'text-slate-400 hover:text-white hover:bg-[#07111E] border border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={clsx(
                          'transition-colors',
                          isActive ? 'text-[#02C39A]' : 'text-slate-400 group-hover:text-[#00A896]'
                        )}
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#07111E] text-[#F0F3BD] font-mono border border-[#00A896]/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-[#00A896]/15 bg-[#03060C]">
        <a
          href="/legacy"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#07111E] transition-colors border border-[#00A896]/15"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-[#00A896]" />
            <span>Legacy Dashboard</span>
          </span>
          <span className="text-[10px] font-mono text-[#F0F3BD]">Vanilla</span>
        </a>
      </div>
    </div>
  );

  return (
    <>
      {isOpen && (
        <aside
          aria-label="Workstation Navigation"
          className="fixed inset-0 z-50 md:hidden flex"
        >
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="relative z-50 flex-1 max-w-xs w-full shadow-2xl">
            {sidebarContent}
          </div>
        </aside>
      )}
    </>
  );
};
