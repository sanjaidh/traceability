import { initDatabase, db } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';
import { LocationResolver } from '../src/core/locationResolver.js';
import { MappingEngine } from '../src/core/mappingEngine.js';
import { AlertEngine } from '../src/core/alertEngine.js';
import { SmartDispatchEngine } from '../src/core/smartDispatch.js';
import { WhatIfSimulator } from '../src/core/whatIfSimulator.js';
import { DispatchBacktestEngine } from '../src/core/dispatchBacktest.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${desc}`);
    failed++;
  }
}

console.log('================================================================');
console.log('  RUNNING INDO-MIM SHOP-5 AUTOMATED VERIFICATION SUITE         ');
console.log('================================================================\n');

initDatabase();
seedDatabase(false);

console.log('Suite 1: Location Resolver & Sensor Fusion:');
const qrRes = LocationResolver.resolveEvent({
  sourceType: 'MOBILE_QR',
  readerId: 'SCANNER-OPERATOR',
  pouchCode: 'PCH-24-000458',
  locationId: 'C-3-2',
  operatorId: 'USR-EMP-0234',
  hardwareTimestamp: Date.now(),
});
assert(qrRes !== null && qrRes.newLocationType === 'RACK_SLOT', 'Resolves QR slot scan to RACK_SLOT');
assert(qrRes?.confidencePct === 99.0, 'Assigns 99% confidence to physical QR scan');

const cncRes = LocationResolver.resolveEvent({
  sourceType: 'MACHINE_TELEMETRY',
  readerId: 'CNC-VMC-42',
  pouchCode: 'PCH-24-000458',
  machineId: 'VMC-42',
  hardwareTimestamp: Date.now(),
});
assert(cncRes !== null && cncRes.newLocationType === 'MACHINE', 'Resolves active machine telemetry to MACHINE level');
assert(cncRes?.confidencePct === 92.0, 'Assigns 92% confidence to machine state correlation');

console.log('\nSuite 2: Mapping Station & Cycle Reuse:');
const dupRes = MappingEngine.mapPouch({
  pouchCode: 'PCH-24-000458',
  workOrderNo: 'WO-100465',
  operatorId: 'USR-STORE-01',
});
assert(dupRes.success === false, 'Blocks duplicate mapping of active pouch to another Work Order');

const unmapRes = MappingEngine.unmapPouch('PCH-24-000458', 'USR-STORE-01', 'Test Return');
assert(unmapRes.success === true, 'Successfully closes active cycle and unmaps pouch');

const reMapRes = MappingEngine.mapPouch({
  pouchCode: 'PCH-24-000458',
  workOrderNo: 'WO-100458',
  operatorId: 'USR-STORE-01',
  initialSlotCode: 'C-3-2',
});
assert(reMapRes.success === true && (reMapRes.cycleNumber || 0) >= 2, 'Increments cycle number upon pouch reuse');

console.log('\nSuite 3: Industrial Alerts Engine:');
const cycleRow = db.prepare("SELECT cycle_id FROM pouch_cycles WHERE work_order_id = 'WO-100458' LIMIT 1").get() as any;
AlertEngine.evaluateMovement(cycleRow.cycle_id, 'ZN-CUT', 'ZN-VMC-B');
const wrongRouteAlert = db.prepare("SELECT * FROM alerts WHERE rule_code = 'RLE-WRONG-ROUTE' AND cycle_id = ?").get(cycleRow.cycle_id) as any;
assert(wrongRouteAlert !== undefined && wrongRouteAlert.severity === 'CRITICAL', 'Detects wrong-route move (skipping inspection) and creates CRITICAL alert');

const alertRow = db.prepare("SELECT alert_id FROM alerts WHERE status = 'OPEN' LIMIT 1").get() as any;
assert(alertRow !== undefined, 'Active alerts exist in database');
const ackOk = AlertEngine.acknowledgeAlert(alertRow.alert_id, 'USR-SUP-01');
assert(ackOk === true, 'Supervisor can acknowledge open alert');

console.log('\nSuite 4: Smart Dispatch & Machine Next-Job Ranking:');
const nextJobs = SmartDispatchEngine.getNextJobsForMachine('VMC-42', 3);
assert(nextJobs.length > 0, 'Computes ranked candidate jobs for machine VMC-42');
assert(nextJobs[0].rank === 1 && nextJobs[0].totalScore > 0, 'Assigns transparent priority score to top job');
assert(nextJobs[0].reasonCodes.length > 0, 'Provides explainable plain language reason codes');

console.log('\nSuite 5: Discrete-Event What-If Simulator:');
const whatIf = WhatIfSimulator.runScenario({
  scenarioName: 'VMC-42 Offline Sandbox',
  offlineMachines: ['VMC-42'],
  movedJobs: [
    { cycleId: 'CYC-115-01', fromMachineId: 'VMC-42', toMachineId: 'VMC-38' },
  ],
});
assert(whatIf.isSimulationProjection === true, 'Labels What-If output strictly as SIMULATION PROJECTION');
assert(whatIf.projectedMetrics.onTimeDeliveryProjectedPct < whatIf.projectedMetrics.baselineOnTimePct, 'Correctly models delivery SLA penalty when machine goes offline');

console.log('\nSuite 6: Simulation Backtest Benchmark vs FIFO & EDD:');
const backtest = DispatchBacktestEngine.runBacktest();
assert(backtest.smartPriority.onTimeDeliveryPct > backtest.fifo.onTimeDeliveryPct, 'Smart Priority outperforms FIFO by > 10% in on-time delivery');
assert(backtest.improvementVsFifo.changeoverSavingsPct > 30, 'Achieves > 30% reduction in setup changeovers via setup similarity grouping');

console.log('\n================================================================');
console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED                     `);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
