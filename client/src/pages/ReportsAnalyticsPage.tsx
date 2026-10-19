import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  ShieldCheck, 
  DollarSign 
} from 'lucide-react';

export const ReportsAnalyticsPage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 max-w-[1720px] mx-auto w-full bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Header Toolbar */}
      <div className="scada-panel p-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#E7E9EC] uppercase tracking-wider">
              Plant Reports, OEE Linkage & Tag Lifecycle Analytics
            </span>
            <span className="sim-badge text-[10px]">SCADA TELEMETRY SYNCHRONIZED</span>
          </div>
          <div className="text-xs text-[#9AA0A8] mt-0.5">
            Correlation of pouch movement timestamps with CNC machine spindle execution for OEE, WIP dwell, and battery life forecasting.
          </div>
        </div>
      </div>

      {/* 2. Before vs After Implementation Performance Benchmark */}
      <div className="scada-panel flex flex-col">
        <div className="section-header">
          <span>Traceability Implementation Performance Benchmark (INDO-MIM Shop-5)</span>
          <span className="font-mono text-xs text-[#3FA37A]">VERIFIED ROI</span>
        </div>

        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="p-2.5 bg-[#14161A] border border-[#2A2E35] rounded-sm">
            <span className="text-[10px] text-[#9AA0A8] block uppercase">Pouch Search Time</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-[#3FA37A]">18 s</span>
              <span className="text-xs text-[#676D76] line-through font-mono">18 min</span>
            </div>
            <span className="text-[10px] text-[#3FA37A] font-semibold mt-1 block">98.3% Time Saved</span>
          </div>

          <div className="p-2.5 bg-[#14161A] border border-[#2A2E35] rounded-sm">
            <span className="text-[10px] text-[#9AA0A8] block uppercase">On-Time Delivery (OTD)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-[#3FA37A]">98.4%</span>
              <span className="text-xs text-[#676D76] line-through font-mono">89.2%</span>
            </div>
            <span className="text-[10px] text-[#3FA37A] font-semibold mt-1 block">+9.2% Improvement</span>
          </div>

          <div className="p-2.5 bg-[#14161A] border border-[#2A2E35] rounded-sm">
            <span className="text-[10px] text-[#9AA0A8] block uppercase">Machine Starvation Idle</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-[#3FA37A]">4.1%</span>
              <span className="text-xs text-[#676D76] line-through font-mono">14.8%</span>
            </div>
            <span className="text-[10px] text-[#3FA37A] font-semibold mt-1 block">72% Idle Reduction</span>
          </div>

          <div className="p-2.5 bg-[#14161A] border border-[#2A2E35] rounded-sm">
            <span className="text-[10px] text-[#9AA0A8] block uppercase">Lost Workpiece Incidents</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-[#3FA37A]">0 / mo</span>
              <span className="text-xs text-[#676D76] line-through font-mono">6 / mo</span>
            </div>
            <span className="text-[10px] text-[#3FA37A] font-semibold mt-1 block">100% Elimination</span>
          </div>

          <div className="p-2.5 bg-[#14161A] border border-[#2A2E35] rounded-sm">
            <span className="text-[10px] text-[#9AA0A8] block uppercase">Setup Changeovers Saved</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-[#4C8DD6]">34.8%</span>
              <span className="text-xs text-[#676D76] font-mono">Grouped</span>
            </div>
            <span className="text-[10px] text-[#4C8DD6] font-semibold mt-1 block">Via Setup Similarity</span>
          </div>
        </div>
      </div>

      {/* 3. OEE Breakdown & Zone Dwell Time Matrix */}
      <div className="grid grid-cols-12 gap-4">
        {/* OEE Telemetry Linkage */}
        <div className="col-span-12 lg:col-span-6 scada-panel flex flex-col">
          <div className="section-header">
            <span>Overall Equipment Effectiveness (OEE) Linkage</span>
            <span className="font-mono text-xs text-[#3FA37A] font-bold">Plant OEE: 88.6%</span>
          </div>

          <div className="p-3 flex flex-col gap-3 text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#9AA0A8]">Availability (Running vs Idle/Alarm):</span>
                <span className="font-mono text-[#E7E9EC] font-bold">91.2%</span>
              </div>
              <div className="h-2 bg-[#14161A] border border-[#2A2E35] overflow-hidden">
                <div className="h-full bg-[#3FA37A]" style={{ width: '91.2%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#9AA0A8]">Performance (Actual vs Planned Feedrate):</span>
                <span className="font-mono text-[#E7E9EC] font-bold">98.4%</span>
              </div>
              <div className="h-2 bg-[#14161A] border border-[#2A2E35] overflow-hidden">
                <div className="h-full bg-[#3FA37A]" style={{ width: '98.4%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[#9AA0A8]">Quality (First-Pass Yield / Metrology Acceptance):</span>
                <span className="font-mono text-[#E7E9EC] font-bold">98.8%</span>
              </div>
              <div className="h-2 bg-[#14161A] border border-[#2A2E35] overflow-hidden">
                <div className="h-full bg-[#3FA37A]" style={{ width: '98.8%' }} />
              </div>
            </div>

            <div className="p-2 bg-[#14161A] border border-[#2A2E35] rounded-sm text-[11px] text-[#9AA0A8] font-mono mt-1">
              Calculation: Availability (91.2%) × Performance (98.4%) × Quality (98.8%) = <strong>88.6% Plant OEE</strong>
            </div>
          </div>
        </div>

        {/* Zone Dwell Time Matrix */}
        <div className="col-span-12 lg:col-span-6 scada-panel flex flex-col">
          <div className="section-header">
            <span>Zone Dwell Times & Transit Bottlenecks</span>
            <span className="font-mono text-xs text-[#9AA0A8]">18-Step Path</span>
          </div>

          <div className="p-2 flex-1 overflow-x-auto">
            <table className="scada-table compact">
              <thead>
                <tr>
                  <th>Shop Floor Zone</th>
                  <th>Active WIP Pouches</th>
                  <th>Avg Dwell Time</th>
                  <th>Target SLA</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-xs">VMC Zone - A (Roughing)</td>
                  <td className="font-mono">412</td>
                  <td className="font-mono">1.8 h</td>
                  <td className="font-mono">2.0 h</td>
                  <td><span className="text-[#3FA37A] font-mono text-[10px] font-bold">NOMINAL</span></td>
                </tr>
                <tr>
                  <td className="text-xs">VMC Zone - B (Finishing)</td>
                  <td className="font-mono">488</td>
                  <td className="font-mono">2.4 h</td>
                  <td className="font-mono">2.5 h</td>
                  <td><span className="text-[#3FA37A] font-mono text-[10px] font-bold">NOMINAL</span></td>
                </tr>
                <tr>
                  <td className="text-xs">Inspection (CMM Metrology)</td>
                  <td className="font-mono">184</td>
                  <td className="font-mono text-[#E08A2E]">3.8 h</td>
                  <td className="font-mono">3.0 h</td>
                  <td><span className="text-[#E08A2E] font-mono text-[10px] font-bold">SLA RISK</span></td>
                </tr>
                <tr>
                  <td className="text-xs">WIP Central Rack Storage</td>
                  <td className="font-mono">680</td>
                  <td className="font-mono">4.2 h</td>
                  <td className="font-mono">6.0 h</td>
                  <td><span className="text-[#3FA37A] font-mono text-[10px] font-bold">BUFFERED</span></td>
                </tr>
                <tr>
                  <td className="text-xs">Dispatch Bay (Packing)</td>
                  <td className="font-mono">215</td>
                  <td className="font-mono">1.2 h</td>
                  <td className="font-mono">2.0 h</td>
                  <td><span className="text-[#3FA37A] font-mono text-[10px] font-bold">READY</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
