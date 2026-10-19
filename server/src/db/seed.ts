import { db, initDatabase } from './database.js';
import { v4 as uuidv4 } from 'uuid';

export function seedDatabase(force: boolean = false): void {
  initDatabase();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0 && !force) {
    console.log('[Seed] Database already seeded. Skipping initial seed.');
    return;
  }

  console.log('[Seed] Starting high-fidelity seed for INDO-MIM Shop-5 (~2,643 pouches, 111 machines)...');

  const runSeed = db.transaction(() => {
    // Clear existing data if force
    if (force) {
      db.exec(`
        DELETE FROM audit_logs;
        DELETE FROM dispatch_records;
        DELETE FROM dispatch_lots;
        DELETE FROM inspection_records;
        DELETE FROM material_lots;
        DELETE FROM alerts;
        DELETE FROM alert_rules;
        DELETE FROM resolved_movements;
        DELETE FROM raw_events;
        DELETE FROM pouch_cycles;
        DELETE FROM pouches;
        DELETE FROM tags;
        DELETE FROM work_orders;
        DELETE FROM operations;
        DELETE FROM operation_routes;
        DELETE FROM drawings;
        DELETE FROM products;
        DELETE FROM customers;
        DELETE FROM shelf_slots;
        DELETE FROM racks;
        DELETE FROM machine_states;
        DELETE FROM machines;
        DELETE FROM readers;
        DELETE FROM zones;
        DELETE FROM users;
      `);
    }

    // 1. Users
    const insertUser = db.prepare(`
      INSERT INTO users (user_id, username, full_name, role, email, phone, shift)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const users = [
      ['USR-ADMIN', 'admin', 'Sanjay Hegde', 'ADMIN', 'admin@indo-mim.com', '+91-9876543210', 'A'],
      ['USR-SUP-01', 'supervisor_vmc', 'Ramesh Rao', 'SUPERVISOR', 'ramesh.rao@indo-mim.com', '+91-9876543211', 'A'],
      ['USR-SUP-02', 'supervisor_wedm', 'Anand Kulkarni', 'SUPERVISOR', 'anand.k@indo-mim.com', '+91-9876543212', 'B'],
      ['USR-EMP-0234', 'emp0234', 'Vikas Gowda', 'OPERATOR', 'vikas.g@indo-mim.com', '+91-9876543213', 'A'],
      ['USR-EMP-0512', 'emp0512', 'Suresh Kumar', 'OPERATOR', 'suresh.k@indo-mim.com', '+91-9876543214', 'A'],
      ['USR-QC-01', 'inspector_cmm', 'Pooja Sharma', 'QUALITY', 'pooja.s@indo-mim.com', '+91-9876543215', 'A'],
      ['USR-STORE-01', 'store_incharge', 'Manjunath B', 'STORE', 'manjunath.b@indo-mim.com', '+91-9876543216', 'A'],
      ['USR-MGT-01', 'plant_head', 'Dr. Satish Patil', 'MANAGEMENT', 'satish.p@indo-mim.com', '+91-9876543217', 'A'],
    ];
    for (const u of users) insertUser.run(...u);

    // 2. Zones (Shop-5: 118.10m x 60.50m)
    const insertZone = db.prepare(`
      INSERT INTO zones (zone_id, zone_code, zone_name, category, x_start, y_start, x_end, y_end, max_capacity, color_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const zones = [
      ['ZN-RAW', 'RAW_STORE', 'Raw Material Store', 'STORE', 0, 0, 24, 20, 400, '#3b82f6'],
      ['ZN-CUT', 'CUTTING', 'Cutting Section', 'CUTTING', 24, 0, 48, 20, 300, '#6366f1'],
      ['ZN-RACK', 'WIP_RACKS', 'WIP Rack Storage', 'STORAGE', 48, 0, 84, 20, 800, '#0ea5e9'],
      ['ZN-INSP-INT', 'INSP_STAGE', 'Inspection Area', 'INSPECTION', 84, 0, 118.1, 20, 300, '#eab308'],
      ['ZN-VMC-A', 'VMC_ZONE_A', 'VMC Zone - A', 'MACHINING', 0, 20, 40, 44, 600, '#10b981'],
      ['ZN-VMC-B', 'VMC_ZONE_B', 'VMC Zone - B', 'MACHINING', 40, 20, 80, 44, 600, '#059669'],
      ['ZN-VMC-C', 'VMC_ZONE_C', 'VMC Zone - C', 'MACHINING', 80, 20, 102, 44, 400, '#047857'],
      ['ZN-QUAL', 'QUALITY_ROOM', 'Quality Room (Standard / CMM)', 'FINISHING', 102, 20, 118.1, 44, 250, '#8b5cf6'],
      ['ZN-WEDM', 'WEDM_ZONE', 'WEDM Zone', 'MACHINING', 0, 44, 48, 60.5, 400, '#ec4899'],
      ['ZN-PACK', 'MACHINE_PACK', 'Machine Packing', 'PACKING', 48, 44, 88, 60.5, 350, '#f97316'],
      ['ZN-DISP', 'DISPATCH', 'Dispatch Area', 'DISPATCH', 88, 44, 118.1, 60.5, 500, '#14b8a6'],
    ];
    for (const z of zones) insertZone.run(...z);

    // 3. Readers (RX-01 to RX-12)
    const insertReader = db.prepare(`
      INSERT INTO readers (reader_id, reader_name, reader_type, zone_id, coord_x, coord_y, coverage_radius_m, ip_address, mac_address, mqtt_topic, rssi_threshold_dbm, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const readers = [
      ['RX-01', 'Gateway RX-01 Raw Store', 'BLE_GATEWAY', 'ZN-RAW', 12.0, 10.0, 20.0, '192.168.10.101', '00:1B:44:11:3A:01', 'indomim/shop5/rx01/ble', -78.0, 'ONLINE'],
      ['RX-02', 'Gateway RX-02 Cutting Section', 'BLE_GATEWAY', 'ZN-CUT', 36.0, 10.0, 20.0, '192.168.10.102', '00:1B:44:11:3A:02', 'indomim/shop5/rx02/ble', -78.0, 'ONLINE'],
      ['RX-03', 'Gateway RX-03 WIP Rack Storage', 'BLE_GATEWAY', 'ZN-RACK', 66.0, 10.0, 22.0, '192.168.10.103', '00:1B:44:11:3A:03', 'indomim/shop5/rx03/ble', -76.0, 'ONLINE'],
      ['RX-04', 'Gateway RX-04 Inspection Area', 'BLE_GATEWAY', 'ZN-INSP-INT', 101.0, 10.0, 20.0, '192.168.10.104', '00:1B:44:11:3A:04', 'indomim/shop5/rx04/ble', -78.0, 'ONLINE'],
      ['RX-05', 'Gateway RX-05 West Perimeter', 'BLE_GATEWAY', 'ZN-VMC-A', 4.0, 32.0, 20.0, '192.168.10.105', '00:1B:44:11:3A:05', 'indomim/shop5/rx05/ble', -80.0, 'ONLINE'],
      ['RX-06', 'Gateway RX-06 Quality Room', 'BLE_GATEWAY', 'ZN-QUAL', 110.0, 32.0, 18.0, '192.168.10.106', '00:1B:44:11:3A:06', 'indomim/shop5/rx06/ble', -75.0, 'ONLINE'],
      ['RX-07', 'Gateway RX-07 VMC Zone A', 'BLE_GATEWAY', 'ZN-VMC-A', 20.0, 32.0, 22.0, '192.168.10.107', '00:1B:44:11:3A:07', 'indomim/shop5/rx07/ble', -78.0, 'ONLINE'],
      ['RX-08', 'Gateway RX-08 VMC Zone B', 'BLE_GATEWAY', 'ZN-VMC-B', 60.0, 32.0, 22.0, '192.168.10.108', '00:1B:44:11:3A:08', 'indomim/shop5/rx08/ble', -78.0, 'ONLINE'],
      ['RX-09', 'Gateway RX-09 VMC Zone C', 'BLE_GATEWAY', 'ZN-VMC-C', 91.0, 32.0, 20.0, '192.168.10.109', '00:1B:44:11:3A:09', 'indomim/shop5/rx09/ble', -78.0, 'ONLINE'],
      ['RX-10', 'Gateway RX-10 WEDM Zone', 'BLE_GATEWAY', 'ZN-WEDM', 24.0, 52.0, 22.0, '192.168.10.110', '00:1B:44:11:3A:10', 'indomim/shop5/rx10/ble', -76.0, 'ONLINE'],
      ['RX-11', 'Gateway RX-11 Machine Packing', 'BLE_GATEWAY', 'ZN-PACK', 68.0, 52.0, 22.0, '192.168.10.111', '00:1B:44:11:3A:11', 'indomim/shop5/rx11/ble', -78.0, 'ONLINE'],
      ['RX-12', 'Gateway RX-12 Dispatch Bay', 'BLE_GATEWAY', 'ZN-DISP', 103.0, 52.0, 20.0, '192.168.10.112', '00:1B:44:11:3A:12', 'indomim/shop5/rx12/ble', -78.0, 'ONLINE'],
    ];
    for (const r of readers) insertReader.run(...r);

    // 4. Racks & Shelf Slots (36 Racks with 3 shelves, 4 slots each = 432 slots)
    const insertRack = db.prepare(`
      INSERT INTO racks (rack_id, rack_code, zone_id, coord_x, coord_y, total_shelves, slots_per_shelf)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSlot = db.prepare(`
      INSERT INTO shelf_slots (slot_id, rack_id, shelf_level, slot_number, slot_code, assigned_material_group)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const rackLetters = ['A', 'B', 'C', 'D'];
    let rackIdx = 1;
    for (const letter of rackLetters) {
      for (let num = 1; num <= 9; num++) {
        const rackId = `RCK-${letter}${num}`;
        const rackCode = `RACK-${letter}-${num}`;
        const rx = 50 + (num - 1) * 3.6;
        const ry = 4 + (rackLetters.indexOf(letter)) * 3.8;
        insertRack.run(rackId, rackCode, 'ZN-RACK', rx, ry, 3, 4);

        for (let shelf = 1; shelf <= 3; shelf++) {
          for (let slot = 1; slot <= 4; slot++) {
            const slotId = `SLT-${letter}${num}-${shelf}-${slot}`;
            const slotCode = `${letter}-${num}-${shelf}-${slot}`;
            const matGroup = letter === 'A' ? 'AEROSPACE_TITANIUM' : letter === 'B' ? 'STAINLESS_STEEL' : letter === 'C' ? 'ALUMINIUM' : 'SUPERALLOY';
            insertSlot.run(slotId, rackId, shelf, slot, slotCode, matGroup);
          }
        }
        rackIdx++;
      }
    }

    // 5. Machines (~111 Machines: 90 VMC, 21 WEDM, 4 Surface Grinders, 2 CMM)
    const insertMachine = db.prepare(`
      INSERT INTO machines (machine_id, machine_code, machine_name, machine_type, zone_id, coord_x, coord_y, travel_x_mm, travel_y_mm, travel_z_mm, max_spindle_rpm, power_rating_kw, current_state, current_program_name, spindle_load_pct, spindle_speed_rpm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const states = ['RUNNING', 'RUNNING', 'RUNNING', 'RUNNING', 'IDLE', 'SETUP', 'WAITING_MATERIAL'];
    // 90 VMCs
    for (let i = 1; i <= 90; i++) {
      const code = `VMC-${i.toString().padStart(2, '0')}`;
      let zoneId = 'ZN-VMC-A';
      let gx = 0;
      let gy = 0;
      if (i <= 30) {
        zoneId = 'ZN-VMC-A';
        const col = (i - 1) % 6;
        const row = Math.floor((i - 1) / 6);
        gx = 6 + col * 5.5;
        gy = 23 + row * 4.0;
      } else if (i <= 60) {
        zoneId = 'ZN-VMC-B';
        const col = (i - 31) % 6;
        const row = Math.floor((i - 31) / 6);
        gx = 45 + col * 5.5;
        gy = 23 + row * 4.0;
      } else {
        zoneId = 'ZN-VMC-C';
        const col = (i - 61) % 5;
        const row = Math.floor((i - 61) / 5);
        gx = 83 + col * 3.6;
        gy = 23 + row * 3.3;
      }

      const st = i === 42 ? 'ALARM' : states[i % states.length];
      const prog = st === 'RUNNING' ? `O${1000 + i}.NC` : undefined;
      const load = st === 'RUNNING' ? 55 + (i % 35) : 0;
      const rpm = st === 'RUNNING' ? 8000 + (i % 40) * 100 : 0;
      const type = i % 5 === 0 ? 'VMC_5AXIS' : 'VMC_3AXIS';
      insertMachine.run(code, code, `Vertical Machining Center #${i}`, type, zoneId, gx, gy, 1000, 600, 500, 12000, 18.5, st, prog, load, rpm);
    }

    // 21 WEDMs
    for (let i = 1; i <= 21; i++) {
      const code = `WEDM-${i.toString().padStart(2, '0')}`;
      const col = (i - 1) % 7;
      const row = Math.floor((i - 1) / 7);
      const gx = 6 + col * 6.0;
      const gy = 47 + row * 4.2;
      const st = states[(i + 2) % states.length];
      insertMachine.run(code, code, `Wire Cut EDM #${i}`, 'WEDM_STANDARD', 'ZN-WEDM', gx, gy, 600, 400, 350, 0, 12.0, st, st === 'RUNNING' ? `W${2000 + i}.NC` : undefined, st === 'RUNNING' ? 68 : 0, 0);
    }

    // 4 Surface Grinders
    for (let i = 1; i <= 4; i++) {
      const code = `SGR-${i.toString().padStart(2, '0')}`;
      insertMachine.run(code, code, `High Precision Surface Grinder #${i}`, 'SURFACE_GRINDER', 'ZN-VMC-C', 96.0, 38.0 + (i - 1) * 2.0, 600, 300, 200, 3000, 7.5, 'IDLE', undefined, 0, 0);
    }

    // 2 CMMs in Quality Room
    insertMachine.run('CMM-01', 'CMM-01', 'Zeiss CMM Metrology Lab 1', 'CMM_METROLOGY', 'ZN-QUAL', 108.0, 26.0, 1200, 800, 600, 0, 5.0, 'RUNNING', 'INSP_ROUTINE_316L.PRG', 20, 0);
    insertMachine.run('CMM-02', 'CMM-02', 'Mitutoyo CNC CMM Lab 2', 'CMM_METROLOGY', 'ZN-QUAL', 114.0, 26.0, 1000, 600, 500, 0, 5.0, 'IDLE', undefined, 0, 0);

    // Update VMC-42 with simulated alarm details
    db.prepare(`
      UPDATE machines
      SET alarm_code = 'ALM-1042', alarm_message = 'Spindle Overload / Tool Chipping Detected'
      WHERE machine_id = 'VMC-42'
    `).run();

    // 6. Customers
    const insertCustomer = db.prepare(`
      INSERT INTO customers (customer_id, customer_code, customer_name, tier, sla_on_time_target_pct, contact_email, portal_token)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const customers = [
      ['CUST-01', 'AEROTECH', 'AeroTech Systems Inc.', 'PLATINUM_AEROSPACE', 99.0, 'procurement@aerotech.com', 'tok_aero_9981'],
      ['CUST-02', 'XYZ-AUTO', 'XYZ Automotive Group', 'GOLD_AUTOMOTIVE', 95.0, 'supplychain@xyzauto.com', 'tok_xyz_4421'],
      ['CUST-03', 'MED-GLOBAL', 'MedDevice Global Inc.', 'PLATINUM_AEROSPACE', 99.5, 'qa@meddevice.com', 'tok_med_7734'],
      ['CUST-04', 'TURBO-IND', 'TurboMach Heavy Industries', 'GOLD_AUTOMOTIVE', 93.0, 'ops@turbomach.com', 'tok_turbo_1209'],
      ['CUST-05', 'LUX-WATCH', 'Geneva Luxury Horology', 'PLATINUM_AEROSPACE', 99.0, 'precision@luxwatch.ch', 'tok_lux_8812'],
      ['CUST-06', 'IND-VALVES', 'Bharat Industrial Fluid Systems', 'SILVER_INDUSTRIAL', 90.0, 'orders@indvalves.in', 'tok_valves_3390'],
    ];
    for (const c of customers) insertCustomer.run(...c);

    // 7. Products, Drawings & Routes
    const insertProduct = db.prepare(`
      INSERT INTO products (product_id, part_number, part_name, material_grade, material_family, unit_weight_kg, cad_model_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertDrawing = db.prepare(`
      INSERT INTO drawings (drawing_id, product_id, drawing_no, revision, approved_by, released_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertRoute = db.prepare(`
      INSERT INTO operation_routes (route_id, product_id, route_name, total_operations)
      VALUES (?, ?, ?, ?)
    `);
    const insertOp = db.prepare(`
      INSERT INTO operations (operation_id, route_id, operation_seq, operation_name, target_zone_id, compatible_machine_type, std_setup_time_min, std_run_time_min, fixture_family_id, tool_family_id, program_template)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const products = [
      ['PRD-01', 'PRT-24561', 'Aerospace Impeller Hub', 'Inconel 718', 'SUPERALLOY', 0.85, '/models/impeller.glb', 'DRG-98321-A', 'Rev D'],
      ['PRD-02', 'PRT-30412', 'High-Pressure Fuel Rail Flange', 'SS 316L', 'STAINLESS_STEEL', 1.40, '/models/flange.glb', 'DRG-44102-B', 'Rev B'],
      ['PRD-03', 'PRT-88190', 'Automotive Turbocharger Bracket', 'Al 7075-T6', 'ALUMINIUM', 0.45, '/models/bracket.glb', 'DRG-11094-C', 'Rev C'],
      ['PRD-04', 'PRT-10294', 'Endoscopic Surgical Gripper', '17-4PH SS', 'STAINLESS_STEEL', 0.08, '/models/gripper.glb', 'DRG-77231-A', 'Rev E'],
      ['PRD-05', 'PRT-66521', 'Micro-WEDM Nozzle Core', 'Brass CDA 360', 'BRASS', 0.22, '/models/nozzle.glb', 'DRG-55120-F', 'Rev A'],
      ['PRD-06', 'PRT-99014', 'Titanium Hip Stem Joint Connector', 'Ti-6Al-4V ELI', 'SUPERALLOY', 0.32, '/models/hip_stem.glb', 'DRG-33981-G', 'Rev H'],
    ];

    for (const [pid, pnum, pname, mat, fam, wt, cad, drgNo, rev] of products) {
      insertProduct.run(pid, pnum, pname, mat, fam, wt, cad);
      insertDrawing.run(`DRG-${pid}`, pid, drgNo, rev, 'Chief Metrologist', '2026-01-15');

      const routeId = `RT-${pid}`;
      insertRoute.run(routeId, pid, `18-Step Routing for ${pname}`, 6);

      // Core operations mapped to zones
      insertOp.run(`OP-${pid}-10`, routeId, 1, 'Raw Material Sawing & Billeting', 'ZN-CUT', 'SAW_CUTTER', 15, 12, 'FX-SAW-01', 'TL-SAW-CARBIDE', 'PROG_SAW_01');
      insertOp.run(`OP-${pid}-20`, routeId, 2, 'Initial Metrology Dimension Check', 'ZN-INSP-INT', 'CMM_METROLOGY', 10, 8, 'FX-INSP-STAGE', 'TL-VERNIER-DIGITAL', 'PROG_INSP_01');
      insertOp.run(`OP-${pid}-30`, routeId, 3, 'VMC 5-Axis Rough & Finish Profiling', 'ZN-VMC-B', 'VMC_5AXIS', 45, 65, 'FX-VMC-DOVETAIL-A', 'TL-VMC-TITANIUM-01', 'PROG_VMC_MAIN');
      insertOp.run(`OP-${pid}-40`, routeId, 4, 'Wire EDM Precision Slotting', 'ZN-WEDM', 'WEDM_STANDARD', 30, 40, 'FX-WEDM-FIXTURE-C', 'TL-WIRE-BRASS-025', 'PROG_WEDM_FINE');
      insertOp.run(`OP-${pid}-50`, routeId, 5, 'Final CMM Inspection & OQC', 'ZN-QUAL', 'CMM_METROLOGY', 20, 25, 'FX-CMM-MAGNETIC', 'TL-RUBY-PROBE-02', 'PROG_CMM_FULL');
      insertOp.run(`OP-${pid}-60`, routeId, 6, 'Ultrasonic Wash, VCI Packing & Staging', 'ZN-PACK', 'PACKING_STATION', 10, 15, 'FX-VCI-CARTON', 'TL-BARCODE-VERIFIER', 'PROG_PACK_DISP');
    }

    // 8. Alert Rules
    const insertRule = db.prepare(`
      INSERT INTO alert_rules (rule_code, rule_name, rule_category, severity, threshold_value, threshold_unit, is_enabled, channels_json, auto_escalate_min)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const rules = [
      ['RLE-BATT', 'Tag Low Battery Warning', 'BATTERY', 'WARNING', 20.0, 'PERCENT', 1, '["DASHBOARD", "EMAIL"]', 120],
      ['RLE-MISSING', 'Pouch Tag Signal Lost', 'MISSING_TAG', 'CRITICAL', 180.0, 'MINUTES', 1, '["DASHBOARD", "SMS", "TEAMS"]', 60],
      ['RLE-IDLE-4H', 'WIP Idle Without Movement', 'IDLE_TIMEOUT', 'WARNING', 240.0, 'MINUTES', 1, '["DASHBOARD"]', 180],
      ['RLE-DWELL-LONG', 'Excessive Machine Zone Dwell', 'DWELL_TIMEOUT', 'CRITICAL', 360.0, 'MINUTES', 1, '["DASHBOARD", "TEAMS"]', 90],
      ['RLE-DUP-MAP', 'Duplicate Pouch Cycle Mapping', 'DUPLICATE_MAPPING', 'CRITICAL', 1.0, 'COUNT', 1, '["DASHBOARD"]', 15],
      ['RLE-UNAUTH-ZN', 'Unauthorized Zone Transit Detected', 'UNAUTHORIZED_ZONE', 'CRITICAL', 1.0, 'EVENT', 1, '["DASHBOARD", "SMS"]', 30],
      ['RLE-DISP-PEND', 'Ready Lot Dispatch Pending Cutoff', 'DISPATCH_PENDING', 'WARNING', 60.0, 'MINUTES', 1, '["DASHBOARD"]', 45],
      ['RLE-WRONG-ROUTE', 'Wrong-Route Movement (Skipped Operation)', 'WRONG_ROUTE', 'CRITICAL', 1.0, 'EVENT', 1, '["DASHBOARD", "TEAMS"]', 30],
    ];
    for (const r of rules) insertRule.run(...r);

    // 9. Work Orders, Tags & Pouches (~2,643 Pouches across the plant)
    const insertWO = db.prepare(`
      INSERT INTO work_orders (work_order_id, work_order_no, product_id, customer_id, route_id, order_quantity, completed_quantity, release_date, due_date, expedite_flag, status, current_operation_seq, current_zone_id, current_machine_id, heat_lot_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTag = db.prepare(`
      INSERT INTO tags (tag_id, tag_code, tag_type, mac_address, battery_pct, battery_mv, status, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPouch = db.prepare(`
      INSERT INTO pouches (pouch_id, pouch_code, tag_id, qr_code_payload, pouch_condition, total_cycles_completed, current_cycle_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertCycle = db.prepare(`
      INSERT INTO pouch_cycles (cycle_id, pouch_id, work_order_id, cycle_number, status, mapped_at, current_location_type, current_location_id, current_zone_id, confidence_pct, rssi_current_dbm, battery_snapshot_pct, delivery_risk_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMovement = db.prepare(`
      INSERT INTO resolved_movements (movement_id, cycle_id, pouch_id, from_location_type, from_location_id, to_location_type, to_location_id, zone_id, resolution_level, confidence_pct, reader_id, trigger_event_type, timestamp, dwell_duration_sec)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Target breakdown matching authentic Shop-5 dashboard:
    // Total Active Tags: 2,643
    // In Machining: 1,642 (VMC Zone A: 520, VMC Zone B: 580, VMC Zone C: 330, WEDM: 212)
    // Waiting Inspection: 512 (Inspection Area: 280, Quality Room: 232)
    // WIP Racks: 220
    // In Packing: 186
    // Dispatch: 83
    // Missing: 12
    // Low Battery: 23

    console.log('[Seed] Generating 2,643 active tags, pouches, and historical movements...');

    const now = new Date();
    const woList: string[] = [];

    // Create 35 Work Orders
    for (let w = 1; w <= 35; w++) {
      const woId = `WO-100${(450 + w).toString()}`;
      const prd = products[(w - 1) % products.length];
      const cust = customers[(w - 1) % customers.length];
      const qty = 50 + (w * 17) % 150;
      const isExpedite = w % 6 === 0 ? 1 : 0;
      const daysAhead = 1 + (w % 7);
      const dueDate = new Date(now.getTime() + daysAhead * 24 * 3600 * 1000).toISOString();
      const relDate = new Date(now.getTime() - (10 - daysAhead) * 24 * 3600 * 1000).toISOString();
      insertWO.run(woId, woId, prd[0], cust[0], `RT-${prd[0]}`, qty, Math.floor(qty * 0.4), relDate, dueDate, isExpedite, 'IN_PROGRESS', 3, 'ZN-VMC-B', 'VMC-42', `HEAT-${202600 + w}`);
      woList.push(woId);
    }

    const totalPouches = 2643;
    let missingCount = 0;
    let lowBattCount = 0;

    for (let i = 1; i <= totalPouches; i++) {
      const tagCode = `TAG-${i.toString().padStart(6, '0')}`;
      const tagId = `TAG-${i}`;
      const pouchCode = `PCH-24-${i.toString().padStart(6, '0')}`;
      const pouchId = `PCH-${i}`;
      const cycleId = `CYC-${i}-01`;

      const isLowBatt = lowBattCount < 23 && i % 115 === 0;
      if (isLowBatt) lowBattCount++;
      const battPct = isLowBatt ? 12 + (i % 6) : 85 + (i % 16);
      const battMv = Math.round(2800 + (battPct / 100) * 500);

      const isMissing = missingCount < 12 && i % 220 === 0;
      if (isMissing) missingCount++;

      const tagStatus = isMissing ? 'INACTIVE' : isLowBatt ? 'LOW_BATTERY' : 'ACTIVE';
      const lastSeenOffset = isMissing ? 5 * 3600 * 1000 : (i % 60) * 1000;
      const lastSeen = new Date(now.getTime() - lastSeenOffset).toISOString();

      insertTag.run(tagId, tagCode, 'BLE_ACTIVE', `E4:5F:01:23:${(i % 255).toString(16).padStart(2, '0')}:${((i * 3) % 255).toString(16).padStart(2, '0')}`, battPct, battMv, tagStatus, lastSeen);

      insertPouch.run(pouchId, pouchCode, tagId, `INDO_MIM:PCH:${pouchCode}:${tagCode}`, 'GOOD', 3, cycleId);

      // Determine Zone & Location distribution
      let zId = 'ZN-VMC-B';
      let locType = 'MACHINE';
      let locId = 'VMC-42';
      let conf = 85.0;
      let rssi = -68.0;
      let readerId = 'RX-08';

      if (i <= 520) {
        zId = 'ZN-VMC-A';
        locType = 'MACHINE';
        const mNum = 1 + (i % 30);
        locId = `VMC-${mNum.toString().padStart(2, '0')}`;
        readerId = 'RX-07';
      } else if (i <= 1100) {
        zId = 'ZN-VMC-B';
        locType = 'MACHINE';
        const mNum = 31 + (i % 30);
        locId = `VMC-${mNum.toString().padStart(2, '0')}`;
        readerId = 'RX-08';
      } else if (i <= 1430) {
        zId = 'ZN-VMC-C';
        locType = 'MACHINE';
        const mNum = 61 + (i % 30);
        locId = `VMC-${mNum.toString().padStart(2, '0')}`;
        readerId = 'RX-09';
      } else if (i <= 1642) {
        zId = 'ZN-WEDM';
        locType = 'MACHINE';
        const mNum = 1 + (i % 21);
        locId = `WEDM-${mNum.toString().padStart(2, '0')}`;
        readerId = 'RX-10';
      } else if (i <= 1922) {
        zId = 'ZN-INSP-INT';
        locType = 'ZONE';
        locId = 'ZN-INSP-INT';
        readerId = 'RX-04';
      } else if (i <= 2154) {
        zId = 'ZN-QUAL';
        locType = 'ZONE';
        locId = 'ZN-QUAL';
        readerId = 'RX-06';
      } else if (i <= 2374) {
        zId = 'ZN-RACK';
        locType = 'RACK_SLOT';
        const rackLetter = rackLetters[i % 4];
        const rackNum = 1 + (i % 9);
        const shelf = 1 + (i % 3);
        const slot = 1 + (i % 4);
        locId = `${rackLetter}-${rackNum}-${shelf}-${slot}`;
        conf = 99.0;
        readerId = 'RX-03';
      } else if (i <= 2560) {
        zId = 'ZN-PACK';
        locType = 'ZONE';
        locId = 'ZN-PACK';
        readerId = 'RX-11';
      } else {
        zId = 'ZN-DISP';
        locType = 'ZONE';
        locId = 'ZN-DISP';
        readerId = 'RX-12';
      }

      const assignedWO = woList[i % woList.length];
      const riskScore = (i % 100) / 100;
      insertCycle.run(cycleId, pouchId, assignedWO, 1, 'ACTIVE', new Date(now.getTime() - 24 * 3600 * 1000).toISOString(), locType, locId, zId, conf, rssi, battPct, riskScore);

      // Create recent movement record for timeline & mini-map trail
      if (i <= 300) {
        insertMovement.run(
          `MOV-${i}-01`,
          cycleId,
          pouchId,
          'RACK_SLOT',
          'C-2-1',
          locType,
          locId,
          zId,
          locType === 'RACK_SLOT' ? 'RACK_SLOT' : locType === 'MACHINE' ? 'MACHINE' : 'ZONE',
          conf,
          readerId,
          'GATEWAY_PRESENCE',
          new Date(now.getTime() - ((i % 180) + 10) * 60 * 1000).toISOString(),
          (i % 120) * 60
        );
      }
    }

    // 10. Active Alerts (12 Open Alerts matching authentic Shop-5 view)
    const insertAlert = db.prepare(`
      INSERT INTO alerts (alert_id, rule_code, severity, cycle_id, work_order_id, machine_id, zone_id, title, message, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const alerts = [
      ['ALT-001', 'RLE-BATT', 'WARNING', 'CYC-115-01', 'WO-100458', 'VMC-42', 'ZN-VMC-B', 'Low Battery Warning (14%)', 'Tag TAG-000115 battery dropped below 20%. Replacement recommended.', 'OPEN', new Date(now.getTime() - 45 * 60 * 1000).toISOString()],
      ['ALT-002', 'RLE-MISSING', 'CRITICAL', 'CYC-220-01', 'WO-100462', null, 'ZN-INSP-INT', 'Pouch Tag Lost Signal (> 3 hrs)', 'Tag TAG-000220 not detected by any reader for 195 minutes.', 'OPEN', new Date(now.getTime() - 65 * 60 * 1000).toISOString()],
      ['ALT-003', 'RLE-IDLE-4H', 'WARNING', 'CYC-340-01', 'WO-100465', null, 'ZN-RACK', 'WIP Idle > 4.5 Hours', 'Workpiece in Rack C-3-2 has had no movement for 274 minutes.', 'OPEN', new Date(now.getTime() - 110 * 60 * 1000).toISOString()],
      ['ALT-004', 'RLE-DUP-MAP', 'CRITICAL', 'CYC-500-01', 'WO-100470', null, 'ZN-RAW', 'Duplicate Mapping Detected', 'Tag TAG-000500 scanned for new WO while previous cycle active.', 'OPEN', new Date(now.getTime() - 15 * 60 * 1000).toISOString()],
      ['ALT-005', 'RLE-UNAUTH-ZN', 'CRITICAL', 'CYC-620-01', 'WO-100473', null, 'ZN-DISP', 'Unauthorized Zone Transit', 'Pouch entered Dispatch zone without final OQC sign-off stamp.', 'OPEN', new Date(now.getTime() - 25 * 60 * 1000).toISOString()],
      ['ALT-006', 'RLE-WRONG-ROUTE', 'CRITICAL', 'CYC-750-01', 'WO-100478', 'VMC-18', 'ZN-VMC-A', 'Wrong Route - Skipped Inspection', 'Pouch moved from Cutting directly to VMC-18 skipping intermediate metrology.', 'OPEN', new Date(now.getTime() - 35 * 60 * 1000).toISOString()],
      ['ALT-007', 'RLE-DWELL-LONG', 'CRITICAL', 'CYC-810-01', 'WO-100481', 'VMC-42', 'ZN-VMC-B', 'Excessive Machine Dwell (7.2 hrs)', 'Pouch in VMC-42 bay exceeded maximum allowable station dwell time.', 'OPEN', new Date(now.getTime() - 140 * 60 * 1000).toISOString()],
      ['ALT-008', 'RLE-DISP-PEND', 'WARNING', 'CYC-920-01', 'WO-100483', null, 'ZN-DISP', 'Dispatch Cutoff Imminent', 'Order WO-100483 scheduled truck departs in 42 minutes.', 'OPEN', new Date(now.getTime() - 18 * 60 * 1000).toISOString()],
      ['ALT-009', 'RLE-BATT', 'WARNING', 'CYC-230-01', 'WO-100452', null, 'ZN-RACK', 'Low Battery Warning (16%)', 'Tag TAG-000230 battery at 16%.', 'OPEN', new Date(now.getTime() - 50 * 60 * 1000).toISOString()],
      ['ALT-010', 'RLE-MISSING', 'CRITICAL', 'CYC-440-01', 'WO-100459', null, 'ZN-VMC-C', 'Pouch Tag Lost Signal (> 3 hrs)', 'Tag TAG-000440 last seen at RX-09 over 210 minutes ago.', 'OPEN', new Date(now.getTime() - 85 * 60 * 1000).toISOString()],
      ['ALT-011', 'RLE-IDLE-4H', 'WARNING', 'CYC-560-01', 'WO-100466', null, 'ZN-INSP-INT', 'WIP Idle in Inspection > 4 Hours', 'Batch waiting for Zeiss CMM measurement slot for 250 minutes.', 'OPEN', new Date(now.getTime() - 95 * 60 * 1000).toISOString()],
      ['ALT-012', 'RLE-UNAUTH-ZN', 'CRITICAL', 'CYC-680-01', 'WO-100472', null, 'ZN-CUT', 'Unauthorized Reverse Movement', 'Pouch with finished VMC operations detected back in Cutting section.', 'OPEN', new Date(now.getTime() - 12 * 60 * 1000).toISOString()],
    ];

    for (const a of alerts) insertAlert.run(...a);

    // 11. Priority Weights (Default industrial configuration)
    db.prepare(`
      INSERT INTO priority_weights (config_id, weight_slack, weight_risk, weight_customer, weight_expedite, weight_setup_similarity, weight_proximity, weight_downstream_starvation)
      VALUES ('DEFAULT', 0.25, 0.20, 0.15, 0.15, 0.15, 0.05, 0.05)
    `).run();

    // 12. Material Lots for Genealogy
    const insertMaterial = db.prepare(`
      INSERT INTO material_lots (lot_id, heat_no, supplier_name, material_grade, mill_cert_url, chemical_analysis_json, mechanical_properties_json, received_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertMaterial.run(
      'LOT-INCONEL-718',
      'HEAT-202601',
      'Special Metals Corp (USA)',
      'Inconel 718',
      '/certs/HEAT-202601-CERT.pdf',
      JSON.stringify({ Ni: 52.8, Cr: 19.2, Fe: 18.5, Nb: 5.1, Mo: 3.05, Ti: 0.95, Al: 0.55 }),
      JSON.stringify({ TensileStrengthMpa: 1380, YieldStrengthMpa: 1100, ElongationPct: 18.5, HardnessHRC: 42 }),
      '2026-01-10'
    );

    insertMaterial.run(
      'LOT-SS-316L',
      'HEAT-202602',
      'Sandvik Materials Technology',
      'SS 316L',
      '/certs/HEAT-202602-CERT.pdf',
      JSON.stringify({ Cr: 17.2, Ni: 12.1, Mo: 2.2, C: 0.022, Mn: 1.4, Si: 0.45 }),
      JSON.stringify({ TensileStrengthMpa: 580, YieldStrengthMpa: 290, ElongationPct: 45, HardnessHRB: 85 }),
      '2026-01-18'
    );

    // 13. Dispatch Lots
    const insertDispatchLot = db.prepare(`
      INSERT INTO dispatch_lots (dispatch_lot_id, lot_code, customer_id, carrier_name, truck_number, scheduled_departure, status, pouches_required_count, pouches_ready_count, gate_pass_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertDispatchLot.run(
      'DLOT-2026-001',
      'DISP-AERO-LOT-441',
      'CUST-01',
      'Blue Dart Express Logistics',
      'KA-04-E-8821',
      new Date(now.getTime() + 2 * 3600 * 1000).toISOString(),
      'STAGING',
      50,
      48,
      'GP-2026-9912'
    );

    insertDispatchLot.run(
      'DLOT-2026-002',
      'DISP-AUTO-LOT-782',
      'CUST-02',
      'VRL Logistics Cargo',
      'KA-51-B-3104',
      new Date(now.getTime() + 5 * 3600 * 1000).toISOString(),
      'STAGING',
      120,
      120,
      'GP-2026-9913'
    );

    console.log('[Seed] Seeding completed successfully!');
  });

  runSeed();
}

if (process.argv.includes('--run')) {
  seedDatabase(true);
}
