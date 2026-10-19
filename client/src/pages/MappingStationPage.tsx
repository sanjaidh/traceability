import React, { useState } from 'react';
import { 
  QrCode, 
  Check, 
  AlertTriangle, 
  RotateCcw, 
  Tag, 
  ShieldCheck 
} from 'lucide-react';

export const MappingStationPage: React.FC = () => {
  const [pouchCode, setPouchCode] = useState('PCH-24-000458-01');
  const [tagCode, setTagCode] = useState('TAG-005432');
  const [workOrderNo, setWorkOrderNo] = useState('WO-100458');
  const [initialSlot, setInitialSlot] = useState('RCK-08-C3');
  const [operatorId, setOperatorId] = useState('USR-STORE-01');
  const [notes, setNotes] = useState('Initial material issue to Raw Storage');

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleMap = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/mapping/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pouchCode,
          tagCode,
          workOrderNo,
          initialSlotCode: initialSlot,
          operatorId,
          notes,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, message: 'Network or server error during mapping.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnmap = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/mapping/unmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pouchCode,
          operatorId,
          reason: 'Finished Goods Dispatch Completed',
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, message: 'Network or server error during unmapping.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 max-w-4xl mx-auto w-full bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Header Toolbar */}
      <div className="scada-panel p-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#E7E9EC] uppercase tracking-wider">
              Pouch Barcode & RFID Tag Mapping Station
            </span>
            <span className="sim-badge text-[10px]">ERP GATEWAY INTEGRATED</span>
          </div>
          <div className="text-xs text-[#9AA0A8] mt-0.5">
            Strict one-pouch-one-order mapping, duplicate tag lock safeguard, and automatic cycle lifecycle increment.
          </div>
        </div>
      </div>

      {/* Result Alert Box */}
      {result && (
        <div 
          className={`p-3 rounded-sm border text-xs font-mono flex items-center gap-2 ${
            result.success 
              ? 'bg-[#22262C] border-[#3FA37A] text-[#3FA37A]' 
              : 'bg-[#22262C] border-[#D9473F] text-[#D9473F]'
          }`}
        >
          {result.success ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{result.message || (result.success ? 'Action executed successfully.' : result.error)}</span>
        </div>
      )}

      {/* 2. Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mapping Form */}
        <div className="scada-panel flex flex-col">
          <div className="section-header">
            <span>Map New Pouch Cycle</span>
            <span className="font-mono text-xs text-[#F2A900]">START CYCLE</span>
          </div>

          <form onSubmit={handleMap} className="p-4 flex flex-col gap-3 text-xs">
            <div>
              <label className="text-[#9AA0A8] block mb-1">Pouch Barcode / QR ID:</label>
              <input
                type="text"
                value={pouchCode}
                onChange={e => setPouchCode(e.target.value)}
                className="w-full bg-[#14161A] border border-[#2A2E35] rounded-sm p-2 text-[#E7E9EC] font-mono focus:outline-none focus:border-[#F2A900]"
                required
              />
            </div>

            <div>
              <label className="text-[#9AA0A8] block mb-1">BLE / RFID Tag Code:</label>
              <input
                type="text"
                value={tagCode}
                onChange={e => setTagCode(e.target.value)}
                className="w-full bg-[#14161A] border border-[#2A2E35] rounded-sm p-2 text-[#E7E9EC] font-mono focus:outline-none focus:border-[#F2A900]"
                required
              />
            </div>

            <div>
              <label className="text-[#9AA0A8] block mb-1">ERP Work Order No:</label>
              <input
                type="text"
                value={workOrderNo}
                onChange={e => setWorkOrderNo(e.target.value)}
                className="w-full bg-[#14161A] border border-[#2A2E35] rounded-sm p-2 text-[#E7E9EC] font-mono focus:outline-none focus:border-[#F2A900]"
                required
              />
            </div>

            <div>
              <label className="text-[#9AA0A8] block mb-1">Initial WIP Shelf Slot Code:</label>
              <input
                type="text"
                value={initialSlot}
                onChange={e => setInitialSlot(e.target.value)}
                className="w-full bg-[#14161A] border border-[#2A2E35] rounded-sm p-2 text-[#E7E9EC] font-mono focus:outline-none focus:border-[#F2A900]"
                required
              />
            </div>

            <div>
              <label className="text-[#9AA0A8] block mb-1">Operator User ID:</label>
              <input
                type="text"
                value={operatorId}
                onChange={e => setOperatorId(e.target.value)}
                className="w-full bg-[#14161A] border border-[#2A2E35] rounded-sm p-2 text-[#E7E9EC] font-mono focus:outline-none focus:border-[#F2A900]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-xs py-2 mt-2 w-full"
            >
              {loading ? 'Validating ERP Work Order...' : 'Confirm Association & Open Cycle'}
            </button>
          </form>
        </div>

        {/* Unmap / Return to Pool */}
        <div className="scada-panel flex flex-col justify-between">
          <div>
            <div className="section-header">
              <span>Close Cycle & Return to Pool</span>
              <span className="font-mono text-xs text-[#9AA0A8]">DISPATCH / SCRAP</span>
            </div>

            <div className="p-4 flex flex-col gap-3 text-xs">
              <p className="text-[#9AA0A8] leading-relaxed">
                When finished parts are packaged into the shipping crate or an order is completed, unmap the pouch to release the physical BLE tag back into the reusable bin.
              </p>

              <div className="p-3 bg-[#14161A] border border-[#2A2E35] rounded-sm space-y-1 font-mono text-[11px]">
                <div className="text-[#E7E9EC]">Pouch: <strong>{pouchCode}</strong></div>
                <div className="text-[#9AA0A8]">Assigned Tag: {tagCode}</div>
                <div className="text-[#9AA0A8]">Current Cycle: Active in Shop-5</div>
              </div>

              <button
                type="button"
                onClick={handleUnmap}
                disabled={loading}
                className="btn-secondary text-xs py-2 w-full border-[#D9473F]/40 text-[#D9473F] hover:bg-[#D9473F]/10"
              >
                {loading ? 'Closing Cycle...' : 'Unmap Pouch & Increment Cycle Number'}
              </button>
            </div>
          </div>

          <div className="p-3 border-t border-[#2A2E35] bg-[#14161A] text-[11px] text-[#9AA0A8] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#3FA37A] flex-shrink-0" />
            <span>Anti-Duplicate Lock: System blocks mapping if tag is currently active on another order.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
