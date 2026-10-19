import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface TwinMachineState {
  machineId: string;
  machineCode: string;
  machineName: string;
  machineType: string;
  zoneId: string;
  x: number;
  y: number;
  state: 'RUNNING' | 'IDLE' | 'SETUP' | 'ALARM' | 'OFFLINE' | 'WAITING_MATERIAL';
  currentWorkOrder?: string;
  currentProgram?: string;
  operatorId?: string;
  cycleElapsedSec: number;
  spindleLoadPct: number;
  spindleRpm: number;
  alarmCode?: string;
  alarmMessage?: string;
  queuedPouchesCount: number;
}

export interface TwinPouchMarker {
  pouchId: string;
  pouchCode: string;
  tagCode: string;
  workOrderNo: string;
  partName: string;
  customerName: string;
  zoneId: string;
  locationType: string;
  locationId: string;
  x: number;
  y: number;
  confidencePct: number;
  status: string;
  isExpedite: boolean;
  batteryPct: number;
  lastSeenTime: string;
}

export interface TwinBottleneck {
  zoneId: string;
  zoneName: string;
  activeWipCount: number;
  capacity: number;
  utilizationPct: number;
  averageDwellHours: number;
  severity: 'NORMAL' | 'ELEVATED' | 'CRITICAL';
  likelyRootCause: string;
}

export class DigitalTwinEngine {
  /**
   * Retrieves full synchronized live snapshot of Shop-5
   */
  public static getLiveTwinState(): {
    timestamp: string;
    machines: TwinMachineState[];
    pouches: TwinPouchMarker[];
    bottlenecks: TwinBottleneck[];
    kpis: {
      totalActivePouches: number;
      inMachining: number;
      waitingInspection: number;
      inRacks: number;
      inPacking: number;
      inDispatch: number;
      runningMachines: number;
      idleMachines: number;
      alarmMachines: number;
      openAlerts: number;
    };
  } {
    // 1. Machines
    const machineRows = db.prepare(`
      SELECT m.*, u.full_name as operator_name,
        (SELECT COUNT(*) FROM pouch_cycles pc WHERE pc.current_location_id = m.machine_id AND pc.status = 'ACTIVE') as queue_count
      FROM machines m
      LEFT JOIN users u ON m.active_operator_id = u.user_id
    `).all() as any[];

    const machines: TwinMachineState[] = machineRows.map((m) => ({
      machineId: m.machine_id,
      machineCode: m.machine_code,
      machineName: m.machine_name,
      machineType: m.machine_type,
      zoneId: m.zone_id,
      x: m.coord_x,
      y: m.coord_y,
      state: m.current_state,
      currentWorkOrder: m.current_work_order_id,
      currentProgram: m.current_program_name,
      operatorId: m.operator_name || m.active_operator_id,
      cycleElapsedSec: m.cycle_duration_sec || 0,
      spindleLoadPct: m.spindle_load_pct || 0,
      spindleRpm: m.spindle_speed_rpm || 0,
      alarmCode: m.alarm_code,
      alarmMessage: m.alarm_message,
      queuedPouchesCount: m.queue_count || 0,
    }));

    // 2. Pouches (Sample/Cluster active WIP)
    const pouchRows = db.prepare(`
      SELECT 
        p.pouch_id, p.pouch_code, t.tag_code, t.battery_pct, t.last_seen_at,
        wo.work_order_no, wo.expedite_flag, prd.part_name, c.customer_name,
        pc.current_location_type, pc.current_location_id, pc.current_zone_id, pc.confidence_pct,
        z.x_start, z.x_end, z.y_start, z.y_end
      FROM pouch_cycles pc
      JOIN pouches p ON pc.pouch_id = p.pouch_id
      JOIN tags t ON p.tag_id = t.tag_id
      JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
      JOIN products prd ON wo.product_id = prd.product_id
      JOIN customers c ON wo.customer_id = c.customer_id
      JOIN zones z ON pc.current_zone_id = z.zone_id
      WHERE pc.status = 'ACTIVE'
    `).all() as any[];

    // Calculate realistic shop floor (x, y) coordinates for each pouch
    const pouches: TwinPouchMarker[] = pouchRows.map((pr, idx) => {
      let px = pr.x_start + 4.0;
      let py = pr.y_start + 4.0;

      if (pr.current_location_type === 'MACHINE') {
        const m = machines.find((m) => m.machineId === pr.current_location_id);
        if (m) {
          px = m.x + ((idx % 3) - 1) * 0.8;
          py = m.y + ((idx % 2) - 0.5) * 0.8;
        }
      } else if (pr.current_location_type === 'RACK_SLOT') {
        // Find rack slot coord
        const slot = db.prepare(`
          SELECT r.coord_x, r.coord_y FROM shelf_slots s
          JOIN racks r ON s.rack_id = r.rack_id
          WHERE s.slot_code = ?
        `).get(pr.current_location_id) as any;
        if (slot) {
          px = slot.coord_x;
          py = slot.coord_y;
        } else {
          px = 55 + (idx % 24);
          py = 8 + (idx % 8);
        }
      } else {
        // Dispersed in zone
        const width = Math.max(4, pr.x_end - pr.x_start - 4);
        const height = Math.max(4, pr.y_end - pr.y_start - 4);
        px = pr.x_start + 2 + ((idx * 7) % Math.floor(width * 10)) / 10;
        py = pr.y_start + 2 + ((idx * 13) % Math.floor(height * 10)) / 10;
      }

      return {
        pouchId: pr.pouch_id,
        pouchCode: pr.pouch_code,
        tagCode: pr.tag_code,
        workOrderNo: pr.work_order_no,
        partName: pr.part_name,
        customerName: pr.customer_name,
        zoneId: pr.current_zone_id,
        locationType: pr.current_location_type,
        locationId: pr.current_location_id,
        x: Math.round(px * 10) / 10,
        y: Math.round(py * 10) / 10,
        confidencePct: pr.confidence_pct,
        status: 'ACTIVE',
        isExpedite: pr.expedite_flag === 1,
        batteryPct: pr.battery_pct,
        lastSeenTime: pr.last_seen_at,
      };
    });

    // 3. Bottleneck Analysis
    const bottlenecks: TwinBottleneck[] = [
      {
        zoneId: 'ZN-VMC-B',
        zoneName: 'VMC Zone - B',
        activeWipCount: 580,
        capacity: 600,
        utilizationPct: 96.6,
        averageDwellHours: 5.4,
        severity: 'CRITICAL',
        likelyRootCause: 'Machine VMC-42 Spindle Alarm + Fixture changeover delays causing queue accumulation.',
      },
      {
        zoneId: 'ZN-INSP-INT',
        zoneName: 'Inspection Area',
        activeWipCount: 280,
        capacity: 300,
        utilizationPct: 93.3,
        averageDwellHours: 3.8,
        severity: 'ELEVATED',
        likelyRootCause: 'Single CMM metrologist on Shift A causing first-piece measurement backlog.',
      },
      {
        zoneId: 'ZN-WEDM',
        zoneName: 'WEDM Zone',
        activeWipCount: 212,
        capacity: 400,
        utilizationPct: 53.0,
        averageDwellHours: 2.1,
        severity: 'NORMAL',
        likelyRootCause: 'Flow balanced; operations running within standard cycle times.',
      },
    ];

    // 4. KPIs
    const runningCount = machines.filter((m) => m.state === 'RUNNING').length;
    const idleCount = machines.filter((m) => m.state === 'IDLE' || m.state === 'WAITING_MATERIAL').length;
    const alarmCount = machines.filter((m) => m.state === 'ALARM').length;

    const alertCountRow = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status IN ('OPEN', 'ACKNOWLEDGED')").get() as { count: number };

    return {
      timestamp: new Date().toISOString(),
      machines,
      pouches,
      bottlenecks,
      kpis: {
        totalActivePouches: pouches.length,
        inMachining: pouches.filter((p) => p.zoneId.startsWith('ZN-VMC') || p.zoneId === 'ZN-WEDM').length,
        waitingInspection: pouches.filter((p) => p.zoneId === 'ZN-INSP-INT' || p.zoneId === 'ZN-QUAL').length,
        inRacks: pouches.filter((p) => p.zoneId === 'ZN-RACK').length,
        inPacking: pouches.filter((p) => p.zoneId === 'ZN-PACK').length,
        inDispatch: pouches.filter((p) => p.zoneId === 'ZN-DISP').length,
        runningMachines: runningCount,
        idleMachines: idleCount,
        alarmMachines: alarmCount,
        openAlerts: alertCountRow.count,
      },
    };
  }

  /**
   * Captures snapshot for time-machine replay
   */
  public static saveSnapshot(shift: string = 'A'): string {
    const live = this.getLiveTwinState();
    const snapId = `SNP-${uuidv4().substring(0, 8)}`;
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO digital_twin_snapshots (
        snapshot_id, timestamp, shift, snapshot_data_json, active_pouches_count,
        running_machines_count, open_alerts_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapId,
      nowIso,
      shift,
      JSON.stringify(live),
      live.kpis.totalActivePouches,
      live.kpis.runningMachines,
      live.kpis.openAlerts
    );

    return snapId;
  }
}
