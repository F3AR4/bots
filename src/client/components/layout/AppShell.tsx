import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import {
  LayoutDashboard,
  Users,
  Radio,
  FileCheck2,
  Sliders,
} from 'lucide-react';
import { clsx } from 'clsx';
import { PaperOnlyBanner } from './PaperOnlyBanner';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const mobileNavItems = [
    { label: 'Overview', path: '/overview', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: 'Signals', path: '/operations/signals', icon: <Radio className="w-5 h-5" /> },
    { label: 'Trades', path: '/operations/paper-trades', icon: <FileCheck2 className="w-5 h-5" /> },
    { label: 'Wallets', path: '/research/wallets', icon: <Users className="w-5 h-5" /> },
    { label: 'Rules', path: '/system/rules', icon: <Sliders className="w-5 h-5" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#04080F] text-slate-100 antialiased font-sans pb-16 md:pb-0">
      {/* 1. Persistent Top Safety Banner */}
      <PaperOnlyBanner />

      {/* 2. Workstation TopBar */}
      <TopBar onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

      {/* 3. Main Body: Sidebar + Dynamic Workspace View */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

        <main className="flex-1 overflow-y-auto bg-[#04080F] p-3 sm:p-5 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-5">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      {/* 4. Mobile Bottom Quick Action Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#04080F]/95 backdrop-blur-xl border-t border-[#00A896]/20 px-2 py-1.5 flex items-center justify-around shadow-2xl shadow-black"
      >
        {mobileNavItems.map((item) => {
          const isActive =
            item.path === '/overview'
              ? location === '/' || location === '/overview'
              : location.startsWith(item.path);

          return (
            <Link
              key={item.path}
              href={item.path}
              className={clsx(
                'flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-all duration-150 min-w-[56px]',
                isActive
                  ? 'text-[#F0F3BD] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <span className={clsx('mb-0.5', isActive ? 'text-[#02C39A]' : 'text-slate-400')}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
