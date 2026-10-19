import { db, initDatabase } from '../src/db/database.js';
import { LocationResolver } from '../src/core/locationResolver.js';
import { MappingEngine } from '../src/core/mappingEngine.js';
import { AlertEngine } from '../src/core/alertEngine.js';
import { SmartDispatchEngine } from '../src/core/smartDispatch.js';
import { WhatIfSimulator } from '../src/core/whatIfSimulator.js';
import { seedDatabase } from '../src/db/seed.js';

describe('INDO-MIM Shop-5 Core Traceability & Dispatch Logic Tests', () => {
  beforeAll(() => {
    initDatabase();
    seedDatabase(false);
  });

  describe('1. Location Resolver & Multi-Tier Sensor Fusion', () => {
    test('Resolves QR slot scan with 99% confidence to RACK_SLOT', () => {
      const res = LocationResolver.resolveEvent({
        sourceType: 'MOBILE_QR',
        readerId: 'SCANNER-OPERATOR',
        pouchCode: 'PCH-24-000458',
        locationId: 'C-3-2',
        operatorId: 'USR-EMP-0234',
        hardwareTimestamp: Date.now(),
      });

      expect(res).not.toBeNull();
      expect(res?.newLocationType).toBe('RACK_SLOT');
      expect(res?.newLocationId).toBe('C-3-2');
      expect(res?.confidencePct).toBe(99.0);
    });

    test('Resolves CNC machine telemetry with 92% confidence', () => {
      const res = LocationResolver.resolveEvent({
        sourceType: 'MACHINE_TELEMETRY',
        readerId: 'CNC-VMC-42',
        pouchCode: 'PCH-24-000458',
        machineId: 'VMC-42',
        hardwareTimestamp: Date.now(),
      });

      expect(res).not.toBeNull();
      expect(res?.newLocationType).toBe('MACHINE');
      expect(res?.newLocationId).toBe('VMC-42');
      expect(res?.confidencePct).toBe(92.0);
    });
  });

  describe('2. Mapping Engine & Pouch Cycle Reuse', () => {
    test('Blocks duplicate mapping if previous cycle is still active', () => {
      const dup = MappingEngine.mapPouch({
        pouchCode: 'PCH-24-000458',
        workOrderNo: 'WO-100465',
        operatorId: 'USR-STORE-01',
      });

      expect(dup.success).toBe(false);
      expect(dup.message).toContain('Duplicate mapping blocked');
    });

    test('Allows unmapping and cycle reuse flow', () => {
      const unmapRes = MappingEngine.unmapPouch('PCH-24-000458', 'USR-STORE-01', 'Test Return');
      expect(unmapRes.success).toBe(true);

      // Now map to new cycle
      const reMapRes = MappingEngine.mapPouch({
        pouchCode: 'PCH-24-000458',
        workOrderNo: 'WO-100458',
        operatorId: 'USR-STORE-01',
        initialSlotCode: 'C-3-2',
      });
      expect(reMapRes.success).toBe(true);
      expect(reMapRes.cycleNumber).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Industrial Alert Engine & Movement Violations', () => {
    test('Triggers Wrong-Route alert when cutting jumps directly to VMC without inspection', () => {
      const cycleRow = db.prepare('SELECT cycle_id FROM pouch_cycles WHERE work_order_id = "WO-100458" LIMIT 1').get() as any;
      expect(cycleRow).toBeDefined();

      AlertEngine.evaluateMovement(cycleRow.cycle_id, 'ZN-CUT', 'ZN-VMC-B');

      const alert = db.prepare('SELECT * FROM alerts WHERE rule_code = "RLE-WRONG-ROUTE" AND cycle_id = ?').get(cycleRow.cycle_id) as any;
      expect(alert).toBeDefined();
      expect(alert.severity).toBe('CRITICAL');
    });

    test('Acknowledge and Resolve workflow', () => {
      const alert = db.prepare('SELECT alert_id FROM alerts WHERE status = "OPEN" LIMIT 1').get() as any;
      expect(alert).toBeDefined();

      const ackOk = AlertEngine.acknowledgeAlert(alert.alert_id, 'USR-SUP-01');
      expect(ackOk).toBe(true);

      const resOk = AlertEngine.resolveAlert(alert.alert_id, 'USR-SUP-01', 'Handled');
      expect(resOk).toBe(true);
    });
  });

  describe('4. Smart Dispatch Next-Job Scoring', () => {
    test('Calculates ranked candidate jobs with explainable reasons for VMC-42', () => {
      const jobs = SmartDispatchEngine.getNextJobsForMachine('VMC-42', 3);
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs[0].rank).toBe(1);
      expect(jobs[0].totalScore).toBeGreaterThan(0);
      expect(jobs[0].reasonCodes.length).toBeGreaterThan(0);
    });
  });

  describe('5. What-If Discrete-Event Sandbox', () => {
    test('Simulates taking machine offline and projects queue delta', () => {
      const proj = WhatIfSimulator.runScenario({
        scenarioName: 'VMC-42 Emergency Maintenance',
        offlineMachines: ['VMC-42'],
        movedJobs: [
          { cycleId: 'CYC-115-01', fromMachineId: 'VMC-42', toMachineId: 'VMC-38' },
        ],
      });

      expect(proj.isSimulationProjection).toBe(true);
      expect(proj.projectedMetrics.onTimeDeliveryProjectedPct).toBeLessThan(proj.projectedMetrics.baselineOnTimePct);
      expect(proj.impactedMachines.length).toBeGreaterThan(0);
    });
  });
});
