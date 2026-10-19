import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface AlertNotificationPayload {
  alertId: string;
  ruleCode: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  zoneId?: string;
  machineId?: string;
  pouchCode?: string;
  workOrderNo?: string;
  channels: string[];
}

export class AlertEngine {
  /**
   * Evaluates movement-triggered rules (Wrong Route, Unauthorized Zone)
   */
  public static evaluateMovement(cycleId: string, fromZoneId: string, toZoneId: string): void {
    const cycle = db.prepare(`
      SELECT pc.cycle_id, pc.work_order_id, p.pouch_code, wo.work_order_no, wo.route_id, wo.current_operation_seq
      FROM pouch_cycles pc
      JOIN pouches p ON pc.pouch_id = p.pouch_id
      JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
      WHERE pc.cycle_id = ?
    `).get(cycleId) as any;

    if (!cycle) return;

    // RULE: Unauthorized Dispatch Entry (Cannot enter Dispatch without passing Quality)
    if (toZoneId === 'ZN-DISP' && fromZoneId !== 'ZN-PACK' && fromZoneId !== 'ZN-QUAL') {
      this.createAlert({
        ruleCode: 'RLE-UNAUTH-ZN',
        severity: 'CRITICAL',
        cycleId: cycle.cycle_id,
        workOrderId: cycle.work_order_id,
        zoneId: toZoneId,
        title: 'Unauthorized Dispatch Movement',
        message: `Pouch ${cycle.pouch_code} (WO: ${cycle.work_order_no}) entered Dispatch directly from ${fromZoneId} without proper packing or final quality inspection!`,
      });
    }

    // RULE: Wrong-Route Movement (e.g. Jumping from Cutting to VMC without passing Inspection)
    if (fromZoneId === 'ZN-CUT' && (toZoneId.startsWith('ZN-VMC') || toZoneId === 'ZN-WEDM')) {
      this.createAlert({
        ruleCode: 'RLE-WRONG-ROUTE',
        severity: 'CRITICAL',
        cycleId: cycle.cycle_id,
        workOrderId: cycle.work_order_id,
        zoneId: toZoneId,
        title: 'Wrong Route - Skipped First-Piece Inspection',
        message: `Pouch ${cycle.pouch_code} (WO: ${cycle.work_order_no}) moved directly from Cutting to Machining without passing Intermediate Metrology check!`,
      });
    }
  }

  /**
   * Periodic scanner for background conditions: Low battery, missing tags, idle WIP, long dwell
   */
  public static scanPeriodicAlerts(): void {
    const now = new Date();

    // 1. Check Missing Tags (> 180 min since last seen)
    const missingTags = db.prepare(`
      SELECT t.tag_id, t.tag_code, p.pouch_code, pc.cycle_id, pc.work_order_id, pc.current_zone_id, t.last_seen_at
      FROM tags t
      JOIN pouches p ON t.tag_id = p.tag_id
      JOIN pouch_cycles pc ON p.current_cycle_id = pc.cycle_id
      WHERE pc.status = 'ACTIVE' 
        AND t.last_seen_at < datetime('now', '-180 minutes')
        AND NOT EXISTS (
          SELECT 1 FROM alerts a 
          WHERE a.cycle_id = pc.cycle_id AND a.rule_code = 'RLE-MISSING' AND a.status IN ('OPEN', 'ACKNOWLEDGED')
        )
    `).all() as any[];

    for (const mt of missingTags) {
      this.createAlert({
        ruleCode: 'RLE-MISSING',
        severity: 'CRITICAL',
        cycleId: mt.cycle_id,
        workOrderId: mt.work_order_id,
        zoneId: mt.current_zone_id,
        title: `Tag Signal Lost (${mt.tag_code})`,
        message: `Pouch ${mt.pouch_code} with tag ${mt.tag_code} has not been detected by any reader for over 3 hours. Potential lost workpiece or RF dead zone.`,
      });
    }

    // 2. Check Low Battery (< 20%)
    const lowBattTags = db.prepare(`
      SELECT t.tag_id, t.tag_code, t.battery_pct, p.pouch_code, pc.cycle_id, pc.work_order_id, pc.current_zone_id
      FROM tags t
      JOIN pouches p ON t.tag_id = p.tag_id
      JOIN pouch_cycles pc ON p.current_cycle_id = pc.cycle_id
      WHERE t.battery_pct < 20
        AND pc.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM alerts a 
          WHERE a.cycle_id = pc.cycle_id AND a.rule_code = 'RLE-BATT' AND a.status IN ('OPEN', 'ACKNOWLEDGED')
        )
    `).all() as any[];

    for (const lb of lowBattTags) {
      this.createAlert({
        ruleCode: 'RLE-BATT',
        severity: 'WARNING',
        cycleId: lb.cycle_id,
        workOrderId: lb.work_order_id,
        zoneId: lb.current_zone_id,
        title: `Tag Battery Low (${lb.battery_pct}%)`,
        message: `Tag ${lb.tag_code} on pouch ${lb.pouch_code} battery is at ${lb.battery_pct}%. Schedule replacement at next station stop.`,
      });
    }
  }

  public static createAlert(params: {
    ruleCode: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    cycleId?: string;
    workOrderId?: string;
    machineId?: string;
    zoneId?: string;
    title: string;
    message: string;
  }): string {
    const alertId = `ALT-${uuidv4().substring(0, 8)}`;
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO alerts (
        alert_id, rule_code, severity, cycle_id, work_order_id, machine_id, zone_id,
        title, message, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
    `).run(
      alertId,
      params.ruleCode,
      params.severity,
      params.cycleId || null,
      params.workOrderId || null,
      params.machineId || null,
      params.zoneId || null,
      params.title,
      params.message,
      nowIso
    );

    console.log(`[Alert Engine] Triggered ${params.severity} Alert: ${params.title} (${alertId})`);
    return alertId;
  }

  public static acknowledgeAlert(alertId: string, userId: string): boolean {
    const nowIso = new Date().toISOString();
    const res = db.prepare(`
      UPDATE alerts
      SET status = 'ACKNOWLEDGED', acknowledged_at = ?, acknowledged_by = ?
      WHERE alert_id = ? AND status = 'OPEN'
    `).run(nowIso, userId, alertId);

    return res.changes > 0;
  }

  public static assignAlert(alertId: string, assignedToUserId: string): boolean {
    const res = db.prepare(`
      UPDATE alerts
      SET status = 'ASSIGNED', assigned_to_user_id = ?
      WHERE alert_id = ?
    `).run(assignedToUserId, alertId);

    return res.changes > 0;
  }

  public static resolveAlert(alertId: string, resolvedByUserId: string, rootCause: string): boolean {
    const nowIso = new Date().toISOString();
    const res = db.prepare(`
      UPDATE alerts
      SET status = 'RESOLVED', resolved_at = ?, resolved_by = ?, root_cause = ?
      WHERE alert_id = ?
    `).run(nowIso, resolvedByUserId, rootCause, alertId);

    return res.changes > 0;
  }
}
