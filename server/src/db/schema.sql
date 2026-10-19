-- INDO-MIM Shop-5 Production Traceability System Schema
-- SQLite WAL Mode & PostgreSQL DDL Compatible

PRAGMA foreign_keys = ON;

-- 1. Users & RBAC
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('OPERATOR', 'SUPERVISOR', 'QUALITY', 'STORE', 'MANAGEMENT', 'ADMIN')),
    email TEXT,
    phone TEXT,
    shift TEXT CHECK (shift IN ('A', 'B', 'C')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Plant Zones (Shop-5: 118.10m x 60.50m)
CREATE TABLE IF NOT EXISTS zones (
    zone_id TEXT PRIMARY KEY,
    zone_code TEXT UNIQUE NOT NULL,
    zone_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('STORE', 'CUTTING', 'STORAGE', 'INSPECTION', 'MACHINING', 'FINISHING', 'PACKING', 'DISPATCH')),
    x_start REAL NOT NULL,
    y_start REAL NOT NULL,
    x_end REAL NOT NULL,
    y_end REAL NOT NULL,
    max_capacity INTEGER DEFAULT 500,
    color_code TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
);

-- 3. Hardware Readers & Gate Antennas (RX-01 to RX-12)
CREATE TABLE IF NOT EXISTS readers (
    reader_id TEXT PRIMARY KEY,
    reader_name TEXT NOT NULL,
    reader_type TEXT NOT NULL CHECK (reader_type IN ('BLE_GATEWAY', 'UHF_RFID_PORTAL', 'FIXED_BARCODE', 'MOBILE_SCANNER')),
    zone_id TEXT NOT NULL REFERENCES zones(zone_id),
    coord_x REAL NOT NULL,
    coord_y REAL NOT NULL,
    coverage_radius_m REAL DEFAULT 20.0,
    ip_address TEXT,
    mac_address TEXT,
    mqtt_topic TEXT NOT NULL,
    rssi_threshold_dbm REAL DEFAULT -78.0,
    status TEXT NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'DEGRADED', 'MAINTENANCE')),
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. CNC & Support Machinery (~111 Machines: 90 VMC, 21 WEDM, Grinders, CMM)
CREATE TABLE IF NOT EXISTS machines (
    machine_id TEXT PRIMARY KEY,
    machine_code TEXT UNIQUE NOT NULL,
    machine_name TEXT NOT NULL,
    machine_type TEXT NOT NULL CHECK (machine_type IN ('VMC_3AXIS', 'VMC_5AXIS', 'WEDM_STANDARD', 'SURFACE_GRINDER', 'CMM_METROLOGY')),
    zone_id TEXT NOT NULL REFERENCES zones(zone_id),
    coord_x REAL NOT NULL,
    coord_y REAL NOT NULL,
    travel_x_mm REAL NOT NULL,
    travel_y_mm REAL NOT NULL,
    travel_z_mm REAL NOT NULL,
    max_spindle_rpm INTEGER,
    power_rating_kw REAL DEFAULT 15.0,
    current_state TEXT NOT NULL DEFAULT 'IDLE' CHECK (current_state IN ('RUNNING', 'IDLE', 'SETUP', 'ALARM', 'OFFLINE', 'WAITING_MATERIAL')),
    current_work_order_id TEXT,
    current_program_name TEXT,
    active_operator_id TEXT REFERENCES users(user_id),
    cycle_start_time DATETIME,
    cycle_duration_sec INTEGER DEFAULT 0,
    spindle_load_pct REAL DEFAULT 0.0,
    spindle_speed_rpm INTEGER DEFAULT 0,
    alarm_code TEXT,
    alarm_message TEXT,
    last_telemetry_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Machine State History (Time-series for Digital Twin replay & OEE)
CREATE TABLE IF NOT EXISTS machine_states (
    state_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    state TEXT NOT NULL,
    work_order_id TEXT,
    program_name TEXT,
    spindle_load_pct REAL,
    spindle_speed_rpm INTEGER,
    alarm_code TEXT,
    alarm_message TEXT,
    operator_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Rack & Shelf/Slot Hierarchy (WIP Central Storage)
CREATE TABLE IF NOT EXISTS racks (
    rack_id TEXT PRIMARY KEY,
    rack_code TEXT UNIQUE NOT NULL, -- e.g. RACK-A, RACK-B, RACK-C
    zone_id TEXT NOT NULL REFERENCES zones(zone_id),
    coord_x REAL NOT NULL,
    coord_y REAL NOT NULL,
    total_shelves INTEGER DEFAULT 3,
    slots_per_shelf INTEGER DEFAULT 8
);

CREATE TABLE IF NOT EXISTS shelf_slots (
    slot_id TEXT PRIMARY KEY,
    rack_id TEXT NOT NULL REFERENCES racks(rack_id),
    shelf_level INTEGER NOT NULL,
    slot_number INTEGER NOT NULL,
    slot_code TEXT UNIQUE NOT NULL, -- e.g. C-3-2
    occupied_by_cycle_id TEXT,
    assigned_material_group TEXT,
    last_scanned_at DATETIME
);

-- 7. Customers & Priority Tiers
CREATE TABLE IF NOT EXISTS customers (
    customer_id TEXT PRIMARY KEY,
    customer_code TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('PLATINUM_AEROSPACE', 'GOLD_AUTOMOTIVE', 'SILVER_INDUSTRIAL')),
    sla_on_time_target_pct REAL DEFAULT 95.0,
    contact_email TEXT,
    portal_token TEXT UNIQUE
);

-- 8. Products, Drawings & Master Routing
CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    part_number TEXT UNIQUE NOT NULL,
    part_name TEXT NOT NULL,
    material_grade TEXT NOT NULL, -- e.g. SS 316L, 17-4PH, Inconel 718, Al 6061-T6
    material_family TEXT NOT NULL, -- STAINLESS_STEEL, ALUMINIUM, SUPERALLOY, BRASS, PLASTIC
    unit_weight_kg REAL NOT NULL,
    cad_model_url TEXT
);

CREATE TABLE IF NOT EXISTS drawings (
    drawing_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    drawing_no TEXT NOT NULL,
    revision TEXT NOT NULL,
    approved_by TEXT,
    released_date DATE
);

CREATE TABLE IF NOT EXISTS operation_routes (
    route_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    route_name TEXT NOT NULL,
    total_operations INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS operations (
    operation_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL REFERENCES operation_routes(route_id),
    operation_seq INTEGER NOT NULL,
    operation_name TEXT NOT NULL,
    target_zone_id TEXT NOT NULL REFERENCES zones(zone_id),
    compatible_machine_type TEXT NOT NULL,
    std_setup_time_min INTEGER NOT NULL,
    std_run_time_min INTEGER NOT NULL,
    fixture_family_id TEXT,
    tool_family_id TEXT,
    program_template TEXT
);

-- 9. Work Orders (WIP)
CREATE TABLE IF NOT EXISTS work_orders (
    work_order_id TEXT PRIMARY KEY,
    work_order_no TEXT UNIQUE NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id),
    route_id TEXT NOT NULL REFERENCES operation_routes(route_id),
    order_quantity INTEGER NOT NULL,
    completed_quantity INTEGER DEFAULT 0,
    scrapped_quantity INTEGER DEFAULT 0,
    release_date DATETIME NOT NULL,
    due_date DATETIME NOT NULL,
    expedite_flag INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'RELEASED' CHECK (status IN ('RELEASED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'DISPATCHED')),
    current_operation_seq INTEGER DEFAULT 1,
    current_zone_id TEXT REFERENCES zones(zone_id),
    current_machine_id TEXT REFERENCES machines(machine_id),
    heat_lot_no TEXT,
    raw_material_cert_no TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Physical Tags & Pouches
CREATE TABLE IF NOT EXISTS tags (
    tag_id TEXT PRIMARY KEY,
    tag_code TEXT UNIQUE NOT NULL, -- e.g. TAG-005432
    tag_type TEXT NOT NULL CHECK (tag_type IN ('BLE_ACTIVE', 'UHF_RFID_PASSIVE', 'HYBRID_BLE_UHF')),
    mac_address TEXT,
    battery_pct INTEGER DEFAULT 100,
    battery_mv INTEGER DEFAULT 3300,
    firmware_version TEXT DEFAULT 'v2.4.1',
    tx_power_dbm INTEGER DEFAULT 0,
    buzzer_enabled INTEGER DEFAULT 1,
    led_enabled INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOW_BATTERY', 'INACTIVE', 'MAINTENANCE', 'RETIRED')),
    last_battery_check DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pouches (
    pouch_id TEXT PRIMARY KEY,
    pouch_code TEXT UNIQUE NOT NULL, -- e.g. PCH-24-0042
    tag_id TEXT UNIQUE REFERENCES tags(tag_id),
    qr_code_payload TEXT UNIQUE NOT NULL,
    nfc_uid TEXT,
    pouch_condition TEXT DEFAULT 'GOOD' CHECK (pouch_condition IN ('GOOD', 'DAMAGED', 'NEEDS_CLEANING', 'RETIRED')),
    total_cycles_completed INTEGER DEFAULT 0,
    current_cycle_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Pouch Lifecycle Cycles (Reuse tracking)
CREATE TABLE IF NOT EXISTS pouch_cycles (
    cycle_id TEXT PRIMARY KEY,
    pouch_id TEXT NOT NULL REFERENCES pouches(pouch_id),
    work_order_id TEXT NOT NULL REFERENCES work_orders(work_order_id),
    cycle_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'RETURNED')),
    mapped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mapped_by_user_id TEXT REFERENCES users(user_id),
    unmapped_at DATETIME,
    unmapped_by_user_id TEXT REFERENCES users(user_id),
    current_location_type TEXT NOT NULL DEFAULT 'ZONE' CHECK (current_location_type IN ('ZONE', 'RACK_SLOT', 'MACHINE', 'IN_TRANSIT')),
    current_location_id TEXT NOT NULL,
    current_zone_id TEXT REFERENCES zones(zone_id),
    confidence_pct REAL DEFAULT 80.0,
    rssi_current_dbm REAL,
    battery_snapshot_pct INTEGER,
    delivery_risk_score REAL DEFAULT 0.0,
    notes TEXT
);

-- 12. Raw Events & Ingestion Telemetry
CREATE TABLE IF NOT EXISTS raw_events (
    raw_event_id TEXT PRIMARY KEY,
    event_source TEXT NOT NULL CHECK (event_source IN ('BLE_RECEIVER', 'RFID_PORTAL', 'MOBILE_QR', 'MACHINE_TELEMETRY', 'MANUAL_SUPERVISOR')),
    reader_id TEXT REFERENCES readers(reader_id),
    tag_id TEXT REFERENCES tags(tag_id),
    pouch_id TEXT REFERENCES pouches(pouch_id),
    cycle_id TEXT REFERENCES pouch_cycles(cycle_id),
    rssi_dbm REAL,
    battery_mv INTEGER,
    antenna_id TEXT,
    payload_json TEXT,
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    hardware_timestamp DATETIME
);

-- 13. Resolved Movements & Spatial Timeline
CREATE TABLE IF NOT EXISTS resolved_movements (
    movement_id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL REFERENCES pouch_cycles(cycle_id),
    pouch_id TEXT NOT NULL REFERENCES pouches(pouch_id),
    from_location_type TEXT,
    from_location_id TEXT,
    to_location_type TEXT NOT NULL,
    to_location_id TEXT NOT NULL,
    zone_id TEXT NOT NULL REFERENCES zones(zone_id),
    resolution_level TEXT NOT NULL CHECK (resolution_level IN ('RACK_SLOT', 'MACHINE', 'ZONE', 'IN_TRANSIT')),
    confidence_pct REAL NOT NULL,
    reader_id TEXT REFERENCES readers(reader_id),
    operator_id TEXT REFERENCES users(user_id),
    trigger_event_type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    dwell_duration_sec INTEGER DEFAULT 0
);

-- 14. Industrial Alerts & Escalations
CREATE TABLE IF NOT EXISTS alert_rules (
    rule_code TEXT PRIMARY KEY,
    rule_name TEXT NOT NULL,
    rule_category TEXT NOT NULL CHECK (rule_category IN ('BATTERY', 'MISSING_TAG', 'IDLE_TIMEOUT', 'DWELL_TIMEOUT', 'DUPLICATE_MAPPING', 'UNAUTHORIZED_ZONE', 'DISPATCH_PENDING', 'WRONG_ROUTE')),
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
    threshold_value REAL NOT NULL,
    threshold_unit TEXT NOT NULL,
    is_enabled INTEGER DEFAULT 1,
    channels_json TEXT NOT NULL DEFAULT '["DASHBOARD"]',
    auto_escalate_min INTEGER DEFAULT 60
);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id TEXT PRIMARY KEY,
    rule_code TEXT NOT NULL REFERENCES alert_rules(rule_code),
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'WARNING', 'INFO')),
    cycle_id TEXT REFERENCES pouch_cycles(cycle_id),
    work_order_id TEXT REFERENCES work_orders(work_order_id),
    machine_id TEXT REFERENCES machines(machine_id),
    zone_id TEXT REFERENCES zones(zone_id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'ASSIGNED', 'RESOLVED')),
    assigned_to_user_id TEXT REFERENCES users(user_id),
    acknowledged_at DATETIME,
    acknowledged_by TEXT,
    resolved_at DATETIME,
    resolved_by TEXT,
    root_cause TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Quality Inspections & Material Lots (Genealogy)
CREATE TABLE IF NOT EXISTS material_lots (
    lot_id TEXT PRIMARY KEY,
    heat_no TEXT UNIQUE NOT NULL,
    supplier_name TEXT NOT NULL,
    material_grade TEXT NOT NULL,
    mill_cert_url TEXT,
    chemical_analysis_json TEXT,
    mechanical_properties_json TEXT,
    status TEXT NOT NULL DEFAULT 'ACCEPTED' CHECK (status IN ('ACCEPTED', 'QUARANTINED', 'REJECTED')),
    received_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS inspection_records (
    inspection_id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL REFERENCES pouch_cycles(cycle_id),
    operation_seq INTEGER NOT NULL,
    inspection_type TEXT NOT NULL CHECK (inspection_type IN ('FIRST_PIECE', 'IN_PROCESS', 'FINAL_CMM', 'SURFACE_ROUGHNESS')),
    inspector_id TEXT NOT NULL REFERENCES users(user_id),
    result TEXT NOT NULL CHECK (result IN ('PASS', 'REWORK', 'SCRAP')),
    dimensions_measured_json TEXT,
    photo_evidence_url TEXT,
    notes TEXT,
    inspected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. Dispatch Lots & Shipments
CREATE TABLE IF NOT EXISTS dispatch_lots (
    dispatch_lot_id TEXT PRIMARY KEY,
    lot_code TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id),
    carrier_name TEXT NOT NULL,
    truck_number TEXT,
    scheduled_departure DATETIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'STAGING' CHECK (status IN ('STAGING', 'PACKED', 'DISPATCHED', 'CANCELLED')),
    pouches_required_count INTEGER DEFAULT 0,
    pouches_ready_count INTEGER DEFAULT 0,
    gate_pass_no TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatch_records (
    record_id TEXT PRIMARY KEY,
    dispatch_lot_id TEXT NOT NULL REFERENCES dispatch_lots(dispatch_lot_id),
    cycle_id TEXT NOT NULL REFERENCES pouch_cycles(cycle_id),
    packed_by TEXT REFERENCES users(user_id),
    verified_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. Smart Dispatch Scoring & Decisions
CREATE TABLE IF NOT EXISTS priority_weights (
    config_id TEXT PRIMARY KEY,
    weight_slack REAL DEFAULT 0.25,
    weight_risk REAL DEFAULT 0.20,
    weight_customer REAL DEFAULT 0.15,
    weight_expedite REAL DEFAULT 0.15,
    weight_setup_similarity REAL DEFAULT 0.15,
    weight_proximity REAL DEFAULT 0.05,
    weight_downstream_starvation REAL DEFAULT 0.05,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS priority_scores (
    score_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    cycle_id TEXT NOT NULL REFERENCES pouch_cycles(cycle_id),
    rank INTEGER NOT NULL,
    total_score REAL NOT NULL,
    slack_score REAL NOT NULL,
    risk_score REAL NOT NULL,
    setup_score REAL NOT NULL,
    proximity_score REAL NOT NULL,
    reason_codes_json TEXT NOT NULL,
    computed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatch_decisions (
    decision_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES machines(machine_id),
    cycle_id TEXT NOT NULL REFERENCES pouch_cycles(cycle_id),
    action TEXT NOT NULL CHECK (action IN ('ACCEPT', 'SKIP', 'START', 'OVERRIDE')),
    skip_reason TEXT,
    user_id TEXT NOT NULL REFERENCES users(user_id),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 18. Digital Twin Snapshots & Simulations
CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    shift TEXT NOT NULL,
    snapshot_data_json TEXT NOT NULL,
    active_pouches_count INTEGER NOT NULL,
    running_machines_count INTEGER NOT NULL,
    open_alerts_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS simulation_runs (
    run_id TEXT PRIMARY KEY,
    scenario_name TEXT NOT NULL,
    run_type TEXT NOT NULL CHECK (run_type IN ('WHAT_IF_DISPATCH', 'BACKTEST_BENCHMARK', 'FAULT_INJECTION')),
    parameters_json TEXT NOT NULL,
    results_json TEXT NOT NULL,
    executed_by TEXT REFERENCES users(user_id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 19. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    performed_by TEXT REFERENCES users(user_id),
    old_value_json TEXT,
    new_value_json TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for sub-millisecond query performance
CREATE INDEX IF NOT EXISTS idx_pouch_cycles_wo ON pouch_cycles(work_order_id);
CREATE INDEX IF NOT EXISTS idx_pouch_cycles_status ON pouch_cycles(status);
CREATE INDEX IF NOT EXISTS idx_pouch_cycles_location ON pouch_cycles(current_location_id);
CREATE INDEX IF NOT EXISTS idx_movements_cycle ON resolved_movements(cycle_id);
CREATE INDEX IF NOT EXISTS idx_movements_time ON resolved_movements(timestamp);
CREATE INDEX IF NOT EXISTS idx_raw_events_tag ON raw_events(tag_id);
CREATE INDEX IF NOT EXISTS idx_raw_events_time ON raw_events(ingested_at);
CREATE INDEX IF NOT EXISTS idx_machines_state ON machines(current_state);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_shelf_slots_code ON shelf_slots(slot_code);
