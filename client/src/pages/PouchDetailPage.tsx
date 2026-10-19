import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Volume2, 
  Clock, 
  MapPin, 
  Battery, 
  Signal, 
  FileText, 
  Check 
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';

interface PouchDetailPageProps {
  pouchCode: string;
  onBack: () => void;
  onInspectMachine: (machineId: string) => void;
}

export const PouchDetailPage: React.FC<PouchDetailPageProps> = ({
  pouchCode,
  onBack,
  onInspectMachine,
}) => {
  const { triggerBuzzer } = useSocket();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pouches/${pouchCode}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [pouchCode]);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-[#9AA0A8] font-mono">
        Loading physical pouch lifecycle and resolved movement events...
      </div>
    );
  }

  if (!data || !data.pouch) {
    return (
      <div className="p-8 text-center text-xs text-[#D9473F] font-mono">
        Pouch {pouchCode} not found in database.
        <button 
          type="button"
          onClick={onBack} 
          className="btn-secondary text-xs block mx-auto mt-3 px-3 py-1"
        >
          Return to Live Floor
        </button>
      </div>
    );
  }

  const { pouch, timeline } = data;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 max-w-5xl mx-auto w-full bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Header Toolbar */}
      <div className="scada-panel p-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="btn-icon"
            title="Back to Previous View"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base text-[#F2A900]">
                {pouch.pouch_code}
              </span>
              <span className="px-1.5 py-0.5 rounded-sm bg-[#14161A] border border-[#2A2E35] font-mono text-[10px] text-[#3FA37A]">
                CYCLE #{pouch.cycle_number || 1} ACTIVE
              </span>
            </div>
            <div className="text-xs text-[#9AA0A8] font-mono mt-0.5">
              Work Order: <strong className="text-[#E7E9EC]">{pouch.work_order_no}</strong> • Tag: {pouch.tag_code}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => triggerBuzzer(pouch.pouch_code)}
          className="btn-primary text-xs py-1.5 px-3"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Buzz Physical Tag</span>
        </button>
      </div>

      {/* 2. Definition Lists (Product & Sensor Fusion) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Workpiece & Product Definition */}
        <div className="scada-panel">
          <div className="section-header">
            <span>Workpiece & Engineering Definition</span>
          </div>

          <div className="def-list">
            <div className="def-row">
              <span className="def-label">Part Number</span>
              <span className="def-value">{pouch.part_number}</span>
            </div>
            <div className="def-row">
              <span className="def-label">Part Description</span>
              <span className="def-value font-sans text-xs">{pouch.part_name}</span>
            </div>
            <div className="def-row">
              <span className="def-label">Customer</span>
              <span className="def-value font-sans text-xs">{pouch.customer_name}</span>
            </div>
            <div className="def-row">
              <span className="def-label">Material Grade</span>
              <span className="def-value">{pouch.material_grade}</span>
            </div>
            <div className="def-row">
              <span className="def-label">Drawing Number</span>
              <span className="def-value">{pouch.drawing_no} (Rev {pouch.drawing_rev || 'A'})</span>
            </div>
            <div className="def-row">
              <span className="def-label">Order Quantity</span>
              <span className="def-value font-mono">
                {pouch.completed_quantity || 0} / {pouch.order_quantity || 100} pcs
              </span>
            </div>
          </div>
        </div>

        {/* Real-Time Sensor Fusion Telemetry */}
        <div className="scada-panel">
          <div className="section-header">
            <span>Sensor Fusion & Location Telemetry</span>
            <span className="font-mono text-xs text-[#3FA37A]">
              {pouch.confidence_pct}% CONFIDENCE
            </span>
          </div>

          <div className="def-list">
            <div className="def-row">
              <span className="def-label">Current Zone</span>
              <span className="def-value font-sans text-xs">{pouch.zone_name}</span>
            </div>
            <div className="def-row">
              <span className="def-label">Resolved Location ID</span>
              <span className="def-value text-[#3FA37A] font-bold">{pouch.current_location_id}</span>
            </div>
            <div className="def-row">
              <span className="def-label">Location Type</span>
              <span className="def-value font-mono text-[11px]">{pouch.current_location_type}</span>
            </div>
            <div className="def-row">
              <span className="def-label">Tag Battery</span>
              <span className="def-value">
                {pouch.battery_pct}% ({pouch.battery_mv || 3250} mV)
              </span>
            </div>
            <div className="def-row">
              <span className="def-label">Cycle Mapped At</span>
              <span className="def-value font-mono text-xs">
                {new Date(pouch.mapped_at).toLocaleString()}
              </span>
            </div>
            <div className="def-row">
              <span className="def-label">Delivery Risk Score</span>
              <span className="def-value font-mono text-xs text-[#E08A2E]">
                {pouch.delivery_risk_score ? `${pouch.delivery_risk_score} / 100` : 'LOW (12/100)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Physical Movement Timeline */}
      <div className="scada-panel flex flex-col">
        <div className="section-header">
          <span>Physical Movement Timeline & Audit Trail</span>
          <span className="font-mono text-xs text-[#9AA0A8]">{timeline?.length || 0} Events Logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="scada-table compact">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Resolved Zone</th>
                <th>Station / Machine</th>
                <th>Gateway Receiver</th>
                <th>Operator</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {timeline && timeline.length > 0 ? (
                timeline.map((ev: any, idx: number) => (
                  <tr key={idx}>
                    <td className="font-mono text-xs">{new Date(ev.timestamp).toLocaleString()}</td>
                    <td className="text-xs">{ev.zone_name || 'Floor Area'}</td>
                    <td className="font-mono text-xs font-semibold text-[#E7E9EC]">
                      {ev.location_id || 'Transit'}
                    </td>
                    <td className="font-mono text-xs text-[#9AA0A8]">{ev.reader_id || 'RX-08'}</td>
                    <td className="font-mono text-xs text-[#9AA0A8]">{ev.operator_name || 'Auto Gate'}</td>
                    <td className="font-mono">
                      <span className={ev.confidence_pct >= 90 ? 'text-[#3FA37A]' : 'text-[#E08A2E]'}>
                        {ev.confidence_pct || 88}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-[#9AA0A8] italic">
                    No movement events recorded for current cycle.
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
