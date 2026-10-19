import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { LocationResolver } from '../core/locationResolver.js';
import { MappingEngine } from '../core/mappingEngine.js';
import { AlertEngine } from '../core/alertEngine.js';
import { SmartDispatchEngine } from '../core/smartDispatch.js';
import { DispatchBacktestEngine } from '../core/dispatchBacktest.js';
import { DigitalTwinEngine } from '../core/digitalTwin.js';
import { WhatIfSimulator } from '../core/whatIfSimulator.js';
import { GenealogyService } from '../core/genealogyService.js';
import { AnomalyDetector } from '../core/anomalyDetector.js';
import { NaturalLanguageAssistant } from '../core/nlAssistant.js';
import { FaultInjector } from '../simulator/faultInjector.js';
import { simulator } from '../simulator/shopFloorSimulator.js';
import { signalProcessor } from '../hal/kalmanFilter.js';

export const apiRouter = Router();

// ==========================================
// 1. POUCH SEARCH & DETAIL
// ==========================================
apiRouter.get('/pouches', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  const zone = req.query.zone as string;
  const status = req.query.status as string;
  const limit = parseInt(req.query.limit as string) || 50;

  let sql = `
    SELECT 
      p.pouch_id, p.pouch_code, t.tag_code, t.battery_pct, t.status as tag_status, t.last_seen_at,
      wo.work_order_no, prd.part_number, prd.part_name, prd.material_grade,
      c.customer_name, c.tier as customer_tier, drg.drawing_no,
      pc.cycle_id, pc.current_location_type, pc.current_location_id, pc.current_zone_id,
      z.zone_name, pc.confidence_pct, pc.mapped_at, wo.expedite_flag, wo.due_date
    FROM pouches p
    LEFT JOIN tags t ON p.tag_id = t.tag_id
    LEFT JOIN pouch_cycles pc ON p.current_cycle_id = pc.cycle_id
    LEFT JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
    LEFT JOIN products prd ON wo.product_id = prd.product_id
    LEFT JOIN drawings drg ON prd.product_id = drg.product_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    LEFT JOIN zones z ON pc.current_zone_id = z.zone_id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (query) {
    sql += ` AND (
      p.pouch_code LIKE ? OR 
      t.tag_code LIKE ? OR 
      wo.work_order_no LIKE ? OR 
      prd.part_number LIKE ? OR 
      prd.part_name LIKE ? OR 
      c.customer_name LIKE ? OR 
      drg.drawing_no LIKE ?
    )`;
    const wildcard = `%${query}%`;
    params.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
  }

  if (zone) {
    sql += ' AND pc.current_zone_id = ?';
    params.push(zone);
  }

  if (status) {
    sql += ' AND pc.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY pc.mapped_at DESC LIMIT ?';
  params.push(limit);

  const results = db.prepare(sql).all(...params);
  res.json({ total: results.length, data: results });
});

apiRouter.get('/pouches/:pouchCode', (req: Request, res: Response) => {
  const { pouchCode } = req.params;

  const pouch = db.prepare(`
    SELECT 
      p.*, t.tag_code, t.battery_pct, t.battery_mv, t.status as tag_status, t.last_seen_at,
      wo.work_order_no, wo.due_date, wo.expedite_flag, wo.order_quantity, wo.completed_quantity,
      prd.part_number, prd.part_name, prd.material_grade, prd.material_family,
      c.customer_name, c.tier as customer_tier, drg.drawing_no, drg.revision as drawing_rev,
      pc.cycle_id, pc.cycle_number, pc.current_location_type, pc.current_location_id, pc.current_zone_id,
      z.zone_name, pc.confidence_pct, pc.mapped_at, pc.delivery_risk_score
    FROM pouches p
    LEFT JOIN tags t ON p.tag_id = t.tag_id
    LEFT JOIN pouch_cycles pc ON p.current_cycle_id = pc.cycle_id
    LEFT JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
    LEFT JOIN products prd ON wo.product_id = prd.product_id
    LEFT JOIN drawings drg ON prd.product_id = drg.product_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    LEFT JOIN zones z ON pc.current_zone_id = z.zone_id
    WHERE p.pouch_code = ?
  `).get(pouchCode) as any;

  if (!pouch) {
    return res.status(404).json({ error: 'Pouch not found' });
  }

  // Get movement timeline
  const timeline = db.prepare(`
    SELECT rm.*, r.reader_name, z.zone_name, u.full_name as operator_name
    FROM resolved_movements rm
    LEFT JOIN readers r ON rm.reader_id = r.reader_id
    LEFT JOIN zones z ON rm.zone_id = z.zone_id
    LEFT JOIN users u ON rm.operator_id = u.user_id
    WHERE rm.pouch_id = ?
    ORDER BY rm.timestamp DESC
    LIMIT 25
  `).all(pouch.pouch_id);

  res.json({ pouch, timeline });
});

// ==========================================
// 2. MAPPING STATION
// ==========================================
apiRouter.post('/mapping/map', (req: Request, res: Response) => {
  const { pouchCode, tagCode, workOrderNo, operatorId, initialSlotCode, notes } = req.body;
  if (!pouchCode || !workOrderNo) {
    return res.status(400).json({ error: 'pouchCode and workOrderNo are required' });
  }

  const result = MappingEngine.mapPouch({
    pouchCode,
    tagCode,
    workOrderNo,
    operatorId: operatorId || 'USR-STORE-01',
    initialSlotCode,
    notes,
  });

  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

apiRouter.post('/mapping/unmap', (req: Request, res: Response) => {
  const { pouchCode, operatorId, reason } = req.body;
  if (!pouchCode) {
    return res.status(400).json({ error: 'pouchCode is required' });
  }

  const result = MappingEngine.unmapPouch(pouchCode, operatorId || 'USR-STORE-01', reason);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// ==========================================
// 3. TRACKING, ZONES & READERS
// ==========================================
apiRouter.get('/tracking/summary', (_req: Request, res: Response) => {
  const twin = DigitalTwinEngine.getLiveTwinState();

  const zones = db.prepare(`
    SELECT z.*, 
      (SELECT COUNT(*) FROM pouch_cycles pc WHERE pc.current_zone_id = z.zone_id AND pc.status = 'ACTIVE') as pouch_count
    FROM zones z
    ORDER BY z.category
  `).all();

  const readers = db.prepare(`
    SELECT r.*, z.zone_name 
    FROM readers r
    JOIN zones z ON r.zone_id = z.zone_id
  `).all();

  res.json({
    kpis: twin.kpis,
    zones,
    readers,
    calibration: signalProcessor.getAllReaderCalibrations(),
  });
});

apiRouter.post('/tracking/calibrate', (req: Request, res: Response) => {
  const { readerId, offsetDb } = req.body;
  if (!readerId || offsetDb === undefined) {
    return res.status(400).json({ error: 'readerId and offsetDb required' });
  }

  signalProcessor.setReaderCalibration(readerId, parseFloat(offsetDb));
  res.json({ success: true, readerId, offsetDb });
});

// ==========================================
// 4. MACHINES (~111 Machines)
// ==========================================
apiRouter.get('/machines', (_req: Request, res: Response) => {
  const twin = DigitalTwinEngine.getLiveTwinState();
  res.json({ total: twin.machines.length, machines: twin.machines });
});

apiRouter.get('/machines/:machineId', (req: Request, res: Response) => {
  const { machineId } = req.params;
  const machine = db.prepare('SELECT * FROM machines WHERE machine_id = ?').get(machineId) as any;
  if (!machine) return res.status(404).json({ error: 'Machine not found' });

  const nextJobs = SmartDispatchEngine.getNextJobsForMachine(machineId as string, 5);
  const queue = db.prepare(`
    SELECT p.pouch_code, t.tag_code, wo.work_order_no, prd.part_name, pc.confidence_pct
    FROM pouch_cycles pc
    JOIN pouches p ON pc.pouch_id = p.pouch_id
    JOIN tags t ON p.tag_id = t.tag_id
    JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
    JOIN products prd ON wo.product_id = prd.product_id
    WHERE pc.current_location_id = ? AND pc.status = 'ACTIVE'
  `).all(machineId);

  res.json({ machine, nextJobs, queue });
});

// ==========================================
// 5. RACKS & SLOTS (WIP Storage)
// ==========================================
apiRouter.get('/racks', (_req: Request, res: Response) => {
  const racks = db.prepare('SELECT * FROM racks ORDER BY rack_code').all();
  const slots = db.prepare(`
    SELECT s.*, r.rack_code, p.pouch_code, wo.work_order_no, prd.part_name, c.customer_name
    FROM shelf_slots s
    JOIN racks r ON s.rack_id = r.rack_id
    LEFT JOIN pouch_cycles pc ON s.occupied_by_cycle_id = pc.cycle_id
    LEFT JOIN pouches p ON pc.pouch_id = p.pouch_id
    LEFT JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
    LEFT JOIN products prd ON wo.product_id = prd.product_id
    LEFT JOIN customers c ON wo.customer_id = c.customer_id
    ORDER BY s.slot_code
  `).all();

  const totalSlots = slots.length;
  const occupiedSlots = slots.filter((s: any) => s.occupied_by_cycle_id !== null).length;

  res.json({
    totalSlots,
    occupiedSlots,
    utilizationPct: Math.round((occupiedSlots / totalSlots) * 100),
    racks,
    slots,
  });
});

apiRouter.get('/racks/suggest-slot', (req: Request, res: Response) => {
  const { materialGroup, targetMachineZone } = req.query;

  // Find nearest empty slot matching material group
  const emptySlot = db.prepare(`
    SELECT s.slot_code, r.rack_code, s.shelf_level, s.slot_number, r.coord_x, r.coord_y
    FROM shelf_slots s
    JOIN racks r ON s.rack_id = r.rack_id
    WHERE s.occupied_by_cycle_id IS NULL
    ORDER BY 
      CASE WHEN s.assigned_material_group = ? THEN 0 ELSE 1 END,
      r.coord_x ASC
    LIMIT 1
  `).get(materialGroup || 'STAINLESS_STEEL') as any;

  res.json({ suggestedSlot: emptySlot });
});

// ==========================================
// 6. SMART DISPATCH & PRIORITY
// ==========================================
apiRouter.get('/dispatch/next-jobs/:machineId', (req: Request, res: Response) => {
  const { machineId } = req.params;
  const rawJobs = SmartDispatchEngine.getNextJobsForMachine(machineId as string, 5);
  const jobs = rawJobs.map(j => ({
    ...j,
    priorityScore: j.totalScore,
    location: j.currentLocationId,
    reasons: j.reasonCodes,
  }));
  res.json({ machineId, jobs });
});

apiRouter.post('/dispatch/decide', (req: Request, res: Response) => {
  const { machineId, cycleId, action, skipReason, userId } = req.body;
  if (!machineId || !cycleId || !action) {
    return res.status(400).json({ error: 'machineId, cycleId, and action required' });
  }

  const ok = SmartDispatchEngine.recordDecision({
    machineId,
    cycleId,
    action,
    skipReason,
    userId: userId || 'USR-EMP-0234',
  });

  res.json({ success: ok, machineId, cycleId, action });
});

apiRouter.get('/dispatch/rebalance', (_req: Request, res: Response) => {
  const suggestions = SmartDispatchEngine.getRebalanceSuggestions();
  res.json({ suggestions });
});

apiRouter.get('/dispatch/shipping', (_req: Request, res: Response) => {
  const shipping = SmartDispatchEngine.getShippingPriority();
  res.json({ lots: shipping });
});

apiRouter.get('/dispatch/backtest', (_req: Request, res: Response) => {
  const backtest = DispatchBacktestEngine.runBacktest();
  res.json(backtest);
});

// ==========================================
// 7. ALERTS & RULES
// ==========================================
apiRouter.get('/alerts', (req: Request, res: Response) => {
  const status = req.query.status as string || 'OPEN';

  const alerts = db.prepare(`
    SELECT a.*, r.rule_name, r.rule_category, z.zone_name, p.pouch_code, wo.work_order_no
    FROM alerts a
    JOIN alert_rules r ON a.rule_code = r.rule_code
    LEFT JOIN zones z ON a.zone_id = z.zone_id
    LEFT JOIN pouch_cycles pc ON a.cycle_id = pc.cycle_id
    LEFT JOIN pouches p ON pc.pouch_id = p.pouch_id
    LEFT JOIN work_orders wo ON a.work_order_id = wo.work_order_id
    WHERE a.status = ? OR ? = 'ALL'
    ORDER BY a.created_at DESC
  `).all(status, status);

  const rules = db.prepare('SELECT * FROM alert_rules').all();
  res.json({ alerts, rules });
});

apiRouter.post('/alerts/:alertId/ack', (req: Request, res: Response) => {
  const { alertId } = req.params;
  const { userId } = req.body;
  const ok = AlertEngine.acknowledgeAlert(alertId as string, userId || 'USR-SUP-01');
  res.json({ success: ok });
});

apiRouter.post('/alerts/:alertId/resolve', (req: Request, res: Response) => {
  const { alertId } = req.params;
  const { userId, rootCause } = req.body;
  const ok = AlertEngine.resolveAlert(alertId as string, userId || 'USR-SUP-01', rootCause || 'Action completed on shop floor');
  res.json({ success: ok });
});

// ==========================================
// 8. DIGITAL TWIN & WHAT-IF
// ==========================================
apiRouter.get('/digital-twin/live', (_req: Request, res: Response) => {
  const state = DigitalTwinEngine.getLiveTwinState();
  res.json(state);
});

apiRouter.post('/digital-twin/what-if', (req: Request, res: Response) => {
  const { scenarioName, movedJobs, offlineMachines } = req.body;
  const projection = WhatIfSimulator.runScenario({
    scenarioName: scenarioName || 'Custom Supervisor What-If',
    movedJobs,
    offlineMachines,
  });
  res.json(projection);
});

apiRouter.post('/digital-twin/snapshot', (req: Request, res: Response) => {
  const { shift } = req.body;
  const snapId = DigitalTwinEngine.saveSnapshot(shift || 'A');
  res.json({ success: true, snapshotId: snapId });
});

apiRouter.get('/digital-twin/snapshots', (_req: Request, res: Response) => {
  const snaps = db.prepare('SELECT snapshot_id, timestamp, shift, active_pouches_count, running_machines_count, open_alerts_count FROM digital_twin_snapshots ORDER BY timestamp DESC LIMIT 20').all();
  res.json({ snapshots: snaps });
});

// ==========================================
// 9. GENEALOGY & TRACEABILITY
// ==========================================
apiRouter.get('/genealogy/:workOrderNo', (req: Request, res: Response) => {
  const { workOrderNo } = req.params;
  const pack = GenealogyService.getCertificatePack(workOrderNo as string);
  if (!pack) return res.status(404).json({ error: 'Certificate not found for Work Order' });
  res.json(pack);
});

apiRouter.get('/genealogy/trace/reverse', (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query) return res.status(400).json({ error: 'Query parameter q required' });
  const result = GenealogyService.reverseTrace(query);
  res.json({ result });
});

// ==========================================
// 10. AI ANOMALIES & ASSISTANT
// ==========================================
apiRouter.get('/anomalies', (_req: Request, res: Response) => {
  const anomalies = AnomalyDetector.detectAnomalies();
  res.json({ anomalies });
});

apiRouter.post('/assistant/chat', (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query text required' });
  const answer = NaturalLanguageAssistant.handleQuery(query);
  res.json(answer);
});

// ==========================================
// 11. SIMULATOR & FAULT INJECTION
// ==========================================
apiRouter.get('/simulator/status', (_req: Request, res: Response) => {
  res.json(simulator.getStatus());
});

apiRouter.post('/simulator/speed', (req: Request, res: Response) => {
  const { speed } = req.body;
  simulator.setSpeed(parseInt(speed) || 10);
  res.json(simulator.getStatus());
});

apiRouter.post('/simulator/fault', (req: Request, res: Response) => {
  const { faultType, targetId, alarmCode, alarmMessage } = req.body;

  let result;
  if (faultType === 'READER_OFFLINE') {
    result = FaultInjector.injectReaderOffline(targetId || 'RX-08');
  } else if (faultType === 'READER_RESTORE') {
    result = FaultInjector.restoreReader(targetId || 'RX-08');
  } else if (faultType === 'MACHINE_ALARM') {
    result = FaultInjector.injectMachineAlarm(targetId || 'VMC-42', alarmCode, alarmMessage);
  } else if (faultType === 'MACHINE_CLEAR') {
    result = FaultInjector.clearMachineAlarm(targetId || 'VMC-42');
  } else if (faultType === 'BATTERY_DRAIN') {
    result = FaultInjector.injectBatteryDrain(targetId || 'TAG-000115', 12);
  } else if (faultType === 'RUSH_ORDER') {
    result = FaultInjector.injectRushOrder(75);
  } else if (faultType === 'WRONG_ROUTE') {
    result = FaultInjector.injectWrongRoute(targetId || 'PCH-24-000458');
  } else {
    return res.status(400).json({ error: `Unknown fault type: ${faultType}` });
  }

  res.json(result);
});

// ==========================================
// 12. CUSTOMER PORTAL (External Read-Only)
// ==========================================
apiRouter.get('/customer-portal/:token', (req: Request, res: Response) => {
  const { token } = req.params;
  const customer = db.prepare('SELECT customer_id, customer_name, tier FROM customers WHERE portal_token = ?').get(token) as any;
  if (!customer) return res.status(401).json({ error: 'Invalid customer tracking token' });

  const orders = db.prepare(`
    SELECT wo.work_order_no, prd.part_name, prd.part_number, wo.order_quantity, wo.completed_quantity,
           wo.due_date, wo.status, wo.release_date
    FROM work_orders wo
    JOIN products prd ON wo.product_id = prd.product_id
    WHERE wo.customer_id = ?
    ORDER BY wo.due_date ASC
  `).all(customer.customer_id);

  res.json({ customer, orders });
});
