import { db } from '../db/database.js';
import { AlertEngine } from '../core/alertEngine.js';
import { v4 as uuidv4 } from 'uuid';

export class FaultInjector {
  /**
   * Drops a reader offline to simulate hardware or network gateway failure
   */
  public static injectReaderOffline(readerId: string): { success: boolean; message: string } {
    const res = db.prepare("UPDATE readers SET status = 'OFFLINE' WHERE reader_id = ?").run(readerId);
    if (res.changes > 0) {
      AlertEngine.createAlert({
        ruleCode: 'RLE-MISSING',
        severity: 'CRITICAL',
        title: `Reader ${readerId} Disconnected`,
        message: `Gateway ${readerId} dropped offline. Gateway unreachable on industrial PoE switch.`,
      });
      return { success: true, message: `Injected fault: Reader ${readerId} is now OFFLINE.` };
    }
    return { success: false, message: `Reader ${readerId} not found.` };
  }

  /**
   * Restores a reader to ONLINE status
   */
  public static restoreReader(readerId: string): { success: boolean; message: string } {
    db.prepare("UPDATE readers SET status = 'ONLINE', last_heartbeat = datetime('now') WHERE reader_id = ?").run(readerId);
    return { success: true, message: `Reader ${readerId} restored to ONLINE.` };
  }

  /**
   * Injects emergency CNC machine alarm (e.g. tool breakage, coolant pressure low)
   */
  public static injectMachineAlarm(machineId: string, alarmCode: string = 'ALM-1042', alarmMessage: string = 'Tool Breakage / Spindle Overload'): { success: boolean; message: string } {
    db.prepare(`
      UPDATE machines
      SET current_state = 'ALARM',
          alarm_code = ?,
          alarm_message = ?,
          spindle_speed_rpm = 0,
          spindle_load_pct = 0
      WHERE machine_id = ?
    `).run(alarmCode, alarmMessage, machineId);

    AlertEngine.createAlert({
      ruleCode: 'RLE-DWELL-LONG',
      severity: 'CRITICAL',
      machineId,
      title: `Machine Alarm on ${machineId}`,
      message: `Emergency alarm ${alarmCode}: ${alarmMessage} on machine ${machineId}. Machine halted mid-cycle.`,
    });

    return { success: true, message: `Injected alarm ${alarmCode} on ${machineId}.` };
  }

  /**
   * Clears machine alarm and sets back to IDLE or RUNNING
   */
  public static clearMachineAlarm(machineId: string): { success: boolean; message: string } {
    db.prepare(`
      UPDATE machines
      SET current_state = 'IDLE',
          alarm_code = NULL,
          alarm_message = NULL
      WHERE machine_id = ?
    `).run(machineId);

    return { success: true, message: `Alarm cleared on ${machineId}. Machine now IDLE.` };
  }

  /**
   * Drains tag battery to simulate low-battery event (< 15%)
   */
  public static injectBatteryDrain(tagCode: string, targetPct: number = 14): { success: boolean; message: string } {
    const mv = Math.round(2800 + (targetPct / 100) * 500);
    db.prepare(`
      UPDATE tags
      SET battery_pct = ?, battery_mv = ?, status = 'LOW_BATTERY'
      WHERE tag_code = ?
    `).run(targetPct, mv, tagCode);

    AlertEngine.createAlert({
      ruleCode: 'RLE-BATT',
      severity: 'WARNING',
      title: `Critical Low Battery (${targetPct}%)`,
      message: `Tag ${tagCode} battery critically low at ${targetPct}%. Replacement required.`,
    });

    return { success: true, message: `Injected low battery (${targetPct}%) on tag ${tagCode}.` };
  }

  /**
   * Injects an urgent aerospace rush order (expedite flag = 1)
   */
  public static injectRushOrder(orderQuantity: number = 60): { success: boolean; workOrderNo: string; message: string } {
    const woNum = `WO-RUSH-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const dueDate = new Date(Date.now() + 18 * 3600 * 1000).toISOString(); // Due in 18 hours!

    db.prepare(`
      INSERT INTO work_orders (
        work_order_id, work_order_no, product_id, customer_id, route_id,
        order_quantity, completed_quantity, release_date, due_date, expedite_flag,
        status, current_operation_seq, current_zone_id, current_machine_id, heat_lot_no
      ) VALUES (?, ?, 'PRD-01', 'CUST-01', 'RT-PRD-01', ?, 0, ?, ?, 1, 'IN_PROGRESS', 3, 'ZN-RACK', NULL, 'HEAT-202601')
    `).run(woNum, woNum, orderQuantity, nowIso, dueDate);

    AlertEngine.createAlert({
      ruleCode: 'RLE-DISP-PEND',
      severity: 'CRITICAL',
      title: `Critical Rush Order Injected (${woNum})`,
      message: `New Expedited Order ${woNum} for AeroTech Systems inserted. Due in 18 hours! Smart Dispatch prioritized.`,
    });

    return {
      success: true,
      workOrderNo: woNum,
      message: `Rush order ${woNum} created and prioritized for AeroTech Systems.`,
    };
  }

  /**
   * Injects wrong-route movement for a pouch (skips inspection)
   */
  public static injectWrongRoute(pouchCode: string = 'PCH-24-000458'): { success: boolean; message: string } {
    AlertEngine.createAlert({
      ruleCode: 'RLE-WRONG-ROUTE',
      severity: 'CRITICAL',
      zoneId: 'ZN-VMC-B',
      title: 'Wrong Route Violation Detected',
      message: `Pouch ${pouchCode} moved directly from Cutting Section to VMC Zone B skipping mandatory Metrology Inspection!`,
    });

    return { success: true, message: `Wrong-route alert triggered for pouch ${pouchCode}.` };
  }
}
