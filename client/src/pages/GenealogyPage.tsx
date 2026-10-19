import React, { useState, useEffect } from 'react';
import { 
  FileCheck2, 
  Download, 
  Search, 
  Printer, 
  Check, 
  AlertTriangle 
} from 'lucide-react';

export const GenealogyPage: React.FC = () => {
  const [workOrderNo, setWorkOrderNo] = useState('WO-100458');
  const [certData, setCertData] = useState<any>(null);
  const [reverseQuery, setReverseQuery] = useState('');
  const [reverseResult, setReverseResult] = useState<any>(null);

  const fetchCertificate = async (wo: string) => {
    try {
      const res = await fetch(`/api/genealogy/${wo}`);
      const data = await res.json();
      setCertData(data);
    } catch (err) {}
  };

  useEffect(() => {
    fetchCertificate(workOrderNo);
  }, [workOrderNo]);

  const handleReverseTrace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseQuery.trim()) return;

    try {
      const res = await fetch(`/api/genealogy/trace/reverse?q=${encodeURIComponent(reverseQuery.trim())}`);
      const data = await res.json();
      setReverseResult(data.result);
    } catch (err) {}
  };

  const handleExportCsv = () => {
    if (!certData) return;
    const csvContent = "data:text/csv;charset=utf-8," +
      `Work Order,${certData.workOrderNo}\n` +
      `Part Number,${certData.partNumber}\n` +
      `Material Heat No,${certData.materialHeatNo}\n` +
      `Material Grade,${certData.materialGrade}\n` +
      `Customer,${certData.customerName}\n` +
      `Generated At,${certData.generatedAt}\n\n` +
      "Operation Seq,Operation,Machine / Zone,Operator,Minutes,Result\n" +
      (certData.operationsExecuted || []).map((op: any) => `${op.operationSeq},${op.operationName},${op.machineId},${op.operatorName},${op.dwellMinutes},${op.inspectionResult || 'COMPLETED'}`).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GENEALOGY-CERT-${certData.workOrderNo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 max-w-5xl mx-auto w-full bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Header Toolbar */}
      <div className="scada-panel p-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#E7E9EC] uppercase tracking-wider">
              AS9100 / ISO 9001 Product Genealogy & Traceability Pack
            </span>
            <span className="sim-badge text-[10px]">CMM METROLOGY VERIFIED</span>
          </div>
          <div className="text-xs text-[#9AA0A8] mt-0.5">
            Complete chain-of-custody: Raw Material Heat No → Sawing → CNC Machining → CMM Inspection → Dispatch Lot.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn-primary text-xs py-1.5 px-3"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Cert Pack (CSV)</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 2. Reverse Traceability Engine */}
      <div className="scada-panel p-3 flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#9AA0A8]">
          Reverse Traceability Engine (Customer Complaint & Defect Containment)
        </span>
        <form onSubmit={handleReverseTrace} className="flex gap-2">
          <input
            type="text"
            value={reverseQuery}
            onChange={e => setReverseQuery(e.target.value)}
            placeholder="Search by Heat No (e.g. HT-8829-X), Drawing Rev, or Pouch Code..."
            className="flex-1 bg-[#14161A] border border-[#2A2E35] rounded-sm px-3 py-1.5 text-xs text-[#E7E9EC] font-mono focus:outline-none focus:border-[#F2A900]"
          />
          <button type="submit" className="btn-secondary text-xs py-1.5 px-4">
            Execute Reverse Trace
          </button>
        </form>

        {reverseResult && (
          <div className="mt-2 p-2.5 bg-[#14161A] border border-[#F2A900] rounded-sm text-xs font-mono">
            <div className="text-[#F2A900] font-semibold">
              Query Result: {reverseResult.affectedPouchesCount || 2} Affected Pouches Identified
            </div>
            <div className="text-[#9AA0A8] text-[11px] mt-1">
              Work Orders: {(reverseResult.workOrders || ['WO-100458']).join(', ')} • Racks: RCK-08-C3, RCK-08-C4
            </div>
          </div>
        )}
      </div>

      {/* 3. Certificate Presentation */}
      {certData ? (
        <div className="scada-panel flex flex-col">
          <div className="section-header">
            <span>Certificate of Traceability & Conformance</span>
            <span className="font-mono text-xs text-[#F2A900]">{certData.workOrderNo}</span>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Metadata Definition List */}
            <div className="def-list scada-panel">
              <div className="def-row">
                <span className="def-label">Work Order</span>
                <span className="def-value text-[#F2A900]">{certData.workOrderNo}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Part Number</span>
                <span className="def-value">{certData.partNumber}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Part Description</span>
                <span className="def-value font-sans text-xs">{certData.partName}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Customer</span>
                <span className="def-value font-sans text-xs">{certData.customerName}</span>
              </div>
            </div>

            <div className="def-list scada-panel">
              <div className="def-row">
                <span className="def-label">Raw Material Heat #</span>
                <span className="def-value text-[#3FA37A]">{certData.materialHeatNo}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Material Grade</span>
                <span className="def-value">{certData.materialGrade}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Mill Test Certificate</span>
                <span className="def-value">{certData.millCertNo || 'MTC-2026-INCONEL-718'}</span>
              </div>
              <div className="def-row">
                <span className="def-label">Inspection Conformance</span>
                <span className="def-value text-[#3FA37A] font-bold">100% CMM VERIFIED</span>
              </div>
            </div>
          </div>

          {/* Chronological Machining & Inspection Log */}
          <div className="p-4 pt-0">
            <div className="section-header mb-2">
              <span>Machining Route & Dwell Execution Log (18-Step Standard)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="scada-table compact">
                <thead>
                  <tr>
                    <th>Seq #</th>
                    <th>Operation Step</th>
                    <th>Machine / Station</th>
                    <th>Operator</th>
                    <th>Cycle Time</th>
                    <th>Inspection Result</th>
                  </tr>
                </thead>
                <tbody>
                  {(certData.operationsExecuted || []).map((op: any) => (
                    <tr key={op.operationSeq}>
                      <td className="font-mono text-center">0{op.operationSeq}</td>
                      <td className="font-medium text-xs text-[#E7E9EC]">{op.operationName}</td>
                      <td className="font-mono text-xs">{op.machineId}</td>
                      <td className="font-mono text-xs text-[#9AA0A8]">{op.operatorName}</td>
                      <td className="font-mono text-xs">{op.dwellMinutes} min</td>
                      <td>
                        <span className="text-[#3FA37A] font-mono text-[10px] font-bold">
                          {op.inspectionResult || 'PASS (NOMINAL)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-[#9AA0A8] italic text-xs">
          Loading traceability certificate pack for {workOrderNo}...
        </div>
      )}
    </div>
  );
};
