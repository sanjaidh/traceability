import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Check, 
  Clock, 
  Filter,
  Volume2
} from 'lucide-react';
import { useSocket } from '../context/SocketContext.js';

export const AlertsPage: React.FC = () => {
  const { triggerBuzzer } = useSocket();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchAlerts = () => {
    fetch(`/api/alerts?status=${filterStatus}`)
      .then(res => res.json())
      .then(data => {
        setAlerts(data.alerts || []);
        setRules(data.rules || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchAlerts();
  }, [filterStatus]);

  const handleAcknowledge = async (alertId: string) => {
    await fetch(`/api/alerts/${alertId}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'USR-SUP-01' }),
    });
    setActionNotice(`Alert ${alertId} acknowledged by Supervisor.`);
    setTimeout(() => setActionNotice(null), 3000);
    fetchAlerts();
  };

  const handleResolve = async (alertId: string) => {
    await fetch(`/api/alerts/${alertId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'USR-SUP-01', rootCause: 'Operator verified workpiece route' }),
    });
    setActionNotice(`Alert ${alertId} marked RESOLVED with root cause audit.`);
    setTimeout(() => setActionNotice(null), 3000);
    fetchAlerts();
  };

  const filteredAlerts = alerts.filter(a => {
    if (selectedSeverity !== 'ALL' && a.severity !== selectedSeverity) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 gap-4 bg-[#14161A]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Header Toolbar */}
      <div className="scada-panel p-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#E7E9EC] uppercase tracking-wider">
              Industrial Alerts Engine & Escalation Workflow
            </span>
            <span className="font-mono text-xs text-[#9AA0A8]">
              ({filteredAlerts.length} Active Incidents)
            </span>
          </div>
          <div className="text-xs text-[#9AA0A8] mt-0.5">
            Real-time shop floor rule evaluation: Wrong Route, Missing Pulse, Battery Low, Dwell Timeout, Machine Alarm.
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 text-xs">
          <div className="inline-flex rounded-sm border border-[#2A2E35] bg-[#14161A] p-0.5">
            {['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-0.5 rounded-xs font-mono text-xs transition-colors ${
                  filterStatus === st 
                    ? 'bg-[#22262C] text-[#E7E9EC] border-b border-[#F2A900] font-bold' 
                    : 'text-[#9AA0A8] hover:text-[#E7E9EC]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <select
            value={selectedSeverity}
            onChange={e => setSelectedSeverity(e.target.value)}
            className="bg-[#14161A] border border-[#2A2E35] rounded-sm px-2 py-1 text-xs text-[#E7E9EC] font-sans focus:outline-none focus:border-[#F2A900]"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="WARNING">Warning Only</option>
          </select>
        </div>
      </div>

      {actionNotice && (
        <div className="p-2.5 bg-[#22262C] border border-[#F2A900] text-xs font-mono text-[#F2A900] flex items-center gap-2">
          <Check className="w-4 h-4 text-[#3FA37A]" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 2. Alerts Matrix Table */}
      <div className="scada-panel flex flex-col flex-1 overflow-hidden">
        <div className="section-header">
          <span>Active Incident Register</span>
          <span className="font-mono text-xs text-[#9AA0A8]">
            Colorblind-Safe: ▲ Triangle = Critical, ■ Square = Warning
          </span>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="scada-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Alert Code</th>
                <th>Rule Name</th>
                <th>Work Order / Pouch</th>
                <th>Zone / Location</th>
                <th>Incident Details</th>
                <th>Triggered At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length > 0 ? (
                filteredAlerts.map(a => (
                  <tr key={a.alert_id}>
                    <td>
                      <span className={`inline-flex items-center gap-1 font-mono font-bold text-xs ${
                        a.severity === 'CRITICAL' ? 'text-[#D9473F] alarm-pulsing' : 'text-[#E08A2E]'
                      }`}>
                        <span>{a.severity === 'CRITICAL' ? '▲' : '■'}</span>
                        <span>{a.severity}</span>
                      </span>
                    </td>
                    <td className="font-mono font-bold text-[#E7E9EC]">{a.rule_code}</td>
                    <td className="text-xs">{a.rule_name}</td>
                    <td className="font-mono text-xs text-[#F2A900]">
                      {a.work_order_no || a.pouch_code || 'N/A'}
                    </td>
                    <td className="font-sans text-xs">{a.zone_name || 'Floor Area'}</td>
                    <td className="text-xs max-w-xs truncate" title={a.message}>
                      {a.message}
                    </td>
                    <td className="font-mono text-xs text-[#9AA0A8]">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className="px-1.5 py-0.5 rounded-sm font-mono text-[10px] bg-[#14161A] border border-[#2A2E35] text-[#9AA0A8]">
                        {a.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {a.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(a.alert_id)}
                            className="btn-primary text-xs py-1 px-2"
                          >
                            Acknowledge
                          </button>
                        )}
                        {a.status !== 'RESOLVED' && (
                          <button
                            type="button"
                            onClick={() => handleResolve(a.alert_id)}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            Resolve
                          </button>
                        )}
                        {a.pouch_code && (
                          <button
                            type="button"
                            onClick={() => triggerBuzzer(a.pouch_code)}
                            className="btn-icon w-6 h-6"
                            title="Buzz Pouch Tag"
                          >
                            <Volume2 className="w-3 h-3 text-[#9AA0A8]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-[#9AA0A8] italic">
                    No active alerts matching selected criteria. Shop floor running within nominal limits.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Configured Rule Catalog */}
      <div className="scada-panel">
        <div className="section-header">
          <span>Configured Industrial Rules Engine (10 Categories)</span>
          <span className="font-mono text-xs text-[#9AA0A8]">{rules.length} Rules Active</span>
        </div>

        <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          {rules.map(r => (
            <div key={r.rule_code} className="p-2 bg-[#14161A] border border-[#2A2E35] rounded-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-[#E7E9EC]">{r.rule_code}</span>
                  <span className={r.default_severity === 'CRITICAL' ? 'text-[#D9473F]' : 'text-[#E08A2E]'}>
                    {r.default_severity}
                  </span>
                </div>
                <div className="font-medium text-[#E7E9EC] mt-1">{r.rule_name}</div>
                <div className="text-[11px] text-[#9AA0A8] mt-0.5">{r.description}</div>
              </div>
              <div className="mt-2 pt-1 border-t border-[#2A2E35] flex items-center justify-between text-[10px] text-[#9AA0A8] font-mono">
                <span>Threshold: {r.threshold_seconds ? `${r.threshold_seconds}s` : 'Rule Event'}</span>
                <span>Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
