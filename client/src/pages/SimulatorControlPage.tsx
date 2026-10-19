import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  WifiOff, 
  AlertTriangle, 
  BatteryLow, 
  RotateCcw, 
  Check, 
  Radio, 
  SlidersHorizontal 
} from 'lucide-react';

export const SimulatorControlPage: React.FC = () => {
  const [status, setStatus] = useState<any>({ isRunning: true, speed: 10, ticks: 120 });
  const [speed, setSpeed] = useState(10);
  const [faultMessage, setFaultMessage] = useState<string | null>(null);

  const fetchStatus = () => {
    fetch('/api/simulator/status')
      .then(res => res.json())
      .then(d => {
        setStatus(d);
        setSpeed(d.speed || 10);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSpeedChange = async (newSpeed: number) => {
    setSpeed(newSpeed);
    await fetch('/api/simulator/speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed: newSpeed }),
    });
    fetchStatus();
  };

  const handleInjectFault = async (faultType: string, targetId?: string, extra?: any) => {
    try {
      const res = await fetch('/api/simulator/fault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faultType, targetId, ...extra }),
      });
      const data = await res.json();
      setFaultMessage(data.message || 'Fault injected into Shop-5 telemetry stream.');
      setTimeout(() => setFaultMessage(null), 4000);
    } catch (err) {
      setFaultMessage('Error injecting fault.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 max-w-5xl mx-auto w-full bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Header Toolbar */}
      <div className="scada-panel p-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#E7E9EC] uppercase tracking-wider">
              Realistic Shop-5 Event Simulator & Fault Injection Console
            </span>
            <span className="sim-badge text-[10px]">SIMULATOR ACTIVE ({status.ticks} TICKS)</span>
          </div>
          <div className="text-xs text-[#9AA0A8] mt-0.5">
            Hardware emulation for 2,643 BLE tags, 12 gateways, and 111 CNC machines. Inject real-world floor faults to test alert failover and rebalancing.
          </div>
        </div>
      </div>

      {faultMessage && (
        <div className="p-2.5 bg-[#22262C] border border-[#F2A900] text-xs font-mono text-[#F2A900] flex items-center gap-2">
          <Check className="w-4 h-4 text-[#3FA37A]" />
          <span>{faultMessage}</span>
        </div>
      )}

      {/* 2. Simulation Speed Slider */}
      <div className="scada-panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-[#E7E9EC]">
            Simulation Clock Multiplier: <strong className="text-[#F2A900] font-mono">{speed}x</strong>
          </span>
          <span className="font-mono text-[11px] text-[#9AA0A8]">1x (Real-Time) to 100x (High-Speed Test)</span>
        </div>

        <input
          type="range"
          min="1"
          max="100"
          value={speed}
          onChange={e => handleSpeedChange(parseInt(e.target.value))}
          className="w-full h-1.5 bg-[#14161A] appearance-none cursor-pointer accent-[#F2A900] border border-[#2A2E35]"
        />

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[#9AA0A8] text-[11px]">Presets:</span>
          {[1, 5, 10, 25, 50, 100].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => handleSpeedChange(s)}
              className={`px-2 py-0.5 rounded-sm border ${
                speed === s 
                  ? 'bg-[#F2A900] text-[#14161A] border-[#F2A900] font-bold' 
                  : 'bg-[#14161A] border-[#2A2E35] text-[#9AA0A8] hover:text-[#E7E9EC]'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* 3. 5 Live Fault Injection Scenarios */}
      <div className="scada-panel flex flex-col">
        <div className="section-header">
          <span>Industrial Fault Scenarios (Physical Stress Test Suite)</span>
          <span className="sim-badge text-[10px]">LIVE INJECTION</span>
        </div>

        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Fault 1: Reader Drop */}
          <div className="p-3 bg-[#14161A] border border-[#2A2E35] rounded-sm flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between font-mono">
                <span className="font-bold text-[#E7E9EC]">1. Gateway Communication Loss</span>
                <span className="text-[10px] text-[#D9473F]">RX-08 OFFLINE</span>
              </div>
              <p className="text-[11px] text-[#9AA0A8] mt-1">
                Drops Gateway RX-08 (VMC Zone B) to test adjacent gateway RSSI coverage failover to RX-07 and RX-09.
              </p>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => handleInjectFault('READER_OFFLINE', 'RX-08')}
                className="btn-secondary flex-1 text-xs py-1.5 text-[#D9473F] border-[#D9473F]/40"
              >
                Drop RX-08 Offline
              </button>
              <button
                type="button"
                onClick={() => handleInjectFault('READER_RESTORE', 'RX-08')}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Restore
              </button>
            </div>
          </div>

          {/* Fault 2: Machine Breakdown */}
          <div className="p-3 bg-[#14161A] border border-[#2A2E35] rounded-sm flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between font-mono">
                <span className="font-bold text-[#E7E9EC]">2. CNC Spindle Alarm (Breakdown)</span>
                <span className="text-[10px] text-[#D9473F]">VMC-42 ALARM</span>
              </div>
              <p className="text-[11px] text-[#9AA0A8] mt-1">
                Triggers Alarm ALM-9024 (Spindle Thermal Overload) on Makino VMC-42 to trigger automatic Smart Dispatch rebalancing.
              </p>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => handleInjectFault('MACHINE_ALARM', 'VMC-42', { alarmCode: 'ALM-9024', alarmMessage: 'Spindle Drive Inverter Overcurrent' })}
                className="btn-secondary flex-1 text-xs py-1.5 text-[#D9473F] border-[#D9473F]/40"
              >
                Trigger Breakdown
              </button>
              <button
                type="button"
                onClick={() => handleInjectFault('MACHINE_CLEAR', 'VMC-42')}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Fault 3: Battery Drain */}
          <div className="p-3 bg-[#14161A] border border-[#2A2E35] rounded-sm flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between font-mono">
                <span className="font-bold text-[#E7E9EC]">3. Tag Battery Critical Depletion</span>
                <span className="text-[10px] text-[#E08A2E]">TAG-000115 (12%)</span>
              </div>
              <p className="text-[11px] text-[#9AA0A8] mt-1">
                Drains pouch tag voltage to 2,650 mV (12%) to verify proactive replacement alert generation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleInjectFault('BATTERY_DRAIN', 'TAG-000115')}
              className="btn-secondary text-xs py-1.5 text-[#E08A2E] border-[#E08A2E]/40"
            >
              Drain Tag to 12%
            </button>
          </div>

          {/* Fault 4: Rush Order Injection */}
          <div className="p-3 bg-[#14161A] border border-[#2A2E35] rounded-sm flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between font-mono">
                <span className="font-bold text-[#E7E9EC]">4. Expedited Rush Order Injection</span>
                <span className="text-[10px] text-[#F2A900]">DEFENSE / AERO</span>
              </div>
              <p className="text-[11px] text-[#9AA0A8] mt-1">
                Injects 75 pouches for Tier-1 Defense Customer with 8h SLA, testing dynamic priority queue preemption.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleInjectFault('RUSH_ORDER')}
              className="btn-primary text-xs py-1.5"
            >
              Inject 75-Pouch Rush Order
            </button>
          </div>

          {/* Fault 5: Wrong Route Deviation */}
          <div className="col-span-1 md:col-span-2 p-3 bg-[#14161A] border border-[#2A2E35] rounded-sm flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-mono">
                <span className="font-bold text-[#E7E9EC]">5. Routing Violation: Skip First-Piece QC</span>
                <span className="text-[10px] text-[#D9473F] font-semibold">CRITICAL NON-CONFORMANCE</span>
              </div>
              <p className="text-[11px] text-[#9AA0A8] mt-0.5">
                Moves un-inspected pouch directly from Setup to Roughing, triggering immediate red lockout alert.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleInjectFault('WRONG_ROUTE', 'PCH-24-000458-01')}
              className="btn-secondary text-xs py-1.5 px-4 text-[#D9473F] border-[#D9473F]/40 flex-shrink-0"
            >
              Trigger Route Violation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
