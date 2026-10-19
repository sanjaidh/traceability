import React, { useState, useEffect, useRef } from 'react';
import { Search, Radio, Layers, Compass, QrCode, Grid, AlertTriangle, FileCheck2, BarChart3, Smartphone, Sliders, X } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tabId: string) => void;
  onSearchQuery: (query: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSearchQuery,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger open via parent
          const event = new CustomEvent('open-command-palette');
          window.dispatchEvent(event);
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickNav = [
    { id: 'dashboard', label: 'Live Floor SCADA Console', icon: Radio, group: 'Views' },
    { id: 'digital-twin', label: 'Digital Twin 3D Wireframe', icon: Layers, group: 'Views' },
    { id: 'dispatch', label: 'Smart Dispatch & Machine Ranking', icon: Compass, group: 'Plan' },
    { id: 'mapping', label: 'Mapping Station & Tag Pairing', icon: QrCode, group: 'Quality' },
    { id: 'racks', label: 'WIP Racks Matrix (36 Racks / 432 Slots)', icon: Grid, group: 'Plan' },
    { id: 'alerts', label: 'Industrial Alerts & Rule Engine', icon: AlertTriangle, group: 'Analyse' },
    { id: 'genealogy', label: 'Genealogy & Traceability Certificate', icon: FileCheck2, group: 'Quality' },
    { id: 'reports', label: 'OEE & Machine Telemetry Reports', icon: BarChart3, group: 'Analyse' },
    { id: 'mobile', label: 'Operator Tablet PWA', icon: Smartphone, group: 'Operate' },
    { id: 'simulator', label: 'Event Simulator & Fault Injection', icon: Sliders, group: 'Admin' },
  ];

  const filtered = quickNav.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.group.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectNav = (id: string) => {
    onNavigate(id);
    onClose();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearchQuery(query.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60">
      <div 
        className="w-full max-w-xl bg-[#1B1E23] border border-[#2A2E35] rounded-sm overflow-hidden"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)' }}
      >
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 px-3 py-2.5 border-b border-[#2A2E35]">
          <Search className="w-4 h-4 text-[#9AA0A8] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a Work Order (WO-100458), Pouch ID, Machine (VMC-42), or view..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent border-none text-sm text-[#E7E9EC] placeholder-[#9AA0A8] focus:outline-none font-mono"
            style={{ color: 'var(--text-primary)' }}
          />
          <button 
            type="button" 
            onClick={onClose}
            className="text-[#9AA0A8] hover:text-[#E7E9EC] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </form>

        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim().length > 0 && (
            <div 
              onClick={() => { onSearchQuery(query.trim()); onClose(); }}
              className="flex items-center justify-between px-3 py-2 text-xs text-[#F2A900] bg-[#F2A900]/10 rounded cursor-pointer mb-2"
            >
              <span>Search pouches, tags & machines for "<strong>{query}</strong>"</span>
              <span className="font-mono text-[10px]">↵ ENTER</span>
            </div>
          )}

          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9AA0A8] px-3 py-1">
            Navigation Jump
          </div>
          {filtered.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => handleSelectNav(item.id)}
                className="flex items-center justify-between px-3 py-2 rounded text-xs text-[#E7E9EC] hover:bg-[#22262C] cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-[#9AA0A8]" />
                  <span>{item.label}</span>
                </div>
                <span className="text-[10px] text-[#9AA0A8] uppercase tracking-wider font-mono">
                  {item.group}
                </span>
              </div>
            );
          })}
        </div>

        <div className="px-3 py-1.5 bg-[#14161A] border-t border-[#2A2E35] flex items-center justify-between text-[11px] text-[#9AA0A8]">
          <span>Use <strong>↑</strong> <strong>↓</strong> to navigate</span>
          <span><strong>ESC</strong> to close</span>
        </div>
      </div>
    </div>
  );
};
