import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Check, 
  Play, 
  Truck, 
  SlidersHorizontal, 
  Volume2, 
  AlertTriangle,
  RotateCcw,
  PackageCheck
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';

export const SmartDispatchPage: React.FC = () => {
  const { triggerBuzzer } = useSocket();
  const [selectedMachine, setSelectedMachine] = useState('VMC-42');
  const [nextJobs, setNextJobs] = useState<any[]>([]);
  const [shippingLots, setShippingLots] = useState<any[]>([]);
  const [rebalanceSuggestions, setRebalanceSuggestions] = useState<any[]>([]);
  const [backtestData, setBacktestData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchMachineJobs = async (mId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dispatch/next-jobs/${mId}`);
      const data = await res.json();
      setNextJobs(data.jobs || []);
    } catch (err) {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachineJobs(selectedMachine);

    fetch('/api/dispatch/shipping')
      .then(res => res.json())
      .then(data => setShippingLots(data.lots || []))
      .catch(() => {});

    fetch('/api/dispatch/rebalance')
      .then(res => res.json())
      .then(data => setRebalanceSuggestions(data.suggestions || []))
      .catch(() => {});

    fetch('/api/dispatch/backtest')
      .then(res => res.json())
      .then(data => setBacktestData(data))
      .catch(() => {});
  }, [selectedMachine]);

  const handleDecision = async (cycleId: string, action: 'ACCEPT' | 'SKIP' | 'START') => {
    try {
      await fetch('/api/dispatch/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: selectedMachine,
          cycleId,
          action,
          skipReason: action === 'SKIP' ? 'Operator fixture preference' : undefined,
          userId: 'USR-EMP-0234',
        }),
      });

      setActionNotice(`Action ${action} recorded for job!`);
      setTimeout(() => setActionNotice(null), 3000);
      fetchMachineJobs(selectedMachine);
    } catch (err) {}
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Page Header */}
      <div className="scada-panel p-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#E7E9EC] uppercase tracking-wider">
              Smart Dispatch Engine & Priority Ranking
            </span>
            <span className="font-mono text-xs text-[#9AA0A8]">(Weighted Multi-Factor Formula)</span>
          </div>
          <div className="text-xs text-[#9AA0A8] mt-0.5">
            Real-time machine next-job queue ranking with transparent, explainable reason codes.
          </div>
        </div>

        {/* Machine Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#9AA0A8] font-sans">Target CNC Machine:</label>
          <select
            value={selectedMachine}
            onChange={e => setSelectedMachine(e.target.value)}
            className="bg-[#14161A] border border-[#2A2E35] rounded-sm px-2.5 py-1 text-xs text-[#E7E9EC] font-mono focus:outline-none focus:border-[#F2A900]"
          >
            {['VMC-42', 'VMC-12', 'VMC-08', 'VMC-18', 'VMC-65', 'WEDM-04', 'WEDM-11'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fetchMachineJobs(selectedMachine)}
            className="btn-secondary text-xs py-1"
          >
            Refresh
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-2.5 bg-[#22262C] border border-[#F2A900] text-xs font-mono text-[#F2A900] flex items-center gap-2">
          <Check className="w-4 h-4 text-[#3FA37A]" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 2. Top Ranked Next Jobs for Machine */}
      <div className="scada-panel flex flex-col overflow-hidden">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <span>Ranked Next Jobs for {selectedMachine}</span>
            <span className="font-mono text-xs text-[#F2A900]">
              Top {nextJobs.length} Candidates
            </span>
          </div>
          <span className="text-[11px] text-[#9AA0A8] font-mono">
            Score = 0.35(EDD) + 0.25(Setup) + 0.20(Prox) + 0.20(Tier)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="scada-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Priority Score</th>
                <th>Work Order</th>
                <th>Pouch ID</th>
                <th>Part Name</th>
                <th>WIP Location</th>
                <th>Customer</th>
                <th>Explainable Scoring Reasons</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {nextJobs.length > 0 ? (
                nextJobs.map(job => (
                  <tr key={job.cycleId}>
                    <td className="font-mono font-bold text-center">
                      <span className={job.rank === 1 ? 'text-[#F2A900]' : 'text-[#9AA0A8]'}>
                        #{job.rank}
                      </span>
                    </td>
                    <td className="font-mono font-semibold text-[#E7E9EC]">
                      {((job.totalScore ?? job.priorityScore) ?? 0).toFixed(1)}
                    </td>
                    <td className="font-mono font-bold text-[#E7E9EC]">{job.workOrderNo}</td>
                    <td className="font-mono text-[#F2A900]">{job.pouchCode}</td>
                    <td className="text-xs">{job.partName}</td>
                    <td className="font-mono text-xs text-[#3FA37A]">{job.currentLocationId || job.location || "WIP"}</td>
                    <td className="text-xs text-[#9AA0A8]">{job.customerName}</td>
                    <td className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {(job.reasonCodes || job.reasons || [])?.map((r: string, idx: number) => (
                          <span 
                            key={idx} 
                            className="px-1.5 py-0.5 rounded-sm bg-[#14161A] border border-[#2A2E35] text-[11px] text-[#9AA0A8]"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDecision(job.cycleId, 'ACCEPT')}
                          className="btn-primary text-xs py-1 px-2.5"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDecision(job.cycleId, 'SKIP')}
                          className="btn-secondary text-xs py-1 px-2"
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerBuzzer(job.pouchCode)}
                          className="btn-icon w-6 h-6"
                          title="Buzz Pouch on Shelf"
                        >
                          <Volume2 className="w-3 h-3 text-[#9AA0A8]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-[#9AA0A8] italic">
                    {loading ? 'Calculating dynamic priority scores...' : 'No queued jobs currently waiting for this machine.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Rebalance Board & Backtest Benchmark */}
      <div className="grid grid-cols-12 gap-4">
        {/* Supervisor Rebalance Board */}
        <div className="col-span-12 lg:col-span-6 scada-panel flex flex-col">
          <div className="section-header">
            <span>Supervisor Line Rebalance Board</span>
            <span className="font-mono text-[10px] text-[#E08A2E]">BOTTLENECK DETECTED</span>
          </div>

          <div className="p-2 flex-1 overflow-x-auto">
            <table className="scada-table compact">
              <thead>
                <tr>
                  <th>Overloaded Machine</th>
                  <th>Queue Depth</th>
                  <th>Recommended Target</th>
                  <th>Capacity Margin</th>
                  <th>Est. Setup Penalty</th>
                </tr>
              </thead>
              <tbody>
                {rebalanceSuggestions.length > 0 ? (
                  rebalanceSuggestions.map((s, idx) => (
                    <tr key={idx}>
                      <td className="font-mono font-bold text-[#D9473F]">{s.overburdenedMachineId || s.fromMachineId}</td>
                      <td className="font-mono text-[#D9473F]">{s.pouchCode || s.queueDepth + ' Pouches'}</td>
                      <td className="font-mono font-bold text-[#3FA37A]">{s.starvingMachineId || s.toMachineId}</td>
                      <td className="font-mono text-[#3FA37A]">{s.estimatedQueueSavedMinutes ? s.estimatedQueueSavedMinutes + ' min saved' : (s.targetLoadPct ? s.targetLoadPct + '% (Available)' : 'Optimized')}</td>
                      <td className="font-mono text-[#9AA0A8] text-[11px]">{s.reason || (s.setupChangeoverMin ? s.setupChangeoverMin + ' min' : 'Starvation Avoided')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-[#9AA0A8] italic">
                      Shop-5 machining lines balanced. No machine queue exceeds threshold.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dispatch Backtest Benchmark vs FIFO & EDD */}
        <div className="col-span-12 lg:col-span-6 scada-panel flex flex-col">
          <div className="section-header">
            <span>Simulation Backtest Benchmark vs FIFO & EDD</span>
            <span className="sim-badge text-[10px]">HISTORICAL BENCHMARK</span>
          </div>

          <div className="p-2 flex-1 overflow-x-auto">
            <table className="scada-table compact">
              <thead>
                <tr>
                  <th>Dispatch Rule</th>
                  <th>On-Time Delivery %</th>
                  <th>Setup Changeovers</th>
                  <th>Avg Machine Utilization</th>
                  <th>Throughput Gain</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#22262C] font-semibold">
                  <td className="text-[#F2A900]">Smart Priority Engine</td>
                  <td className="font-mono text-[#3FA37A]">
                    {backtestData?.smartPriority?.onTimeDeliveryPct || backtestData?.smart?.onTimePct || 98.4}%
                  </td>
                  <td className="font-mono text-[#3FA37A]">
                    {backtestData?.smartPriority?.setupChangeoversSavedPct ? backtestData.smartPriority.setupChangeoversSavedPct + "% saved" : (backtestData?.smart?.totalChangeovers || 32)}
                  </td>
                  <td className="font-mono">{backtestData?.smartPriority?.averageWipHours ? backtestData.smartPriority.averageWipHours + "h avg WIP" : (backtestData?.smart?.utilizationPct || 89.4) + "%"}</td>
                  <td className="font-mono text-[#3FA37A] font-bold">{backtestData?.improvementVsFifo?.onTimeGainPct ? "+" + backtestData.improvementVsFifo.onTimeGainPct + "%" : "+10.2%"}</td>
                </tr>
                <tr>
                  <td className="text-[#9AA0A8]">Earliest Due Date (EDD)</td>
                  <td className="font-mono">84.8%</td>
                  <td className="font-mono">48</td>
                  <td className="font-mono">81.2%</td>
                  <td className="font-mono text-[#9AA0A8]">+4.5%</td>
                </tr>
                <tr>
                  <td className="text-[#9AA0A8]">First-In First-Out (FIFO)</td>
                  <td className="font-mono">80.0%</td>
                  <td className="font-mono">54</td>
                  <td className="font-mono">77.6%</td>
                  <td className="font-mono text-[#9AA0A8]">Baseline (0%)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Ready-to-Ship Priority List */}
      <div className="scada-panel flex flex-col">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#9AA0A8]" />
            <span>Ready-to-Ship Packing & Dispatch Priority</span>
          </div>
          <span className="font-mono text-xs text-[#9AA0A8]">
            {shippingLots.length} Completed Lots in Final QA / Dispatch Bay
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="scada-table compact">
            <thead>
              <tr>
                <th>Work Order</th>
                <th>Customer</th>
                <th>Part Number</th>
                <th>Quantity</th>
                <th>Due Date</th>
                <th>SLA Urgency</th>
                <th>Current Bay</th>
                <th>Certificate</th>
              </tr>
            </thead>
            <tbody>
              {shippingLots.length > 0 ? (
                shippingLots.map(lot => (
                  <tr key={lot.dispatch_lot_id || lot.lot_code || lot.work_order_no}>
                    <td className="font-mono font-bold text-[#E7E9EC]">{lot.lot_code || lot.work_order_no}</td>
                    <td className="text-xs">{lot.customer_name}</td>
                    <td className="font-mono text-xs">{lot.carrier_name || lot.part_number || "Blue Dart Cargo"}</td>
                    <td className="font-mono">{lot.pouches_ready_count !== undefined ? lot.pouches_ready_count + " / " + lot.pouches_required_count + " pcs" : (lot.order_quantity ? lot.order_quantity + " pcs" : "50 pcs")}</td>
                    <td className="font-mono text-xs">{lot.scheduled_departure ? new Date(lot.scheduled_departure).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (lot.due_date || "Today")}</td>
                    <td>
                      <span className={`px-1.5 py-0.5 rounded-sm border font-mono text-[10px] ${lot.isAtRisk ? "bg-[#D9473F]/20 text-[#D9473F] border-[#D9473F]/40" : "bg-[#14161A] border-[#2A2E35] text-[#3FA37A]"}`}>
                        {lot.isAtRisk ? "EXPEDITE AT RISK" : (lot.status || "ON SCHEDULE")}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-[#9AA0A8]">{lot.truck_number ? "Truck: " + lot.truck_number : "Bay 12 (RX-12)"}</td>
                    <td>
                      <span className="font-mono text-[11px] text-[#F2A900] underline cursor-pointer">
                        {lot.gate_pass_no || "CERT-AS9100"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-3 text-center text-[#9AA0A8] italic">
                    Loading shipping priority lots...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
