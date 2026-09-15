import React from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { OverviewPage } from './pages/OverviewPage';
import { ResearchRankingsPage } from './pages/ResearchRankingsPage';
import { WalletProfilePage } from './pages/WalletProfilePage';
import { CopyabilityResearchPage } from './pages/CopyabilityResearchPage';
import { OperationsOverviewPage } from './pages/OperationsOverviewPage';
import { LiveSignalsPage } from './pages/LiveSignalsPage';
import { PaperTradesPage } from './pages/PaperTradesPage';
import { DecisionJournalPage } from './pages/DecisionJournalPage';
import { PerformancePage } from './pages/PerformancePage';
import { SystemRulesPage } from './pages/SystemRulesPage';
import { DailyReportsPage } from './pages/DailyReportsPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { IngestionHealthPage } from './pages/IngestionHealthPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Centralized QueryClient with sensible caching and refetch defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 2,
      staleTime: 4000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Switch>
          {/* Default Route */}
          <Route path="/" component={OverviewPage} />
          <Route path="/overview" component={OverviewPage} />

          {/* Research Module Routes */}
          <Route path="/research" component={ResearchRankingsPage} />
          <Route path="/research/wallets" component={ResearchRankingsPage} />
          <Route path="/research/wallet/:address" component={WalletProfilePage} />
          <Route path="/research/copyability" component={CopyabilityResearchPage} />

          {/* Operations Module Routes */}
          <Route path="/operations" component={OperationsOverviewPage} />
          <Route path="/operations/signals" component={LiveSignalsPage} />
          <Route path="/operations/paper-trades" component={PaperTradesPage} />
          <Route path="/operations/decision-journal" component={DecisionJournalPage} />

          {/* Performance & Analytics */}
          <Route path="/performance" component={PerformancePage} />

          {/* System Governance & Telemetry */}
          <Route path="/system" component={SystemHealthPage} />
          <Route path="/system/ingestion" component={IngestionHealthPage} />
          <Route path="/system/rules" component={SystemRulesPage} />
          <Route path="/system/reports" component={DailyReportsPage} />

          {/* 404 Fallback */}
          <Route component={NotFoundPage} />
        </Switch>
      </AppShell>
    </QueryClientProvider>
  );
};
