import React from 'react';
import { useSocket } from '../context/SocketContext.js';

interface KpiStripProps {
  onSelectMetric?: (metricKey: string) => void;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ onSelectMetric }) => {
  const { twinState } = useSocket();
  const kpis = twinState?.kpis;

  const kpiAny = kpis as any;
  const totalPouches = kpiAny?.totalActivePouches || kpiAny?.activePouches || 2643;
  const runningMachines = kpis?.runningMachines || 72;
  const totalMachines = kpiAny?.totalMachines || 111;
  const openAlerts = kpis?.openAlerts || 3;
  const rackUtil = kpiAny?.rackUtilizationPct || 75;
  const oee = kpiAny?.systemOeePct || 91.4;

  const sparklineData = {
    pouches: [2610, 2622, 2618, 2635, 2640, 2643],
    machines: [68, 70, 71, 69, 73, 72],
    racks: [72, 73, 73, 74, 75, 75],
    alerts: [1, 2, 4, 3, 2, openAlerts],
    oee: [89.8, 90.5, 91.0, 90.8, 91.2, oee],
  };

  const renderSparkline = (points: number[], color: string) => {
    const min = Math.min(...points);
    const max = Math.max(...points) || 1;
    const range = max - min || 1;
    const width = 64;
    const height = 18;

    const coords = points.map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="overflow-visible flex-shrink-0" aria-hidden="true">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords}
        />
      </svg>
    );
  };

  return (
    <div className="kpi-strip border-b border-[#2A2E35]">
      {/* 1. Active Pouches */}
      <div 
        className="kpi-cell" 
        onClick={() => onSelectMetric?.('pouches')}
        title="Click to view active pouches list"
      >
        <div className="kpi-label">
          <span>Active Pouches</span>
          <span className="text-[10px] text-[#3FA37A]">+18 vs yday</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="kpi-number tabular-nums">
            {totalPouches.toLocaleString()}
          </div>
          {renderSparkline(sparklineData.pouches, '#9AA0A8')}
        </div>
      </div>

      {/* 2. Tracked CNCs */}
      <div 
        className="kpi-cell" 
        onClick={() => onSelectMetric?.('machines')}
        title="Click to filter machines"
      >
        <div className="kpi-label">
          <span>Tracked CNCs</span>
          <span className="text-[10px] text-[#9AA0A8]">90 VMC • 21 WEDM</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="kpi-number tabular-nums">
            <span style={{ color: 'var(--status-running)' }}>{runningMachines}</span>
            <span className="text-sm font-normal text-[#9AA0A8]"> / {totalMachines}</span>
          </div>
          {renderSparkline(sparklineData.machines, 'var(--status-running)')}
        </div>
      </div>

      {/* 3. WIP Rack Utilization */}
      <div 
        className="kpi-cell" 
        onClick={() => onSelectMetric?.('racks')}
        title="Click to view WIP rack storage"
      >
        <div className="kpi-label">
          <span>WIP Storage</span>
          <span className="text-[10px] text-[#9AA0A8]">36 Racks • 432 Slots</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="kpi-number tabular-nums">
            {rackUtil}<span className="text-sm font-normal text-[#9AA0A8]">%</span>
          </div>
          {renderSparkline(sparklineData.racks, '#9AA0A8')}
        </div>
      </div>

      {/* 4. Plant OEE */}
      <div 
        className="kpi-cell" 
        onClick={() => onSelectMetric?.('oee')}
        title="Click to view OEE analytics"
      >
        <div className="kpi-label">
          <span>Plant OEE</span>
          <span className="text-[10px] text-[#3FA37A]">Target 90%</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="kpi-number tabular-nums">
            {oee}<span className="text-sm font-normal text-[#9AA0A8]">%</span>
          </div>
          {renderSparkline(sparklineData.oee, '#4C8DD6')}
        </div>
      </div>

      {/* 5. Industrial Alerts */}
      <div 
        className="kpi-cell" 
        onClick={() => onSelectMetric?.('alerts')}
        title="Click to view active shop-floor alerts"
        style={{
          backgroundColor: openAlerts > 0 ? 'rgba(217, 71, 63, 0.08)' : undefined,
        }}
      >
        <div className="kpi-label">
          <span style={{ color: openAlerts > 0 ? 'var(--status-alarm)' : 'var(--text-secondary)' }}>
            Active Alerts
          </span>
          {openAlerts > 0 ? (
            <span className="text-[10px] font-semibold text-[#D9473F] alarm-pulsing">ACTION REQ</span>
          ) : (
            <span className="text-[10px] text-[#3FA37A]">Normal</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div 
            className="kpi-number tabular-nums"
            style={{ color: openAlerts > 0 ? 'var(--status-alarm)' : 'var(--text-primary)' }}
          >
            {openAlerts}
          </div>
          {renderSparkline(sparklineData.alerts, openAlerts > 0 ? 'var(--status-alarm)' : '#9AA0A8')}
        </div>
      </div>
    </div>
  );
};
