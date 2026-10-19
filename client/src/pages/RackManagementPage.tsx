import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  MapPin, 
  Box, 
  Volume2, 
  Check, 
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';

export const RackManagementPage: React.FC = () => {
  const { triggerBuzzer } = useSocket();
  const [racks, setRacks] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [totalSlots, setTotalSlots] = useState(432);
  const [occupiedSlots, setOccupiedSlots] = useState(324);
  const [utilizationPct, setUtilizationPct] = useState(75);

  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [selectedMaterialGroup, setSelectedMaterialGroup] = useState('STAINLESS_STEEL');
  const [suggestedSlot, setSuggestedSlot] = useState<any>(null);
  const [searchPouchQuery, setSearchPouchQuery] = useState('');

  useEffect(() => {
    fetch('/api/racks')
      .then(res => res.json())
      .then(data => {
        setRacks(data.racks || []);
        setSlots(data.slots || []);
        setTotalSlots(data.totalSlots || 432);
        setOccupiedSlots(data.occupiedSlots || 324);
        setUtilizationPct(data.utilizationPct || 75);
        if (data.slots && data.slots.length > 0) {
          const firstOccupied = data.slots.find((s: any) => s.occupied_by_cycle_id) || data.slots[0];
          setSelectedSlot(firstOccupied);
        }
      })
      .catch(() => {});
  }, []);

  const handleSuggestSlot = async () => {
    try {
      const res = await fetch(`/api/racks/suggest-slot?materialGroup=${selectedMaterialGroup}`);
      const data = await res.json();
      setSuggestedSlot(data.suggestedSlot);
    } catch (err) {}
  };

  const filteredSlots = slots.filter(s => {
    if (!searchPouchQuery.trim()) return true;
    const q = searchPouchQuery.toLowerCase();
    return (
      s.slot_code.toLowerCase().includes(q) ||
      (s.pouch_code && s.pouch_code.toLowerCase().includes(q)) ||
      (s.work_order_no && s.work_order_no.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Header Toolbar */}
      <div className="scada-panel p-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#E7E9EC] uppercase tracking-wider">
              WIP Central Rack Storage Management
            </span>
            <span className="font-mono text-xs text-[#9AA0A8]">(36 Racks • 432 Slots)</span>
          </div>
          <div className="text-xs text-[#9AA0A8] mt-0.5">
            Zone ZN-RACK (Gateway RX-03). 3-tier hierarchy: Rack (A–D), Shelf (1–4), Slot (1–3) with material affinity grouping.
          </div>
        </div>

        {/* Occupancy KPIs */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-[#9AA0A8] text-[10px] block uppercase">Occupancy</span>
            <span className="font-bold text-sm text-[#E7E9EC]">
              {occupiedSlots} / {totalSlots} Slots
            </span>
          </div>
          <div className="text-right">
            <span className="text-[#9AA0A8] text-[10px] block uppercase">Utilization</span>
            <span className="font-bold text-sm text-[#3FA37A]">
              {utilizationPct}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. Workspace: Rack Matrix (Left) + Slot Definition Panel (Right) */}
      <div className="grid grid-cols-12 gap-4 flex-1">
        {/* Left: 36 Racks Grid Matrix */}
        <div className="col-span-12 lg:col-span-8 scada-panel flex flex-col overflow-hidden">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <span>WIP Rack Array Matrix (Racks A-1 to D-9)</span>
              <span className="font-mono text-xs text-[#9AA0A8]">Tier 1 Physical Confirmation</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search slot or pouch..."
                value={searchPouchQuery}
                onChange={e => setSearchPouchQuery(e.target.value)}
                className="bg-[#14161A] border border-[#2A2E35] rounded-sm px-2 py-0.5 text-xs text-[#E7E9EC] font-mono focus:outline-none focus:border-[#F2A900]"
              />
            </div>
          </div>

          <div className="p-3 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {racks.map(r => {
                const rackSlots = slots.filter(s => s.rack_id === r.rack_id);
                const occupiedCount = rackSlots.filter(s => s.occupied_by_cycle_id).length;
                const occRate = Math.round((occupiedCount / (rackSlots.length || 12)) * 100);

                return (
                  <div
                    key={r.rack_id}
                    className="p-2 bg-[#14161A] border border-[#2A2E35] rounded-sm flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-bold text-[#E7E9EC]">{r.rack_code}</span>
                      <span className={occRate >= 80 ? 'text-[#D9473F]' : 'text-[#3FA37A]'}>
                        {occupiedCount}/12
                      </span>
                    </div>

                    {/* 12 Slot Mini-Matrix (Levels A, B, C, D) */}
                    <div className="grid grid-cols-3 gap-1">
                      {rackSlots.map(s => {
                        const isOcc = !!s.occupied_by_cycle_id;
                        const isSelected = selectedSlot?.slot_id === s.slot_id;

                        return (
                          <div
                            key={s.slot_id}
                            onClick={() => setSelectedSlot(s)}
                            className={`h-5 rounded-xs border text-[9px] font-mono flex items-center justify-center cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-[#F2A900] bg-[#F2A900]/20 text-[#F2A900] font-bold'
                                : isOcc
                                ? 'bg-[#22262C] border-[#2A2E35] text-[#E7E9EC]'
                                : 'bg-[#111317] border-[#1D2128] text-[#9AA0A8] hover:border-[#2A2E35]'
                            }`}
                            title={`${s.slot_code}: ${isOcc ? s.pouch_code : 'Available'}`}
                          >
                            {s.slot_number}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Slot Detail Definition List & Slot Recommender */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-3">
          {/* Selected Slot Definition */}
          <div className="scada-panel">
            <div className="section-header">
              <span>Shelf Slot Detail</span>
              <span className="font-mono text-xs text-[#F2A900]">
                {selectedSlot?.slot_code || 'RCK-08-C3'}
              </span>
            </div>

            {selectedSlot ? (
              <div className="def-list">
                <div className="def-row">
                  <span className="def-label">Slot Code</span>
                  <span className="def-value text-[#F2A900] font-bold">{selectedSlot.slot_code}</span>
                </div>
                <div className="def-row">
                  <span className="def-label">Rack & Level</span>
                  <span className="def-value font-mono">
                    Rack {selectedSlot.rack_code} • Level {selectedSlot.shelf_level}
                  </span>
                </div>
                <div className="def-row">
                  <span className="def-label">Material Group</span>
                  <span className="def-value font-sans text-xs">
                    {selectedSlot.assigned_material_group || 'TITANIUM'}
                  </span>
                </div>
                <div className="def-row">
                  <span className="def-label">Current Status</span>
                  <span className="def-value">
                    {selectedSlot.occupied_by_cycle_id ? (
                      <span className="text-[#3FA37A] font-bold">OCCUPIED</span>
                    ) : (
                      <span className="text-[#9AA0A8]">AVAILABLE</span>
                    )}
                  </span>
                </div>

                {selectedSlot.occupied_by_cycle_id && (
                  <>
                    <div className="def-row">
                      <span className="def-label">Occupying Pouch</span>
                      <span className="def-value text-[#F2A900]">{selectedSlot.pouch_code}</span>
                    </div>
                    <div className="def-row">
                      <span className="def-label">Work Order</span>
                      <span className="def-value">{selectedSlot.work_order_no}</span>
                    </div>
                    <div className="def-row">
                      <span className="def-label">Part Name</span>
                      <span className="def-value font-sans text-xs">{selectedSlot.part_name}</span>
                    </div>
                    <div className="def-row">
                      <span className="def-label">Customer</span>
                      <span className="def-value font-sans text-xs">{selectedSlot.customer_name}</span>
                    </div>
                  </>
                )}

                {selectedSlot.occupied_by_cycle_id && (
                  <div className="p-2 border-t border-[#2A2E35] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => triggerBuzzer(selectedSlot.pouch_code)}
                      className="btn-primary flex-1 text-xs py-1.5"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Buzz Pouch Tag</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-[#9AA0A8] italic text-xs">
                Select any shelf slot from the grid to inspect details.
              </div>
            )}
          </div>

          {/* Slot Recommendation Engine */}
          <div className="scada-panel">
            <div className="section-header">
              <span>Slot Assignment Recommender</span>
              <span className="font-mono text-xs text-[#3FA37A]">OPTIMAL ALLOCATION</span>
            </div>

            <div className="p-3 flex flex-col gap-2.5 text-xs">
              <div>
                <label className="text-[#9AA0A8] text-[11px] block mb-1">Incoming Material Group:</label>
                <select
                  value={selectedMaterialGroup}
                  onChange={e => setSelectedMaterialGroup(e.target.value)}
                  className="w-full bg-[#14161A] border border-[#2A2E35] rounded-sm p-1.5 font-sans text-xs text-[#E7E9EC]"
                >
                  <option value="STAINLESS_STEEL">Stainless Steel (SS 316L / 17-4PH)</option>
                  <option value="INCONEL">Inconel (718 / 625 High Temp)</option>
                  <option value="TITANIUM">Titanium (TI-6AL-4V Aerospace)</option>
                  <option value="ALUMINUM">Aluminum (6061-T6)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleSuggestSlot}
                className="btn-secondary text-xs py-1.5 w-full"
              >
                Find Nearest Segregated Empty Slot
              </button>

              {suggestedSlot && (
                <div className="p-2.5 bg-[#14161A] border border-[#F2A900] rounded-sm flex flex-col gap-1 mt-1">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-[#F2A900] text-sm">{suggestedSlot.slot_code}</span>
                    <span className="text-[#3FA37A] font-semibold text-xs">EMPTY</span>
                  </div>
                  <div className="text-[11px] text-[#9AA0A8]">
                    Rack {suggestedSlot.rack_code} • Level {suggestedSlot.shelf_level} • Coordinates: ({suggestedSlot.coord_x}m, {suggestedSlot.coord_y}m)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
