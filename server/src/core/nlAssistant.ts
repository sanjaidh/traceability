import { db } from '../db/database.js';
import { SmartDispatchEngine } from './smartDispatch.js';
import { DigitalTwinEngine } from './digitalTwin.js';

export interface AssistantAnswer {
  intent: string;
  query: string;
  reply: string;
  data: any;
  suggestedFollowUps: string[];
}

export class NaturalLanguageAssistant {
  /**
   * Interprets natural language queries into safe, whitelisted parameterized database operations
   */
  public static handleQuery(queryText: string): AssistantAnswer {
    const q = queryText.toLowerCase().trim();

    // 1. Next Job for a specific machine
    if (q.includes('next job') || q.includes('should run next') || q.includes('what to run')) {
      const match = q.match(/(vmc|wedm)[- ]?(\d+)/i);
      const machineId = match ? `${match[1].toUpperCase()}-${match[2].padStart(2, '0')}` : 'VMC-42';

      const nextJobs = SmartDispatchEngine.getNextJobsForMachine(machineId, 3);
      if (nextJobs.length === 0) {
        return {
          intent: 'MACHINE_NEXT_JOB',
          query: queryText,
          reply: `No eligible queued jobs currently found for machine ${machineId}.`,
          data: [],
          suggestedFollowUps: ['Show idle machines in VMC Zone B', 'View rack utilization'],
        };
      }

      const top = nextJobs[0];
      const reply = `For machine **${machineId}**, the top-ranked recommendation is Work Order **${top.workOrderNo}** (${top.partName}, Part #${top.partNumber}) for **${top.customerName}** with a Priority Score of **${top.totalScore}/100**.\n\nKey reasons:\n- ${top.reasonCodes.join('\n- ')}`;

      return {
        intent: 'MACHINE_NEXT_JOB',
        query: queryText,
        reply,
        data: nextJobs,
        suggestedFollowUps: [
          `Show all jobs queued for ${machineId}`,
          `Trigger buzzer for ${top.pouchCode}`,
          'What-If: Reroute top job to VMC-38',
        ],
      };
    }

    // 2. Customer jobs at risk
    if (q.includes('risk') || q.includes('delay') || q.includes('behind schedule')) {
      const customerMatch = q.includes('xyz') ? 'XYZ Automotive Group' : q.includes('aero') ? 'AeroTech Systems Inc.' : 'AeroTech Systems Inc.';
      
      const atRisk = db.prepare(`
        SELECT wo.work_order_no, prd.part_name, c.customer_name, wo.due_date, pc.current_zone_id, pc.current_location_id, pc.delivery_risk_score
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.customer_id
        JOIN products prd ON wo.product_id = prd.product_id
        JOIN pouch_cycles pc ON wo.work_order_id = pc.work_order_id
        WHERE c.customer_name LIKE ? AND wo.due_date < datetime('now', '+3 days')
        LIMIT 5
      `).all(`%${customerMatch.split(' ')[0]}%`) as any[];

      const reply = `Found **${atRisk.length} active jobs at risk** for **${customerMatch}** due within the next 72 hours:\n\n` +
        atRisk.map((r, i) => `${i + 1}. **${r.work_order_no}** (${r.part_name}) in **${r.current_location_id}** — Due: ${new Date(r.due_date).toLocaleDateString()}`).join('\n');

      return {
        intent: 'CUSTOMER_RISK_ANALYSIS',
        query: queryText,
        reply,
        data: atRisk,
        suggestedFollowUps: [
          `Expedite all ${customerMatch.split(' ')[0]} orders`,
          'View dispatch schedule for tomorrow',
          'Highlight risk orders on Digital Twin',
        ],
      };
    }

    // 3. Pouch or Work Order location lookup
    if (q.includes('where is') || q.includes('find') || q.includes('locate') || q.includes('search')) {
      const match = q.match(/(pch|tag|wo)[- ]?([a-z0-9-]+)/i);
      const searchTarget = match ? match[0].toUpperCase().replace(' ', '-') : 'WO-100458';

      const row = db.prepare(`
        SELECT p.pouch_code, t.tag_code, t.battery_pct, wo.work_order_no, prd.part_name, c.customer_name,
               pc.current_location_type, pc.current_location_id, pc.current_zone_id, z.zone_name,
               pc.confidence_pct, t.last_seen_at
        FROM pouches p
        JOIN tags t ON p.tag_id = t.tag_id
        JOIN pouch_cycles pc ON p.current_cycle_id = pc.cycle_id
        JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
        JOIN products prd ON wo.product_id = prd.product_id
        JOIN customers c ON wo.customer_id = c.customer_id
        JOIN zones z ON pc.current_zone_id = z.zone_id
        WHERE wo.work_order_no LIKE ? OR p.pouch_code LIKE ? OR t.tag_code LIKE ?
        LIMIT 1
      `).get(`%${searchTarget}%`, `%${searchTarget}%`, `%${searchTarget}%`) as any;

      if (!row) {
        return {
          intent: 'LOCATION_LOOKUP',
          query: queryText,
          reply: `Could not locate an active pouch for query "${searchTarget}". Check that the tag is mapped and active.`,
          data: null,
          suggestedFollowUps: ['Search in rack storage', 'View missing tag alerts'],
        };
      }

      const reply = `**${row.pouch_code}** (${row.work_order_no} - ${row.part_name}) is located at **${row.current_location_id}** in **${row.zone_name}** with **${row.confidencePct}% confidence** (Resolution: ${row.current_location_type}).\n\nTag ${row.tag_code} battery is at **${row.battery_pct}%** (Last seen: ${new Date(row.last_seen_at).toLocaleTimeString()}).`;

      return {
        intent: 'LOCATION_LOOKUP',
        query: queryText,
        reply,
        data: row,
        suggestedFollowUps: [
          `Trigger Buzzer / LED for ${row.pouch_code}`,
          `Show full movement timeline for ${row.pouch_code}`,
          `View machine queue around ${row.current_location_id}`,
        ],
      };
    }

    // Default fallback
    return {
      intent: 'GENERAL_ASSISTANCE',
      query: queryText,
      reply: 'Shop-5 AI Assistant ready. You can ask questions such as:\n- *"Which jobs for XYZ Automotive are at risk this week?"*\n- *"What should machine VMC-42 run next?"*\n- *"Where is WO-100458?"*\n- *"Show active bottlenecks on the floor"*',
      data: null,
      suggestedFollowUps: [
        'What should machine VMC-42 run next?',
        'Which jobs for XYZ Automotive are at risk this week?',
        'Where is WO-100458?',
        'Show active bottlenecks on the floor',
      ],
    };
  }
}
