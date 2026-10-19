import { db } from '../db/database.js';
import { RawSensorEvent, NormalizedEvent } from '../hal/halInterface.js';
import { signalProcessor } from '../hal/kalmanFilter.js';
import { v4 as uuidv4 } from 'uuid';

export interface LocationResolutionResult {
  cycleId: string;
  pouchId: string;
  pouchCode: string;
  workOrderId: string;
  previousLocationId: string;
  newLocationType: 'ZONE' | 'RACK_SLOT' | 'MACHINE' | 'IN_TRANSIT';
  newLocationId: string;
  zoneId: string;
  confidencePct: number;
  isLocationChanged: boolean;
  timestamp: string;
}

export class LocationResolver {
  /**
   * Main fusion method combining RF signals, RFID gates, QR scans, and CNC states
   */
  public static resolveEvent(raw: RawSensorEvent): LocationResolutionResult | null {
    // 1. Identify Pouch and Active Cycle
    let pouchRow: any;

    if (raw.pouchCode) {
      pouchRow = db.prepare(`
        SELECT p.pouch_id, p.pouch_code, p.tag_id, pc.cycle_id, pc.work_order_id, 
               pc.current_location_type, pc.current_location_id, pc.current_zone_id,
               wo.current_operation_seq, wo.route_id
        FROM pouches p
        LEFT JOIN pouch_cycles pc ON p.current_cycle_id = pc.cycle_id
        LEFT JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
        WHERE p.pouch_code = ?
      `).get(raw.pouchCode);
    } else if (raw.tagCode) {
      pouchRow = db.prepare(`
        SELECT p.pouch_id, p.pouch_code, p.tag_id, pc.cycle_id, pc.work_order_id,
               pc.current_location_type, pc.current_location_id, pc.current_zone_id,
               wo.current_operation_seq, wo.route_id
        FROM tags t
        JOIN pouches p ON t.tag_id = p.tag_id
        LEFT JOIN pouch_cycles pc ON p.current_cycle_id = pc.cycle_id
        LEFT JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
        WHERE t.tag_code = ?
      `).get(raw.tagCode);
    } else if (raw.tagId) {
      pouchRow = db.prepare(`
        SELECT p.pouch_id, p.pouch_code, p.tag_id, pc.cycle_id, pc.work_order_id,
               pc.current_location_type, pc.current_location_id, pc.current_zone_id,
               wo.current_operation_seq, wo.route_id
        FROM pouches p
        LEFT JOIN pouch_cycles pc ON p.current_cycle_id = pc.cycle_id
        LEFT JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
        WHERE p.tag_id = ?
      `).get(raw.tagId);
    }

    if (!pouchRow || !pouchRow.cycle_id) {
      return null;
    }

    const cycleId = pouchRow.cycle_id;
    const pouchId = pouchRow.pouch_id;
    const pouchCode = pouchRow.pouch_code;
    const workOrderId = pouchRow.work_order_id;
    const prevLocationId = pouchRow.current_location_id;
    const prevLocationType = pouchRow.current_location_type;

    let targetLocationType: 'ZONE' | 'RACK_SLOT' | 'MACHINE' | 'IN_TRANSIT' = 'ZONE';
    let targetLocationId: string = pouchRow.current_zone_id || 'ZN-VMC-B';
    let targetZoneId: string = pouchRow.current_zone_id || 'ZN-VMC-B';
    let confidencePct: number = 80.0;
    let smoothedRssi: number = raw.rssi || -75.0;

    // RULE 1: QR Scan (Level 1 Resolution - 99% Confidence)
    if (raw.sourceType === 'MOBILE_QR' && raw.locationId) {
      if (raw.locationId.includes('-') && !raw.locationId.startsWith('VMC') && !raw.locationId.startsWith('WEDM')) {
        targetLocationType = 'RACK_SLOT';
        targetLocationId = raw.locationId;
        targetZoneId = 'ZN-RACK';
        confidencePct = 99.0;
      } else if (raw.locationId.startsWith('VMC') || raw.locationId.startsWith('WEDM')) {
        targetLocationType = 'MACHINE';
        targetLocationId = raw.locationId;
        const mRow = db.prepare('SELECT zone_id FROM machines WHERE machine_id = ?').get(raw.locationId) as { zone_id: string } | undefined;
        targetZoneId = mRow?.zone_id || 'ZN-VMC-B';
        confidencePct = 99.0;
      }
    } 
    // RULE 2: Machine Telemetry Correlation (Level 2 Resolution - 92% Confidence)
    else if (raw.sourceType === 'MACHINE_TELEMETRY' && raw.machineId) {
      targetLocationType = 'MACHINE';
      targetLocationId = raw.machineId;
      const mRow = db.prepare('SELECT zone_id FROM machines WHERE machine_id = ?').get(raw.machineId) as { zone_id: string } | undefined;
      targetZoneId = mRow?.zone_id || 'ZN-VMC-B';
      confidencePct = 92.0;
    }
    // RULE 3: RFID Portal Gate (Directional ENTER / EXIT)
    else if (raw.sourceType === 'RFID_PORTAL') {
      const rRow = db.prepare('SELECT zone_id FROM readers WHERE reader_id = ?').get(raw.readerId) as { zone_id: string } | undefined;
      targetLocationType = 'ZONE';
      targetZoneId = rRow?.zone_id || 'ZN-VMC-B';
      targetLocationId = targetZoneId;
      confidencePct = 88.0;
    }
    // RULE 4: BLE Receiver (Kalman Smoothed RSSI + Hysteresis Debouncing)
    else if (raw.sourceType === 'BLE_RECEIVER') {
      const rRow = db.prepare('SELECT zone_id FROM readers WHERE reader_id = ?').get(raw.readerId) as { zone_id: string } | undefined;
      const detectedZone = rRow?.zone_id || 'ZN-VMC-B';

      const filterResult = signalProcessor.processReading(
        pouchRow.tag_id || pouchCode,
        raw.rssi || -75.0,
        detectedZone,
        raw.readerId,
        raw.hardwareTimestamp
      );

      if (filterResult.isDuplicate) {
        return null; // Suppress duplicate read within 500ms
      }

      smoothedRssi = filterResult.smoothedRssi;
      targetLocationType = 'ZONE';
      targetZoneId = filterResult.resolvedZoneId;
      targetLocationId = targetZoneId;
      confidencePct = 82.0;

      // Check if machine correlation applies: If a machine in this zone is running this exact Work Order
      const runningMachine = db.prepare(`
        SELECT machine_id FROM machines 
        WHERE zone_id = ? AND current_work_order_id = ? AND current_state = 'RUNNING'
      `).get(targetZoneId, workOrderId) as { machine_id: string } | undefined;

      if (runningMachine) {
        targetLocationType = 'MACHINE';
        targetLocationId = runningMachine.machine_id;
        confidencePct = 94.0;
      }
    }

    const isLocationChanged = (targetLocationId !== prevLocationId) || (targetLocationType !== prevLocationType);
    const nowIso = new Date().toISOString();

    // Check if reader exists in readers master table for FK constraint
    const validReader = raw.readerId ? db.prepare('SELECT reader_id FROM readers WHERE reader_id = ?').get(raw.readerId) : null;
    const persistReaderId = validReader ? raw.readerId : null;

    // Persist raw event
    const rawEventId = `EVT-${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO raw_events (raw_event_id, event_source, reader_id, tag_id, pouch_id, cycle_id, rssi_dbm, battery_mv, payload_json, hardware_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rawEventId,
      raw.sourceType,
      persistReaderId,
      pouchRow.tag_id,
      pouchId,
      cycleId,
      smoothedRssi,
      raw.batteryMv || 3300,
      JSON.stringify(raw),
      new Date(raw.hardwareTimestamp).toISOString()
    );

    // If location changed, update state and record movement
    if (isLocationChanged) {
      db.prepare(`
        UPDATE pouch_cycles
        SET current_location_type = ?,
            current_location_id = ?,
            current_zone_id = ?,
            confidence_pct = ?,
            rssi_current_dbm = ?,
            battery_snapshot_pct = COALESCE(?, battery_snapshot_pct)
        WHERE cycle_id = ?
      `).run(
        targetLocationType,
        targetLocationId,
        targetZoneId,
        confidencePct,
        smoothedRssi,
        raw.batteryMv ? Math.round(((raw.batteryMv - 2800) / 500) * 100) : null,
        cycleId
      );

      // Record in resolved movements
      const movId = `MOV-${uuidv4().substring(0, 8)}`;
      db.prepare(`
        INSERT INTO resolved_movements (
          movement_id, cycle_id, pouch_id, from_location_type, from_location_id,
          to_location_type, to_location_id, zone_id, resolution_level, confidence_pct,
          reader_id, operator_id, trigger_event_type, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        movId,
        cycleId,
        pouchId,
        prevLocationType,
        prevLocationId,
        targetLocationType,
        targetLocationId,
        targetZoneId,
        targetLocationType,
        confidencePct,
        persistReaderId,
        raw.operatorId || null,
        raw.sourceType,
        nowIso
      );

      // Update Tag last_seen and battery
      if (pouchRow.tag_id) {
        db.prepare(`
          UPDATE tags 
          SET last_seen_at = ?, 
              battery_mv = COALESCE(?, battery_mv),
              battery_pct = COALESCE(?, battery_pct)
          WHERE tag_id = ?
        `).run(
          nowIso,
          raw.batteryMv || null,
          raw.batteryMv ? Math.min(100, Math.max(0, Math.round(((raw.batteryMv - 2800) / 500) * 100))) : null,
          pouchRow.tag_id
        );
      }
    }

    return {
      cycleId,
      pouchId,
      pouchCode,
      workOrderId,
      previousLocationId: prevLocationId,
      newLocationType: targetLocationType,
      newLocationId: targetLocationId,
      zoneId: targetZoneId,
      confidencePct,
      isLocationChanged,
      timestamp: nowIso,
    };
  }
}
