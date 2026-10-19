import React, { useState, useEffect } from 'react';
import { SocketProvider } from './context/SocketContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { CommandPalette } from './components/CommandPalette.js';
import { VoiceSearchModal } from './components/VoiceSearchModal.js';
import { AssistantModal } from './components/AssistantModal.js';

// Pages
import { LiveDashboard } from './pages/LiveDashboard.js';
import { DigitalTwinPage } from './pages/DigitalTwinPage.js';
import { SmartDispatchPage } from './pages/SmartDispatchPage.js';
import { MappingStationPage } from './pages/MappingStationPage.js';
import { RackManagementPage } from './pages/RackManagementPage.js';
import { PouchDetailPage } from './pages/PouchDetailPage.js';
import { AlertsPage } from './pages/AlertsPage.js';
import { GenealogyPage } from './pages/GenealogyPage.js';
import { ReportsAnalyticsPage } from './pages/ReportsAnalyticsPage.js';
import { OperatorMobilePage } from './pages/OperatorMobilePage.js';
import { SimulatorControlPage } from './pages/SimulatorControlPage.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inspectPouchCode, setInspectPouchCode] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [voiceSearchOpen, setVoiceSearchOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    const handleOpenCommandPalette = () => setCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleOpenCommandPalette);
    return () => window.removeEventListener('open-command-palette', handleOpenCommandPalette);
  }, []);

  const handleInspectPouch = (pouchCode: string) => {
    setInspectPouchCode(pouchCode);
    setActiveTab('pouch-detail');
  };

  const handleInspectMachine = (machineId: string) => {
    setActiveTab('dispatch');
  };

  const handleQuickSearch = (query: string) => {
    const q = query.trim().toUpperCase();
    if (q.startsWith('PCH') || q.startsWith('TAG')) {
      handleInspectPouch(q);
    } else if (q.startsWith('VMC') || q.startsWith('WEDM')) {
      setActiveTab('dispatch');
    } else if (q.startsWith('RCK') || q.startsWith('SLT')) {
      setActiveTab('racks');
    } else {
      setActiveTab('dashboard');
    }
  };

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <LiveDashboard
            onInspectPouch={handleInspectPouch}
            onInspectMachine={handleInspectMachine}
            onNavigateTo={tab => setActiveTab(tab)}
          />
        );
      case 'digital-twin':
        return (
          <DigitalTwinPage
            onInspectMachine={handleInspectMachine}
            onInspectPouch={handleInspectPouch}
          />
        );
      case 'dispatch':
        return <SmartDispatchPage />;
      case 'mapping':
        return <MappingStationPage />;
      case 'racks':
        return <RackManagementPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'genealogy':
        return <GenealogyPage />;
      case 'reports':
        return <ReportsAnalyticsPage />;
      case 'mobile':
        return <OperatorMobilePage />;
      case 'simulator':
        return <SimulatorControlPage />;
      case 'pouch-detail':
        return (
          <PouchDetailPage
            pouchCode={inspectPouchCode || 'PCH-24-000458-01'}
            onBack={() => setActiveTab('dashboard')}
            onInspectMachine={handleInspectMachine}
          />
        );
      default:
        return (
          <LiveDashboard
            onInspectPouch={handleInspectPouch}
            onInspectMachine={handleInspectMachine}
            onNavigateTo={tab => setActiveTab(tab)}
          />
        );
    }
  };

  return (
    <ThemeProvider>
      <SocketProvider>
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#14161A] text-[#E7E9EC]" style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
          {/* Top Bar */}
          <Navbar
            onOpenVoiceSearch={() => setVoiceSearchOpen(true)}
            onOpenAssistant={() => setAssistantOpen(true)}
            onQuickSearch={handleQuickSearch}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />

          {/* Main Body: Slim Left Rail + Viewport */}
          <div className="flex-1 flex overflow-hidden">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={tab => {
                setInspectPouchCode(null);
                setActiveTab(tab);
              }}
              isCollapsed={isSidebarCollapsed}
              setIsCollapsed={setIsSidebarCollapsed}
            />

            <main className="flex-1 flex flex-col overflow-hidden relative">
              {renderActivePage()}
            </main>
          </div>

          {/* Command Palette (Ctrl+K) */}
          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onNavigate={tabId => setActiveTab(tabId)}
            onSearchQuery={handleQuickSearch}
          />

          {/* Voice Search Modal */}
          <VoiceSearchModal
            isOpen={voiceSearchOpen}
            onClose={() => setVoiceSearchOpen(false)}
            onSearchResult={spokenText => handleQuickSearch(spokenText)}
          />

          {/* Assistant Modal */}
          <AssistantModal
            isOpen={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            onNavigateTo={(tab, q) => {
              setAssistantOpen(false);
              if (q) handleQuickSearch(q);
              else setActiveTab(tab);
            }}
          />
        </div>
      </SocketProvider>
    </ThemeProvider>
  );
};

export default App;
