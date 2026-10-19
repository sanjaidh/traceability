import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Battery, 
  Signal, 
  MapPin, 
  Clock, 
  User, 
  AlertTriangle, 
  Volume2, 
  FileText, 
  SlidersHorizontal,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';
import { ShopFloorCanvas } from '../twin/ShopFloorCanvas.js';
import { KpiStrip } from '../components/KpiStrip.js';

interface LiveDashboardProps {
  onInspectPouch: (pouchCode: string) => void;
  onInspectMachine: (machineId: string) => void;
  onNavigateTo: (tab: string, query?: string) => void;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({
  onInspectPouch,
  onInspectMachine,
  onNavigateTo,
}) => {
  const { twinState, triggerBuzzer } = useSocket();

  const [searchInput, setSearchInput] = useState('WO-100458');
  const [selectedPouch, setSelectedPouch] = useState<any>({
    pouchCode: 'PCH-24-000458-01',
    tagCode: 'TAG-005432',
    partNumber: 'INDO-AERO-IMP-04',
    partName: 'Titanium Impeller Rotor (TI-6AL-4V)',
    workOrderNo: 'WO-100458',
    currentZone: 'VMC Zone - B',
    currentLocation: 'VMC-42',
    locationType: 'MACHINE',
    readerId: 'RX-08',
    lastSeenAt: Date.now() - 14000,
    batteryPct: 88,
    batteryMv: 3240,
    rssi: -52,
    status: 'IN_PROCESS',
    operatorId: 'USR-EMP-0234',
    drawingNo: 'DRG-7712-B',
    customer: 'Boeing Aerospace (Tier-1)',
    heatNumber: 'HT-8829-X',
    confidencePct: 92,
  });

  const [movements, setMovements] = useState<any[]>([
    { id: 1, pouchCode: 'PCH-24-000458-01', wo: 'WO-100458', zone: 'VMC Zone - B', location: 'VMC-42 (Makino Slim3n)', reader: 'RX-08', time: '14 s ago', type: 'MACHINE_TELEMETRY', conf: 92 },
    { id: 2, pouchCode: 'PCH-24-000458-02', wo: 'WO-100458', zone: 'WIP Racks', location: 'Rack RCK-08-C3', reader: 'RX-03', time: '42 s ago', type: 'RACK_CONFIRMED', conf: 99 },
    { id: 3, pouchCode: 'PCH-24-000312-01', wo: 'WO-100452', zone: 'VMC Zone - A', location: 'VMC-12', reader: 'RX-07', time: '1 min ago', type: 'ZONE_PRESENCE', conf: 80 },
    { id: 4, pouchCode: 'PCH-24-000189-01', wo: 'WO-100449', zone: 'CMM Quality Room', location: 'Zeiss Prismo CMM', reader: 'RX-06', time: '3 min ago', type: 'MACHINE_TELEMETRY', conf: 94 },
    { id: 5, pouchCode: 'PCH-24-000780-01', wo: 'WO-100440', zone: 'Machine Packing', location: 'Ultrasonic Bath #2', reader: 'RX-11', time: '5 min ago', type: 'ZONE_PRESENCE', conf: 82 },
  ]);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [tableDensity, setTableDensity] = useState<'comfortable' | 'compact'>('comfortable');

  useEffect(() => {
    fetch('/api/alerts?status=OPEN')
      .then(res => res.json())
      .then(data => {
        if (data.alerts) setAlerts(data.alerts.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchInput.trim()) return;

    try {
      const res = await fetch(`/api/pouches?q=${encodeURIComponent(searchInput.trim())}&limit=1`);
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        const item = json.data[0];
        setSelectedPouch({
          pouchCode: item.pouch_code,
          tagCode: item.tag_code,
          partNumber: item.part_number,
          partName: item.part_name,
          workOrderNo: item.work_order_no,
          currentZone: item.zone_name,
          currentLocation: item.current_location_id || item.current_zone_id,
          locationType: item.current_location_type || 'ZONE',
          readerId: 'RX-08',
          lastSeenAt: new Date(item.last_seen_at).getTime(),
          batteryPct: item.battery_pct || 90,
          batteryMv: 3250,
          rssi: -54,
          status: 'IN_PROCESS',
          operatorId: 'USR-STORE-01',
          drawingNo: item.drawing_no || 'DRG-8819-A',
          customer: item.customer_name || 'Boeing Aerospace',
          heatNumber: 'HT-9921-A',
          confidencePct: item.confidence_pct || 88,
        });
      }
    } catch {
      // fallback to mock
    }
  };

  const getRelativeTime = (timestampMs: number) => {
    const elapsedSec = Math.floor((Date.now() - timestampMs) / 1000);
    if (elapsedSec < 60) return `${Math.max(1, elapsedSec)} s ago`;
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin} min ago`;
    return `${Math.floor(elapsedMin / 60)} h ago`;
  };

  const isStale = (Date.now() - selectedPouch.lastSeenAt) > 300000; // > 5 minutes

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Continuous Hairline KPI Strip */}
      <KpiStrip 
        onSelectMetric={(key) => {
          if (key === 'alerts') onNavigateTo('alerts');
          else if (key === 'racks') onNavigateTo('racks');
          else if (key === 'oee') onNavigateTo('reports');
        }} 
      />

      {/* 2. Main Workspace: Map (Left/Center) + Detail Panel (Right) */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left/Center: CAD Engineering Map View */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col border-r border-[#2A2E35] overflow-hidden">
          {/* Map Sub-Header Bar */}
          <div className="h-8 bg-[#1B1E23] border-b border-[#2A2E35] px-3 flex items-center justify-between text-xs text-[#9AA0A8] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-wider text-[11px] text-[#E7E9EC]">
                Shop-5 Layout CAD
              </span>
              <span>•</span>
              <span className="font-mono text-[11px]">118.10 m × 60.50 m (7,145 m²)</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span>111 CNCs (90 VMC, 21 WEDM)</span>
              <span>•</span>
              <span>12 BLE/RFID Gateways</span>
            </div>
          </div>

          {/* Interactive Engineering Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <ShopFloorCanvas
              machines={twinState?.machines || []}
              pouches={twinState?.pouches || []}
              selectedPouchCode={selectedPouch.pouchCode}
              onSelectMachine={onInspectMachine}
              onSelectPouch={(code) => {
                setSearchInput(code);
                onInspectPouch(code);
              }}
            />
          </div>

          {/* Bottom Live Movements Table */}
          <div className="h-44 bg-[#1B1E23] border-t border-[#2A2E35] flex flex-col overflow-hidden flex-shrink-0">
            <div className="section-header">
              <div className="flex items-center gap-2">
                <span>Recent Resolved Movements</span>
                <span className="font-mono text-[10px] text-[#9AA0A8]">
                  (Kalman Filtered • 4 dBm Hysteresis)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTableDensity(d => d === 'comfortable' ? 'compact' : 'comfortable')}
                  className="text-[11px] text-[#9AA0A8] hover:text-[#E7E9EC] font-sans"
                >
                  Density: {tableDensity === 'comfortable' ? '36px' : '28px'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className={`scada-table ${tableDensity === 'compact' ? 'compact' : ''}`}>
                <thead>
                  <tr>
                    <th>Pouch ID</th>
                    <th>Work Order</th>
                    <th>Resolved Location</th>
                    <th>Gateway</th>
                    <th>Last Seen</th>
                    <th>Resolution Tier</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(m => (
                    <tr 
                      key={m.id}
                      onClick={() => onInspectPouch(m.pouchCode)}
                      className="cursor-pointer"
                    >
                      <td className="font-mono font-medium text-[#F2A900]">{m.pouchCode}</td>
                      <td className="font-mono text-[#E7E9EC]">{m.wo}</td>
                      <td>{m.location}</td>
                      <td className="font-mono text-[#9AA0A8]">{m.reader}</td>
                      <td className="font-mono text-[#9AA0A8]">{m.time}</td>
                      <td>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#22262C] border border-[#2A2E35] text-[#9AA0A8]">
                          {m.type}
                        </span>
                      </td>
                      <td className="font-mono">
                        <span className={m.conf >= 90 ? 'text-[#3FA37A]' : 'text-[#E08A2E]'}>
                          {m.conf}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Compact Detail Panel (Definition List per spec) */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 bg-[#1B1E23] flex flex-col overflow-y-auto" style={{ backgroundColor: 'var(--bg-panel)' }}>
          {/* Quick Search Header */}
          <div className="p-3 border-b border-[#2A2E35]">
            <form onSubmit={handleSearch} className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#9AA0A8] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Scan or enter WO / Pouch..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="w-full bg-[#14161A] border border-[#2A2E35] rounded-sm pl-8 pr-2 py-1.5 text-xs text-[#E7E9EC] font-mono focus:outline-none focus:border-[#F2A900]"
                />
              </div>
              <button type="submit" className="btn-primary text-xs py-1.5 px-3">
                Inspect
              </button>
            </form>
          </div>

          {/* Live Product Information Definition List */}
          <div className="flex-1 p-3 flex flex-col gap-3">
            <div className="scada-panel">
              <div className="section-header">
                <span>Selected Pouch Definition</span>
                <span className="font-mono text-[#F2A900] text-xs">
                  {selectedPouch.confidencePct}% Conf
                </span>
              </div>

              <div className="def-list">
                <div className="def-row">
                  <span className="def-label">Work Order</span>
                  <span className="def-value text-[#F2A900] font-semibold">
                    {selectedPouch.workOrderNo}
                  </span>
                </div>
                <div className="def-row">
                  <span className="def-label">Pouch Code</span>
                  <span className="def-value">{selectedPouch.pouchCode}</span>
                </div>
                <div className="def-row">
                  <span className="def-label">BLE Tag ID</span>
                  <span className="def-value">{selectedPouch.tagCode}</span>
                </div>
                <div className="def-row">
                  <span className="def-label">Part Number</span>
                  <span className="def-value">{selectedPouch.partNumber}</span>
                </div>
                <div className="def-row">
                  <span className="def-label">Part Name</span>
                  <span className="def-value font-sans text-xs text-right truncate max-w-[160px]">
                    {selectedPouch.partName}
                  </span>
                </div>
                <div className="def-row">
                  <span className="def-label">Customer</span>
                  <span className="def-value font-sans text-xs">{selectedPouch.customer}</span>
                </div>
                <div className="def-row">
                  <span className="def-label">Drawing Rev</span>
                  <span className="def-value">{selectedPouch.drawingNo}</span>
                </div>
                <div className="def-row">
                  <span className="def-label">Raw Material Heat</span>
                  <span className="def-value">{selectedPouch.heatNumber}</span>
                </div>
              </div>
            </div>

            {/* Live Physical Location Definition */}
            <div className="scada-panel">
              <div className="section-header">
                <span>Physical Floor Location</span>
                <span className="text-[10px] text-[#3FA37A] font-mono">TIER 2 (MACHINE)</span>
              </div>

              <div className="def-list">
                <div className="def-row">
                  <span className="def-label">Current Zone</span>
                  <span className="def-value font-sans text-xs">{selectedPouch.currentZone}</span>
                </div>
                <div className="def-row">
                  <span className="def-label">Machine / Slot</span>
                  <span className="def-value text-[#3FA37A]">{selectedPouch.currentLocation}</span>
                </div>
                <div className="def-row">
                  <span className="def-label">Hardware Gateway</span>
                  <span className="def-value">{selectedPouch.readerId} (BLE 5.0)</span>
                </div>
                <div className="def-row">
                  <span className="def-label">Last Seen</span>
                  <span 
                    className={`def-value ${isStale ? 'text-[#F2A900]' : 'text-[#E7E9EC]'}`}
                    title={new Date(selectedPouch.lastSeenAt).toLocaleString()}
                  >
                    {getRelativeTime(selectedPouch.lastSeenAt)}
                    {isStale && ' (STALE)'}
                  </span>
                </div>
                <div className="def-row">
                  <span className="def-label">Battery Level</span>
                  <span className="def-value flex items-center gap-1.5">
                    <span className="text-xs text-[#9AA0A8]">{selectedPouch.batteryMv} mV</span>
                    <span className="text-[#3FA37A] font-semibold">{selectedPouch.batteryPct}%</span>
                  </span>
                </div>
                <div className="def-row">
                  <span className="def-label">RF Signal (RSSI)</span>
                  <span className="def-value text-xs">{selectedPouch.rssi} dBm</span>
                </div>
              </div>

              <div className="p-2 border-t border-[#2A2E35] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerBuzzer(selectedPouch.pouchCode)}
                  className="btn-primary flex-1 text-xs py-1.5"
                  title="Trigger Tag Buzzer (Audio Synthesizer)"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Buzz Tag</span>
                </button>
                <button
                  type="button"
                  onClick={() => onInspectPouch(selectedPouch.pouchCode)}
                  className="btn-secondary text-xs py-1.5 px-3"
                  title="View Full Lifecycle History"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>History</span>
                </button>
              </div>
            </div>

            {/* Active Shop-Floor Alerts Mini-Card */}
            {alerts.length > 0 && (
              <div className="scada-panel border-[#D9473F]/40 bg-[#D9473F]/5">
                <div className="section-header text-[#D9473F] border-[#D9473F]/20">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#D9473F]" />
                    <span>Active Shop-Floor Alerts ({alerts.length})</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => onNavigateTo('alerts')}
                    className="text-[10px] text-[#D9473F] underline"
                  >
                    View All
                  </button>
                </div>
                <div className="p-2 flex flex-col gap-1.5 text-xs">
                  {alerts.map(a => (
                    <div key={a.alert_id} className="p-1.5 bg-[#1B1E23] border border-[#2A2E35] rounded-sm">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="text-[#D9473F] font-semibold">{a.rule_code}</span>
                        <span className="text-[#9AA0A8]">{a.work_order_no || a.pouch_code}</span>
                      </div>
                      <div className="text-[11px] text-[#E7E9EC] mt-0.5">{a.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
