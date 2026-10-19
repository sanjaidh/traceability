import React from 'react';
import { 
  Radio, 
  Layers, 
  Compass, 
  QrCode, 
  Grid, 
  AlertTriangle, 
  FileCheck2, 
  BarChart3, 
  Smartphone, 
  Sliders, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
}) => {
  const { twinState } = useSocket();
  const alertCount = twinState?.kpis.openAlerts || 3;

  const navGroups = [
    {
      group: 'Operate',
      items: [
        { id: 'dashboard', label: 'Live Floor', icon: Radio },
        { id: 'mobile', label: 'Operator PWA', icon: Smartphone },
      ],
    },
    {
      group: 'Plan',
      items: [
        { id: 'dispatch', label: 'Smart Dispatch', icon: Compass },
        { id: 'racks', label: 'WIP Racks', icon: Grid },
      ],
    },
    {
      group: 'Quality',
      items: [
        { id: 'mapping', label: 'Mapping Station', icon: QrCode },
        { id: 'genealogy', label: 'Genealogy & QC', icon: FileCheck2 },
      ],
    },
    {
      group: 'Analyse',
      items: [
        { id: 'digital-twin', label: 'Digital Twin 3D', icon: Layers },
        { 
          id: 'alerts', 
          label: 'Alerts', 
          icon: AlertTriangle, 
          badge: alertCount > 0 ? alertCount : undefined,
          badgeColor: 'var(--status-alarm)'
        },
        { id: 'reports', label: 'OEE & Reports', icon: BarChart3 },
      ],
    },
    {
      group: 'Admin',
      items: [
        { id: 'simulator', label: 'Sim Control', icon: Sliders },
      ],
    },
  ];

  return (
    <aside 
      className={`bg-[#1B1E23] border-r border-[#2A2E35] flex flex-col justify-between select-none transition-all duration-150 flex-shrink-0 z-30 ${
        isCollapsed ? 'w-14' : 'w-48'
      }`}
      style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)' }}
    >
      {/* Navigation Groups */}
      <div className="py-2 overflow-y-auto overflow-x-hidden flex-1">
        {navGroups.map((group, gIdx) => (
          <div key={group.group} className={`${gIdx > 0 ? 'mt-3 pt-2 border-t border-[#2A2E35]' : ''}`}>
            {!isCollapsed && (
              <div className="px-3 pb-1 text-[10px] font-semibold tracking-wider text-[#9AA0A8] uppercase">
                {group.group}
              </div>
            )}
            <div className="flex flex-col gap-0.5 px-1.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors text-left relative ${
                      isActive 
                        ? 'bg-[#22262C] text-[#E7E9EC]' 
                        : 'text-[#9AA0A8] hover:bg-[#22262C]/60 hover:text-[#E7E9EC]'
                    }`}
                    style={{
                      backgroundColor: isActive ? 'var(--bg-raised)' : undefined,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {/* Active Accent Bar on Left */}
                    {isActive && (
                      <div 
                        className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#F2A900] rounded-r"
                        style={{ backgroundColor: 'var(--accent-amber)' }}
                      />
                    )}
                    <Icon 
                      className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#F2A900]' : 'text-[#9AA0A8]'}`} 
                      strokeWidth={1.5}
                      style={{ color: isActive ? 'var(--accent-amber)' : 'inherit' }}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1 tracking-normal">{item.label}</span>
                    )}
                    {!isCollapsed && item.badge !== undefined && (
                      <span 
                        className="px-1.5 py-0.2 font-mono text-[10px] rounded-sm font-semibold"
                        style={{
                          backgroundColor: 'rgba(217, 71, 63, 0.2)',
                          color: item.badgeColor || 'var(--status-alarm)',
                          border: '1px solid rgba(217, 71, 63, 0.4)'
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Collapse Toggle Footer */}
      <div className="p-2 border-t border-[#2A2E35] flex items-center justify-between">
        {!isCollapsed && (
          <span className="text-[10px] font-mono text-[#9AA0A8] px-1">
            SHOP-5 SCADA
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
          className="btn-icon w-7 h-7 mx-auto"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </aside>
  );
};
