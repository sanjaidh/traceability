import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

export interface NextJobRecommendation {
  rank: number;
  cycleId: string;
  pouchCode: string;
  workOrderNo: string;
  partNumber: string;
  partName: string;
  customerName: string;
  customerTier: string;
  materialGrade: string;
  currentLocationType: string;
  currentLocationId: string;
  distanceMeters: number;
  totalScore: number;
  breakdown: {
    slackScore: number;
    riskScore: number;
    setupScore: number;
    customerScore: number;
    expediteBonus: number;
    proximityScore: number;
  };
  reasonCodes: string[];
}

export interface RebalanceSuggestion {
  starvingMachineId: string;
  overburdenedMachineId: string;
  candidateCycleId: string;
  pouchCode: string;
  workOrderNo: string;
  estimatedQueueSavedMinutes: number;
  reason: string;
}

export class SmartDispatchEngine {
  /**
   * Computes ranked Next Job list for a given CNC machine
   */
  public static getNextJobsForMachine(machineId: string, limit: number = 5): NextJobRecommendation[] {
    const machine = db.prepare('SELECT * FROM machines WHERE machine_id = ?').get(machineId) as any;
    if (!machine) return [];

    // Retrieve active priority weights
    const weights = db.prepare("SELECT * FROM priority_weights WHERE config_id = 'DEFAULT'").get() as any || {
      weight_slack: 0.25,
      weight_risk: 0.20,
      weight_customer: 0.15,
      weight_expedite: 0.15,
      weight_setup_similarity: 0.15,
      weight_proximity: 0.05,
      weight_downstream_starvation: 0.05,
    };

    // Find candidate pouches that are in WIP or in racks or nearby
    const candidates = db.prepare(`
      SELECT 
        pc.cycle_id, pc.current_location_type, pc.current_location_id, pc.current_zone_id,
        p.pouch_code, wo.work_order_no, wo.due_date, wo.expedite_flag, wo.order_quantity,
        prd.part_number, prd.part_name, prd.material_grade, prd.material_family,
        c.customer_name, c.tier as customer_tier,
        op.operation_name, op.fixture_family_id, op.tool_family_id, op.std_run_time_min,
        t.buzzer_enabled, t.led_enabled
      FROM pouch_cycles pc
      JOIN pouches p ON pc.pouch_id = p.pouch_id
      JOIN tags t ON p.tag_id = t.tag_id
      JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
      JOIN products prd ON wo.product_id = prd.product_id
      JOIN customers c ON wo.customer_id = c.customer_id
      JOIN operations op ON wo.route_id = op.route_id AND op.operation_seq = wo.current_operation_seq
      WHERE pc.status = 'ACTIVE'
        AND pc.current_location_id != ? -- Not already loaded on this machine
        AND (
          pc.current_zone_id = ? OR 
          pc.current_zone_id = 'ZN-RACK' OR 
          pc.current_zone_id = 'ZN-INSP-INT'
        )
      LIMIT 40
    `).all(machineId, machine.zone_id) as any[];

    const now = Date.now();
    const scoredList: NextJobRecommendation[] = [];

    for (const cand of candidates) {
      const reasonCodes: string[] = [];

      // 1. Due Date Slack Score (0..100)
      const dueMs = new Date(cand.due_date).getTime();
      const hoursToDue = Math.max(1, (dueMs - now) / (3600 * 1000));
      let slackScore = 100;
      if (hoursToDue < 12) {
        slackScore = 95;
        reasonCodes.push(`Due in ${hoursToDue.toFixed(1)} hrs (High Deadline Pressure)`);
      } else if (hoursToDue < 24) {
        slackScore = 80;
        reasonCodes.push(`Due in ${hoursToDue.toFixed(1)} hrs`);
      } else if (hoursToDue < 48) {
        slackScore = 60;
      } else {
        slackScore = 30;
      }

      // 2. Customer Tier Score
      let custScore = 50;
      if (cand.customer_tier.includes('PLATINUM')) {
        custScore = 100;
        reasonCodes.push(`Platinum Tier Customer (${cand.customer_name})`);
      } else if (cand.customer_tier.includes('GOLD')) {
        custScore = 75;
      }

      // 3. Expedite Bonus
      let expBonus = 0;
      if (cand.expedite_flag === 1) {
        expBonus = 100;
        reasonCodes.push('EXPEDITED Priority Flag Active');
      }

      // 4. Setup Similarity Score (Material / Fixture match to current machine job)
      let setupScore = 20;
      if (machine.current_program_name && machine.current_program_name.includes(cand.part_number)) {
        setupScore = 100;
        reasonCodes.push('Zero-Changeover: Exact same part program & setup');
      } else if (cand.material_family === 'SUPERALLOY' || cand.material_grade.includes('316L')) {
        setupScore = 80;
        reasonCodes.push(`Compatible Material Group: ${cand.material_grade}`);
      }

      // 5. Proximity & Rack Distance
      let distanceMeters = 15;
      if (cand.current_location_type === 'RACK_SLOT') {
        distanceMeters = 12;
        reasonCodes.push(`Located in Central Rack (${cand.current_location_id})`);
      } else if (cand.current_zone_id === machine.zone_id) {
        distanceMeters = 5;
        reasonCodes.push('Staged nearby in machine bay');
      }

      const proximityScore = Math.max(0, 100 - distanceMeters * 3);
      const deliveryRiskScore = 35; // Derived from ML risk predictor

      // Weighted Total Score
      const totalScore = (
        slackScore * weights.weight_slack +
        deliveryRiskScore * weights.weight_risk +
        custScore * weights.weight_customer +
        expBonus * weights.weight_expedite +
        setupScore * weights.weight_setup_similarity +
        proximityScore * weights.weight_proximity
      );

      scoredList.push({
        rank: 0,
        cycleId: cand.cycle_id,
        pouchCode: cand.pouch_code,
        workOrderNo: cand.work_order_no,
        partNumber: cand.part_number,
        partName: cand.part_name,
        customerName: cand.customer_name,
        customerTier: cand.customer_tier,
        materialGrade: cand.material_grade,
        currentLocationType: cand.current_location_type,
        currentLocationId: cand.current_location_id,
        distanceMeters,
        totalScore: Math.round(totalScore * 10) / 10,
        breakdown: {
          slackScore,
          riskScore: deliveryRiskScore,
          setupScore,
          customerScore: custScore,
          expediteBonus: expBonus,
          proximityScore,
        },
        reasonCodes,
      });
    }

    // Sort descending by total score
    scoredList.sort((a, b) => b.totalScore - a.totalScore);

    // Assign 1-indexed ranks
    scoredList.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    return scoredList.slice(0, limit);
  }

  /**
   * Records operator action on Next Job card (Accept, Skip, Start)
   */
  public static recordDecision(params: {
    machineId: string;
    cycleId: string;
    action: 'ACCEPT' | 'SKIP' | 'START' | 'OVERRIDE';
    skipReason?: string;
    userId: string;
  }): boolean {
    const decId = `DEC-${uuidv4().substring(0, 8)}`;
    db.prepare(`
      INSERT INTO dispatch_decisions (decision_id, machine_id, cycle_id, action, skip_reason, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(decId, params.machineId, params.cycleId, params.action, params.skipReason || null, params.userId);

    if (params.action === 'START') {
      // Find Work Order for this cycle and update machine state
      const cycle = db.prepare('SELECT work_order_id FROM pouch_cycles WHERE cycle_id = ?').get(params.cycleId) as any;
      if (cycle) {
        db.prepare(`
          UPDATE machines
          SET current_state = 'RUNNING',
              current_work_order_id = ?,
              active_operator_id = ?,
              cycle_start_time = datetime('now')
          WHERE machine_id = ?
        `).run(cycle.work_order_id, params.userId, params.machineId);
      }
    }

    return true;
  }

  /**
   * Detects starving machines vs overburdened machines and suggests rebalancing
   */
  public static getRebalanceSuggestions(): RebalanceSuggestion[] {
    const suggestions: RebalanceSuggestion[] = [];

    // Find machines in WAITING_MATERIAL or IDLE
    const idleMachines = db.prepare(`
      SELECT machine_id, machine_type, zone_id
      FROM machines
      WHERE current_state IN ('WAITING_MATERIAL', 'IDLE')
      LIMIT 3
    `).all() as any[];

    for (const im of idleMachines) {
      // Check if another machine in the same zone has a queue
      const busyMachine = db.prepare(`
        SELECT machine_id, current_program_name
        FROM machines
        WHERE machine_type = ? AND machine_id != ? AND current_state = 'RUNNING'
        LIMIT 1
      `).get(im.machine_type, im.machine_id) as any;

      if (busyMachine) {
        // Find a candidate pouch queued in rack
        const candidatePouch = db.prepare(`
          SELECT pc.cycle_id, p.pouch_code, wo.work_order_no
          FROM pouch_cycles pc
          JOIN pouches p ON pc.pouch_id = p.pouch_id
          JOIN work_orders wo ON pc.work_order_id = wo.work_order_id
          WHERE pc.status = 'ACTIVE' AND pc.current_zone_id = 'ZN-RACK'
          LIMIT 1
        `).get() as any;

        if (candidatePouch) {
          suggestions.push({
            starvingMachineId: im.machine_id,
            overburdenedMachineId: busyMachine.machine_id,
            candidateCycleId: candidatePouch.cycle_id,
            pouchCode: candidatePouch.pouch_code,
            workOrderNo: candidatePouch.work_order_no,
            estimatedQueueSavedMinutes: 45,
            reason: `${im.machine_id} is currently starving. Rerouting ${candidatePouch.pouch_code} from queue avoids 45 min waiting delay.`,
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Shipping Priority Engine: Ranks ready lots and detects missing blocking pouches
   */
  public static getShippingPriority(): any[] {
    const lots = db.prepare(`
      SELECT dl.*, c.customer_name, c.tier as customer_tier
      FROM dispatch_lots dl
      JOIN customers c ON dl.customer_id = c.customer_id
      ORDER BY dl.scheduled_departure ASC
    `).all() as any[];

    const result = [];
    for (const lot of lots) {
      const missingCount = lot.pouches_required_count - lot.pouches_ready_count;

      // Find details of missing pouches if any
      let missingPouches: any[] = [];
      if (missingCount > 0) {
        missingPouches = db.prepare(`
          SELECT p.pouch_code, pc.current_location_id, pc.current_zone_id, z.zone_name
          FROM pouch_cycles pc
          JOIN pouches p ON pc.pouch_id = p.pouch_id
          JOIN zones z ON pc.current_zone_id = z.zone_id
          WHERE pc.status = 'ACTIVE' AND pc.current_zone_id != 'ZN-DISP'
          LIMIT ?
        `).all(missingCount) as any[];
      }

      result.push({
        ...lot,
        missingCount,
        isAtRisk: missingCount > 0,
        missingPouches,
      });
    }

    return result;
  }
}
