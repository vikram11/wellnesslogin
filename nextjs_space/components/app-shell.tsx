'use client';

import { useState } from 'react';
import { MessageSquare, BarChart3, History, Pill, Mail } from 'lucide-react';
import { ChatPanel } from '@/components/chat-panel';
import { ReportsPanel } from '@/components/reports-panel';
import { HistoryPanel } from '@/components/history-panel';
import { MedicationsPanel } from '@/components/medications-panel';
import { EmailPanel } from '@/components/email-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationToggle } from '@/components/notification-toggle';

const tabs = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'history', label: 'History', icon: History },
  { id: 'meds', label: 'Medications', icon: Pill },
  { id: 'email', label: 'Email', icon: Mail },
] as const;

type TabId = typeof tabs[number]['id'];

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-lg font-bold">💚</span>
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">WellnessLog.in</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Tab Navigation - Mobile: bottom, Desktop: top sub-bar */}
      <nav className="hidden sm:block border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {tabs?.map?.((tab: typeof tabs[number]) => {
            const Icon = tab?.icon;
            return (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`flex items-center gap-2 px-4 py-3 text-base font-medium transition-colors border-b-2 -mb-[1px] ${
                  activeTab === tab?.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {Icon && <Icon className="w-5 h-5" />}
                {tab?.label}
              </button>
            );
          }) ?? []}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'chat' && <ChatPanel />}
        {activeTab === 'reports' && <ReportsPanel />}
        {activeTab === 'history' && <HistoryPanel />}
        {activeTab === 'meds' && <MedicationsPanel />}
        {activeTab === 'email' && <EmailPanel />}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden border-t border-border bg-card px-2 pb-safe">
        <div className="flex justify-around">
          {tabs?.map?.((tab: typeof tabs[number]) => {
            const Icon = tab?.icon;
            return (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`flex flex-col items-center gap-0.5 py-2.5 px-3 text-sm font-medium transition-colors ${
                  activeTab === tab?.id
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              >
                {Icon && <Icon className="w-6 h-6" />}
                {tab?.label}
              </button>
            );
          }) ?? []}
        </div>
      </nav>
    </div>
  );
}
