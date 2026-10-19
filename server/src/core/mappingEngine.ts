import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface MapPouchRequest {
  pouchCode: string;
  tagCode?: string;
  workOrderNo: string;
  operatorId: string;
  initialSlotCode?: string;
  notes?: string;
}

export interface MapPouchResult {
  success: boolean;
  message: string;
  cycleId?: string;
  cycleNumber?: number;
  workOrderNo?: string;
  pouchCode?: string;
}

export class MappingEngine {
  /**
   * Maps a reusable transparent pouch + tag to a Work Order
   */
  public static mapPouch(req: MapPouchRequest): MapPouchResult {
    // 1. Verify Pouch exists
    const pouch = db.prepare(`
      SELECT p.*, t.tag_code, t.battery_pct, t.status as tag_status
      FROM pouches p
      LEFT JOIN tags t ON p.tag_id = t.tag_id
      WHERE p.pouch_code = ?
    `).get(req.pouchCode) as any;

    if (!pouch) {
      return { success: false, message: `Pouch ${req.pouchCode} not found in master registry.` };
    }

    if (pouch.pouch_condition === 'DAMAGED' || pouch.pouch_condition === 'RETIRED') {
      return { success: false, message: `Cannot map pouch ${req.pouchCode}: Pouch condition is ${pouch.pouch_condition}.` };
    }

    // 2. Prevent Duplicate Mapping: Check if current cycle is active
    if (pouch.current_cycle_id) {
      const activeCycle = db.prepare(`
        SELECT pc.cycle_id, pc.cycle_number, wo.work_order_no
        FROM pouch_cycles pc
        JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
        WHERE pc.cycle_id = ? AND pc.status = 'ACTIVE'
      `).get(pouch.current_cycle_id) as any;

      if (activeCycle) {
        return {
          success: false,
          message: `Duplicate mapping blocked: Pouch ${req.pouchCode} is already actively mapped to Work Order ${activeCycle.work_order_no} (Cycle #${activeCycle.cycle_number}). Close or return previous cycle first.`
        };
      }
    }

    // 3. Verify Work Order
    const wo = db.prepare(`
      SELECT * FROM work_orders WHERE work_order_no = ?
    `).get(req.workOrderNo) as any;

    if (!wo) {
      return { success: false, message: `Work Order ${req.workOrderNo} does not exist in ERP master.` };
    }

    if (wo.status === 'COMPLETED' || wo.status === 'DISPATCHED') {
      return { success: false, message: `Work Order ${req.workOrderNo} is already ${wo.status}. Cannot assign new pouches.` };
    }

    // 4. Handle Tag association or validation
    if (req.tagCode && pouch.tag_code !== req.tagCode) {
      // Find new tag and re-associate
      const newTag = db.prepare('SELECT tag_id, tag_code FROM tags WHERE tag_code = ?').get(req.tagCode) as any;
      if (!newTag) {
        return { success: false, message: `Tag ${req.tagCode} not found in tag inventory.` };
      }
      db.prepare('UPDATE pouches SET tag_id = ? WHERE pouch_id = ?').run(newTag.tag_id, pouch.pouch_id);
    }

    // 5. Create new PouchCycle
    const nextCycleNumber = (pouch.total_cycles_completed || 0) + 1;
    const cycleId = `CYC-${pouch.pouch_id}-${nextCycleNumber.toString().padStart(2, '0')}`;
    const nowIso = new Date().toISOString();

    const initialLocationType = req.initialSlotCode ? 'RACK_SLOT' : 'ZONE';
    const initialLocationId = req.initialSlotCode || 'ZN-RAW';
    const initialZoneId = req.initialSlotCode ? 'ZN-RACK' : 'ZN-RAW';

    db.transaction(() => {
      // Insert new cycle
      db.prepare(`
        INSERT INTO pouch_cycles (
          cycle_id, pouch_id, work_order_id, cycle_number, status, mapped_at,
          mapped_by_user_id, current_location_type, current_location_id, current_zone_id,
          confidence_pct, notes
        ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, 99.0, ?)
      `).run(
        cycleId,
        pouch.pouch_id,
        wo.work_order_id,
        nextCycleNumber,
        nowIso,
        req.operatorId,
        initialLocationType,
        initialLocationId,
        initialZoneId,
        req.notes || null
      );

      // Update Pouch pointer
      db.prepare(`
        UPDATE pouches 
        SET current_cycle_id = ?, total_cycles_completed = ?
        WHERE pouch_id = ?
      `).run(cycleId, nextCycleNumber, pouch.pouch_id);

      // If assigned to rack slot, update slot
      if (req.initialSlotCode) {
        db.prepare(`
          UPDATE shelf_slots 
          SET occupied_by_cycle_id = ?, last_scanned_at = ?
          WHERE slot_code = ?
        `).run(cycleId, nowIso, req.initialSlotCode);
      }

      // Record initial movement
      db.prepare(`
        INSERT INTO resolved_movements (
          movement_id, cycle_id, pouch_id, to_location_type, to_location_id,
          zone_id, resolution_level, confidence_pct, operator_id, trigger_event_type, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, 'RACK_SLOT', 99.0, ?, 'MAPPING_ALLOCATION', ?)
      `).run(`MOV-${uuidv4().substring(0, 8)}`, cycleId, pouch.pouch_id, initialLocationType, initialLocationId, initialZoneId, req.operatorId, nowIso);

      // Audit Log
      db.prepare(`
        INSERT INTO audit_logs (log_id, action_type, entity_name, entity_id, performed_by, new_value_json)
        VALUES (?, 'MAP_POUCH', 'pouch_cycles', ?, ?, ?)
      `).run(
        `AUD-${uuidv4().substring(0, 8)}`,
        cycleId,
        req.operatorId,
        JSON.stringify({ pouchCode: req.pouchCode, workOrderNo: req.workOrderNo, cycleNumber: nextCycleNumber })
      );
    })();

    return {
      success: true,
      message: `Pouch ${req.pouchCode} successfully mapped to Work Order ${req.workOrderNo} (Cycle #${nextCycleNumber}).`,
      cycleId,
      cycleNumber: nextCycleNumber,
      workOrderNo: req.workOrderNo,
      pouchCode: req.pouchCode,
    };
  }

  /**
   * Unmaps/closes a pouch cycle (e.g. after dispatch, completion, or return)
   */
  public static unmapPouch(pouchCode: string, operatorId: string, reason: string = 'DISPATCH_COMPLETED'): { success: boolean; message: string } {
    const pouch = db.prepare('SELECT pouch_id, pouch_code, current_cycle_id FROM pouches WHERE pouch_code = ?').get(pouchCode) as any;
    if (!pouch || !pouch.current_cycle_id) {
      return { success: false, message: `Pouch ${pouchCode} does not have an active mapped cycle.` };
    }

    const nowIso = new Date().toISOString();

    db.transaction(() => {
      // Close active cycle
      db.prepare(`
        UPDATE pouch_cycles
        SET status = 'COMPLETED', unmapped_at = ?, unmapped_by_user_id = ?, notes = notes || ' | ' || ?
        WHERE cycle_id = ?
      `).run(nowIso, operatorId, `Unmapped: ${reason}`, pouch.current_cycle_id);

      // Free occupied shelf slot if any
      db.prepare(`
        UPDATE shelf_slots
        SET occupied_by_cycle_id = NULL
        WHERE occupied_by_cycle_id = ?
      `).run(pouch.current_cycle_id);

      // Reset pouch active cycle pointer (now available for next cycle!)
      db.prepare(`
        UPDATE pouches
        SET current_cycle_id = NULL
        WHERE pouch_id = ?
      `).run(pouch.pouch_id);

      // Audit Log
      db.prepare(`
        INSERT INTO audit_logs (log_id, action_type, entity_name, entity_id, performed_by, new_value_json)
        VALUES (?, 'UNMAP_POUCH', 'pouches', ?, ?, ?)
      `).run(
        `AUD-${uuidv4().substring(0, 8)}`,
        pouch.pouch_id,
        operatorId,
        JSON.stringify({ pouchCode, closedCycleId: pouch.current_cycle_id, reason })
      );
    })();

    return {
      success: true,
      message: `Pouch ${pouchCode} successfully unmapped and returned to available inventory.`
    };
  }
}
