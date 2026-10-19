import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Box, 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  SlidersHorizontal, 
  Share2, 
  Check, 
  Clock, 
  AlertTriangle,
  TrendingDown,
  X
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';
import { ShopFloorCanvas } from '../twin/ShopFloorCanvas.js';
import { ShopFloor3D } from '../twin/ShopFloor3D.js';
import { StatusGlyph } from '../components/StatusGlyph.js';

interface DigitalTwinPageProps {
  onInspectMachine: (machineId: string) => void;
  onInspectPouch: (pouchCode: string) => void;
}

export const DigitalTwinPage: React.FC<DigitalTwinPageProps> = ({
  onInspectMachine,
  onInspectPouch,
}) => {
  const { twinState } = useSocket();

  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [activeHeatLayer, setActiveHeatLayer] = useState<'NONE' | 'WIP_DENSITY' | 'UTILIZATION'>('NONE');

  // Time Machine Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(10);
  const [timeSliderVal, setTimeSliderVal] = useState(100);
  const [selectedShift, setSelectedShift] = useState<'A' | 'B' | 'C'>('A');

  // What-If Simulation State
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [simOfflineMachine, setSimOfflineMachine] = useState('VMC-42');
  const [whatIfResult, setWhatIfResult] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inspectMachineId, setInspectMachineId] = useState('VMC-42');

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      timer = setInterval(() => {
        setTimeSliderVal(prev => (prev >= 100 ? 0 : prev + 1));
      }, 500 / (playbackSpeed / 10));
    }
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed]);

  const handleRunWhatIf = async () => {
    try {
      const res = await fetch('/api/digital-twin/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioName: `What-If: ${simOfflineMachine} Offline`,
          offlineMachines: [simOfflineMachine],
          movedJobs: [
            { cycleId: 'CYC-115-01', fromMachineId: simOfflineMachine, toMachineId: 'VMC-38' },
          ],
        }),
      });
      const data = await res.json();
      setWhatIfResult(data);
    } catch (err) {
      console.warn('What-If error:', err);
    }
  };

  const handleSaveSnapshot = async () => {
    try {
      await fetch('/api/digital-twin/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift: selectedShift }),
      });
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const machines = twinState?.machines || [];
  const pouches = twinState?.pouches || [];
  const currentMachine = machines.find(m => m.machine_id === inspectMachineId) || machines[0] || {
    machine_id: 'VMC-42',
    machine_name: 'Makino Slim3n #42',
    machine_type: 'VMC',
    zone_id: 'ZN-VMC-B',
    current_state: 'RUNNING',
    spindle_load_pct: 68,
    cycle_duration_sec: 852,
    current_work_order_id: 'WO-100458',
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Header Toolbar (SCADA Style) */}
      <div className="h-10 bg-[#1B1E23] border-b border-[#2A2E35] px-3 flex items-center justify-between gap-3 flex-shrink-0">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-sm border border-[#2A2E35] bg-[#14161A] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('2D')}
              className={`px-2.5 py-1 rounded-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === '2D' 
                  ? 'bg-[#22262C] text-[#E7E9EC] border-b border-[#F2A900]' 
                  : 'text-[#9AA0A8] hover:text-[#E7E9EC]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D CAD Plan (118.1m × 60.5m)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3D')}
              className={`px-2.5 py-1 rounded-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === '3D' 
                  ? 'bg-[#22262C] text-[#E7E9EC] border-b border-[#F2A900]' 
                  : 'text-[#9AA0A8] hover:text-[#E7E9EC]'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D CAD/CAM Wireframe Twin</span>
            </button>
          </div>

          <div className="h-4 w-px bg-[#2A2E35]" />

          {/* Shift Selector */}
          <div className="flex items-center gap-1 text-xs font-mono">
            {(['A', 'B', 'C'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedShift(s)}
                className={`px-2 py-0.5 rounded-sm border ${
                  selectedShift === s 
                    ? 'bg-[#22262C] text-[#F2A900] border-[#F2A900]/40 font-bold' 
                    : 'bg-[#14161A] text-[#9AA0A8] border-[#2A2E35] hover:text-[#E7E9EC]'
                }`}
              >
                Shift {s}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Replay Scrubber Controls */}
        <div className="hidden md:flex items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="btn-icon w-6 h-6"
            title={isPlaying ? 'Pause Replay' : 'Play Historical Replay'}
          >
            {isPlaying ? <Pause className="w-3 h-3 text-[#F2A900]" /> : <Play className="w-3 h-3" />}
          </button>
          <span className="text-[#9AA0A8] text-[11px]">Speed:</span>
          {[1, 5, 10, 50].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setPlaybackSpeed(s)}
              className={`px-1.5 py-0.2 rounded-sm text-[11px] ${
                playbackSpeed === s ? 'bg-[#F2A900] text-[#14161A] font-bold' : 'text-[#9AA0A8] hover:text-[#E7E9EC]'
              }`}
            >
              {s}x
            </button>
          ))}
          <span className="text-[#F2A900] text-[11px] pl-2">
            {timeSliderVal === 100 ? 'LIVE NOW' : `-${Math.round((100 - timeSliderVal) * 4.8)} min`}
          </span>
        </div>

        {/* Right: What-If Sandbox & Snapshot Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWhatIfOpen(!whatIfOpen)}
            className={`btn-secondary text-xs py-1 px-2.5 ${whatIfOpen ? 'border-[#F2A900] text-[#F2A900]' : ''}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>What-If Sandbox</span>
          </button>

          <button
            type="button"
            onClick={handleSaveSnapshot}
            className="btn-secondary text-xs py-1 px-2.5"
            title="Save Twin State Snapshot"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-[#3FA37A]" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Saved' : 'Snapshot'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Visual Canvas + Right Inspector */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Visualizer Area */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col relative overflow-hidden border-r border-[#2A2E35]">
          <div className="flex-1 relative overflow-hidden">
            {viewMode === '2D' ? (
              <ShopFloorCanvas
                machines={machines}
                pouches={pouches}
                onSelectMachine={(mId) => {
                  setInspectMachineId(mId);
                  onInspectMachine(mId);
                }}
                onSelectPouch={onInspectPouch}
                activeHeatLayer={activeHeatLayer}
              />
            ) : (
              <ShopFloor3D
                machines={machines}
                pouches={pouches}
                onSelectMachine={(mId) => setInspectMachineId(mId)}
              />
            )}
          </div>

          {/* Time Scrubber Footer */}
          <div className="h-8 bg-[#1B1E23] border-t border-[#2A2E35] px-3 flex items-center gap-3 flex-shrink-0 text-xs">
            <span className="font-mono text-[10px] text-[#9AA0A8] flex-shrink-0">06:00 (START)</span>
            <input
              type="range"
              min="0"
              max="100"
              value={timeSliderVal}
              onChange={e => setTimeSliderVal(parseInt(e.target.value))}
              aria-label="Time-machine scrubber"
              className="flex-1 h-1 bg-[#22262C] rounded-none appearance-none cursor-pointer accent-[#F2A900]"
            />
            <span className="font-mono text-[10px] text-[#9AA0A8] flex-shrink-0">14:00 (SHIFT END)</span>
          </div>

          {/* What-If Simulation Sandbox Drawer (Bottom Docked) */}
          {whatIfOpen && (
            <div className="h-56 bg-[#1B1E23] border-t-2 border-[#F2A900] p-3 flex flex-col z-30 overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-[#2A2E35] mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-[#E7E9EC] uppercase tracking-wider">
                    What-If Simulation Sandbox
                  </span>
                  <span className="sim-badge text-[10px]">
                    SIMULATION PROJECTION
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setWhatIfOpen(false)}
                  className="text-[#9AA0A8] hover:text-[#E7E9EC]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-12 gap-3 flex-1 overflow-auto text-xs">
                {/* Scenario Setup */}
                <div className="col-span-12 md:col-span-4 flex flex-col gap-2">
                  <div>
                    <label className="text-[11px] text-[#9AA0A8] block mb-1">Simulate Machine Breakdown / Offline:</label>
                    <select
                      value={simOfflineMachine}
                      onChange={e => setSimOfflineMachine(e.target.value)}
                      className="w-full bg-[#14161A] border border-[#2A2E35] rounded-sm p-1.5 font-mono text-xs text-[#E7E9EC]"
                    >
                      {machines.slice(0, 15).map(m => (
                        <option key={m.machine_id} value={m.machine_id}>
                          {m.machine_id} ({m.machine_type}) - Currently {m.current_state}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunWhatIf}
                    className="btn-primary text-xs py-1.5 mt-1"
                  >
                    Run Discrete-Event Projection
                  </button>
                </div>

                {/* Scenario Results */}
                <div className="col-span-12 md:col-span-8 border-l border-[#2A2E35] pl-3 flex flex-col justify-center">
                  {whatIfResult ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-[#E7E9EC]">{whatIfResult.scenarioName}</span>
                        <span className="font-mono text-[#D9473F]">
                          Impact: -{whatIfResult.impactMetrics?.throughputLossPct || 4.2}% Throughput
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div className="p-2 bg-[#14161A] border border-[#2A2E35] rounded-sm">
                          <span className="text-[10px] text-[#9AA0A8] block">Displaced Jobs</span>
                          <span className="font-mono text-sm text-[#F2A900] font-semibold">
                            {whatIfResult.impactMetrics?.displacedPouchesCount || 2} Pouches
                          </span>
                        </div>
                        <div className="p-2 bg-[#14161A] border border-[#2A2E35] rounded-sm">
                          <span className="text-[10px] text-[#9AA0A8] block">Recommended Rebalance</span>
                          <span className="font-mono text-sm text-[#3FA37A] font-semibold">
                            Reroute to VMC-38
                          </span>
                        </div>
                        <div className="p-2 bg-[#14161A] border border-[#2A2E35] rounded-sm">
                          <span className="text-[10px] text-[#9AA0A8] block">Predicted Delay</span>
                          <span className="font-mono text-sm text-[#E7E9EC]">
                            +18 min on WO-100458
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#9AA0A8] italic">
                      Select machine parameters on left and run projection to evaluate line bottlenecking.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Machine Telemetry Inspector */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 bg-[#1B1E23] flex flex-col overflow-y-auto p-3 gap-3" style={{ backgroundColor: 'var(--bg-panel)' }}>
          <div className="scada-panel">
            <div className="section-header">
              <span>Machine Telemetry</span>
              <StatusGlyph status={currentMachine.current_state} showLabel={true} />
            </div>

            <div className="def-list">
              <div className="def-row">
                <span className="def-label">Machine ID</span>
                <span className="def-value text-[#F2A900] font-bold">{currentMachine.machine_id}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Name</span>
                <span className="def-value font-sans text-xs">{currentMachine.machine_name}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Zone</span>
                <span className="def-value font-sans text-xs">{currentMachine.zone_id}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Current Work Order</span>
                <span className="def-value">{currentMachine.current_work_order_id || 'WO-100458'}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Active Cycle Duration</span>
                <span className="def-value">
                  {Math.floor((currentMachine.cycle_duration_sec || 852) / 60)} min {(currentMachine.cycle_duration_sec || 852) % 60} s
                </span>
              </div>
              <div className="def-row">
                <span className="def-label">Spindle Load</span>
                <span className="def-value text-[#3FA37A] font-bold">
                  {currentMachine.spindle_load_pct || 68}%
                </span>
              </div>
            </div>
          </div>

          {/* Tool Wear Status */}
          <div className="scada-panel">
            <div className="section-header">
              <span>Tool Magazine Telemetry</span>
              <span className="font-mono text-[10px] text-[#9AA0A8]">CAROUSEL (24 TOOLS)</span>
            </div>

            <div className="p-2 flex flex-col gap-1 text-xs font-mono">
              <div className="flex items-center justify-between p-1 bg-[#14161A] border border-[#2A2E35]">
                <span>T01: Endmill 12mm Solid Carbide</span>
                <span className="text-[#3FA37A]">82% Life</span>
              </div>
              <div className="flex items-center justify-between p-1 bg-[#14161A] border border-[#2A2E35]">
                <span>T02: Face Mill 50mm Octagonal</span>
                <span className="text-[#3FA37A]">91% Life</span>
              </div>
              <div className="flex items-center justify-between p-1 bg-[#14161A] border border-[#2A2E35]">
                <span>T03: Ballnose 6mm 4-Flute</span>
                <span className="text-[#E08A2E]">44% Life</span>
              </div>
              <div className="flex items-center justify-between p-1 bg-[#14161A] border border-[#2A2E35]">
                <span>T04: Thread Mill M8 × 1.25</span>
                <span className="text-[#3FA37A]">95% Life</span>
              </div>
            </div>
          </div>

          {/* Plain-Language Next Job Ranking */}
          <div className="scada-panel">
            <div className="section-header">
              <span>Smart Next-Job Queue</span>
              <span className="font-mono text-[#F2A900] text-xs">SCORE 94.2</span>
            </div>
            <div className="p-2.5 text-xs">
              <div className="font-mono font-semibold text-[#E7E9EC] flex items-center justify-between">
                <span>WO-100465 (Pouch #01)</span>
                <span className="text-[#3FA37A]">Rank #1</span>
              </div>
              <div className="text-[11px] text-[#9AA0A8] mt-1 space-y-0.5">
                <div>• +35 Urgency: EDD in 6.4 h (High SLA Risk)</div>
                <div>• +25 Setup: Same Fixture FIX-VMC-04 & Tooling</div>
                <div>• +20 Proximity: In Rack RCK-08 (12m away)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
