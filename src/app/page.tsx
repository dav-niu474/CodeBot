'use client';

import { useChatStore } from '@/store/chat-store';
import type { ActiveView } from '@/lib/types';
import { DesktopSidebar, MobileSidebar, MobileSidebarTrigger } from '@/components/codebot/Sidebar';
import { ChatView } from '@/components/codebot/ChatView';
import { DashboardView } from '@/components/codebot/DashboardView';
import { ToolsView } from '@/components/codebot/ToolsView';
import { SkillsView } from '@/components/codebot/SkillsView';
import { SettingsView } from '@/components/codebot/SettingsView';
import { AICapabilitiesView } from '@/components/codebot/AICapabilitiesView';
import { ModelHubView } from '@/components/codebot/ModelHubView';
import { ModesView } from '@/components/codebot/ModesView';
import { MemoryView } from '@/components/codebot/MemoryView';
import { AgentsView } from '@/components/codebot/AgentsView';
import { SecurityView } from '@/components/codebot/SecurityView';
import { GitView } from '@/components/codebot/GitView';
import { AnalyticsView } from '@/components/codebot/AnalyticsView';
import { KairosView } from '@/components/codebot/KairosView';
import { BridgeView } from '@/components/codebot/BridgeView';
import { AnimatePresence, motion } from 'framer-motion';
import { CommandPalette } from '@/components/codebot/CommandPalette';
import { KeyboardShortcuts } from '@/components/codebot/KeyboardShortcuts';
import { BuddyPanel } from '@/components/codebot/BuddyPanel';
import { LayoutDashboard, MessageSquare, Cpu, Wrench, Shield } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function ViewContent({ view }: { view: ActiveView }) {
  switch (view) {
    case 'dashboard':
      return <DashboardView />;
    case 'chat':
      return <ChatView />;
    case 'tools':
      return <ToolsView />;
    case 'skills':
      return <SkillsView />;
    case 'settings':
      return <SettingsView />;
    case 'ai-capabilities':
      return <AICapabilitiesView />;
    case 'model-hub':
      return <ModelHubView />;
    case 'modes':
      return <ModesView />;
    case 'memory':
      return <MemoryView />;
    case 'agents':
      return <AgentsView />;
    case 'security':
      return <SecurityView />;
    case 'git':
      return <GitView />;
    case 'analytics':
      return <AnalyticsView />;
    case 'kairos':
      return <KairosView />;
    case 'bridge':
      return <BridgeView />;
    default:
      return <DashboardView />;
  }
}

export default function Home() {
  const { activeView, setActiveView } = useChatStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Mobile Sidebar (Sheet) */}
      <MobileSidebar />

      {/* Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette />

      {/* Keyboard Shortcuts Overlay (? key) */}
      <KeyboardShortcuts />

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden pb-14 lg:pb-0">
        {/* Mobile Header */}
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 lg:hidden">
          <MobileSidebarTrigger />
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15">
              <span className="text-sm">🤖</span>
            </div>
            <span className="text-sm font-semibold text-foreground">CodeBot</span>
          </div>
        </div>

        {/* View Content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <ErrorBoundary>
                <ViewContent view={activeView} />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-background/95 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around py-2 safe-bottom">
          {[
            { view: 'dashboard' as const, icon: LayoutDashboard, label: 'Home' },
            { view: 'chat' as const, icon: MessageSquare, label: 'Chat' },
            { view: 'model-hub' as const, icon: Cpu, label: 'Models' },
            { view: 'tools' as const, icon: Wrench, label: 'Tools' },
            { view: 'security' as const, icon: Shield, label: 'More' },
          ].map(({ view, icon: Icon, label }) => {
            const isActive = activeView === view;
            return (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                  isActive
                    ? 'text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px]">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Buddy Pet Companion */}
      <BuddyPanel />
    </div>
  );
}
