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
import { AnimatePresence, motion } from 'framer-motion';

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
    default:
      return <DashboardView />;
  }
}

export default function Home() {
  const { activeView } = useChatStore();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <DesktopSidebar />

      {/* Mobile Sidebar (Sheet) */}
      <MobileSidebar />

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3 md:hidden">
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
              <ViewContent view={activeView} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
