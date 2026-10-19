import React, { useState } from 'react';
import { 
  QrCode, 
  Check, 
  AlertTriangle, 
  Volume2, 
  ListOrdered, 
  ClipboardCheck, 
  HelpCircle, 
  Smartphone,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';
import { useTheme } from '../context/ThemeContext.js';

export const OperatorMobilePage: React.FC = () => {
  const { triggerBuzzer } = useSocket();
  const { theme, toggleTheme } = useTheme();

  const [activeMachine, setActiveMachine] = useState('VMC-42');
  const [operatorId, setOperatorId] = useState('EMP-0234 (Vikas Gowda)');
  const [activeStep, setActiveStep] = useState(3);
  const [startedCycle, setStartedCycle] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const steps = [
    { id: 1, text: 'Scan Shelf QR Slot [RCK-08-C3]', done: true },
    { id: 2, text: 'Verify Raw Stock Heat #HT-8829-X', done: true },
    { id: 3, text: 'Mount & Clamp Fixture FIX-VMC-04', done: activeStep > 3 },
    { id: 4, text: 'Confirm Tooling Carousel T01-T04 Calibrated', done: activeStep > 4 },
  ];

  const handlePrimaryAction = () => {
    if (!startedCycle) {
      setStartedCycle(true);
      setActiveStep(5);
      setScanMessage('Cycle Started: Spindle Running on VMC-42 for WO-100458');
    } else {
      setStartedCycle(false);
      setActiveStep(3);
      setScanMessage('Cycle Completed: First-Piece QC Triggered');
    }
  };

  const handleSimulateScan = () => {
    setScanMessage('Scanned QR: PCH-24-000458-01 verified in slot RCK-08-C3');
    setTimeout(() => setScanMessage(null), 3500);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-3 overflow-y-auto bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Mobile Frame Container (Max width 420px for handheld tablet) */}
      <div 
        className="w-full max-w-md bg-[#1B1E23] border border-[#2A2E35] rounded-sm flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)' }}
      >
        {/* 1. Mobile Header Bar */}
        <div className="p-3 border-b border-[#2A2E35] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#E7E9EC]">INDO-MIM</span>
              <span className="sim-badge text-[10px]">SIMULATED DATA</span>
            </div>
            <div className="text-[11px] text-[#9AA0A8]">Shop-5 Operator Tablet</div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#F2A900] px-2 py-0.5 bg-[#22262C] border border-[#2A2E35] rounded-sm">
              {activeMachine}
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-icon w-7 h-7"
              title="Toggle Light/Dark Theme for Shop Floor Glare"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 2. Dispatch Status Banner */}
        <div className="p-3 bg-[#22262C] border-b border-[#2A2E35] flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[#9AA0A8]">
              Machine Dispatch Queue
            </div>
            <div className="font-bold text-sm text-[#E7E9EC] tracking-tight">
              {startedCycle ? 'CYCLE ACTIVE IN SPINDLE' : 'NEXT JOB DISPATCHED (RANK #1)'}
            </div>
          </div>
          <span className={`text-xs font-mono font-bold ${startedCycle ? 'text-[#3FA37A]' : 'text-[#F2A900]'}`}>
            {startedCycle ? 'RUNNING' : 'QUEUED'}
          </span>
        </div>

        {/* 3. Job Definition Card (IBM Plex Mono for IDs) */}
        <div className="p-4 flex flex-col gap-3">
          <div className="scada-panel p-3">
            <div className="text-[11px] text-[#9AA0A8] uppercase tracking-wider">Work Order</div>
            <div className="font-mono font-bold text-2xl text-[#E7E9EC] tracking-tight">
              WO-100458
            </div>

            <div className="mt-2 text-[11px] text-[#9AA0A8] uppercase tracking-wider">Pouch ID</div>
            <div className="font-mono font-semibold text-lg text-[#F2A900]">
              PCH-24-000458-01
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#2A2E35] flex flex-col gap-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#9AA0A8]">Part:</span>
                <span className="font-medium text-[#E7E9EC] text-right">Titanium Impeller Rotor (TI-6AL-4V)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9AA0A8]">Customer:</span>
                <span className="font-medium text-[#E7E9EC]">Boeing Aerospace (Tier-1)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9AA0A8]">Raw Stock Heat #:</span>
                <span className="font-mono text-[#E7E9EC]">HT-8829-X</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9AA0A8]">WIP Shelf Location:</span>
                <span className="font-mono text-[#3FA37A] font-semibold">RCK-08-C3 (Slot Level C)</span>
              </div>
            </div>
          </div>

          {/* 4. Operator Step-by-Step Checklist */}
          <div className="scada-panel p-3 flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9AA0A8]">
              Pre-Machining Verification Steps
            </div>

            <div className="flex flex-col gap-1.5 mt-1 text-xs">
              {steps.map(step => (
                <div 
                  key={step.id} 
                  className={`p-2 rounded-sm border flex items-center justify-between ${
                    step.done 
                      ? 'bg-[#22262C] border-[#2A2E35] text-[#E7E9EC]' 
                      : 'bg-[#14161A] border-[#2A2E35] text-[#9AA0A8]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#9AA0A8]">{step.id}.</span>
                    <span>{step.text}</span>
                  </div>
                  {step.done ? (
                    <span className="text-[#3FA37A] font-mono text-[11px] flex items-center gap-1 font-bold">
                      <Check className="w-3.5 h-3.5" /> OK
                    </span>
                  ) : (
                    <span className="text-[#E08A2E] font-mono text-[10px]">PENDING</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Scan Notice Feedback */}
          {scanMessage && (
            <div className="p-2.5 bg-[#22262C] border border-[#F2A900]/40 rounded-sm text-xs font-mono text-[#F2A900] flex items-center gap-2">
              <Check className="w-4 h-4 text-[#3FA37A] flex-shrink-0" />
              <span>{scanMessage}</span>
            </div>
          )}

          {/* 5. Big 48px Height High-Contrast Primary Action Button */}
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="w-full h-12 bg-[#F2A900] hover:bg-[#D99800] text-[#14161A] font-bold text-sm tracking-wide rounded-sm flex items-center justify-center gap-2 select-none shadow-none active:scale-[0.99] transition-transform"
            style={{ minHeight: '48px', backgroundColor: 'var(--accent-amber)' }}
          >
            <QrCode className="w-5 h-5 text-[#14161A]" />
            <span>
              {startedCycle ? 'FINISH CYCLE & SEND TO QC' : 'SCAN POUCH & START CYCLE'}
            </span>
          </button>

          {/* Auxiliary Action: Buzz Pouch on Shelf */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateScan}
              className="btn-secondary flex-1 text-xs py-2"
            >
              Simulate Camera QR
            </button>
            <button
              type="button"
              onClick={() => triggerBuzzer('PCH-24-000458-01')}
              className="btn-secondary text-xs py-2 px-3"
              title="Buzz Pouch on Rack RCK-08"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 6. Mobile Bottom Dock (Scanner, Queue, Checklist, Help) */}
        <div className="h-12 bg-[#14161A] border-t border-[#2A2E35] grid grid-cols-4 text-center items-center text-[10px] text-[#9AA0A8] font-sans">
          <button 
            type="button"
            onClick={handleSimulateScan} 
            className="flex flex-col items-center justify-center h-full hover:text-[#E7E9EC]"
          >
            <QrCode className="w-4 h-4 mb-0.5" />
            <span>Scanner</span>
          </button>
          <div className="flex flex-col items-center justify-center h-full text-[#F2A900]">
            <ListOrdered className="w-4 h-4 mb-0.5" />
            <span>Queue</span>
          </div>
          <div className="flex flex-col items-center justify-center h-full hover:text-[#E7E9EC]">
            <ClipboardCheck className="w-4 h-4 mb-0.5" />
            <span>Checklist</span>
          </div>
          <div className="flex flex-col items-center justify-center h-full hover:text-[#E7E9EC]">
            <HelpCircle className="w-4 h-4 mb-0.5" />
            <span>Help</span>
          </div>
        </div>
      </div>
    </div>
  );
};
