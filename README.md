# INDO-MIM Shop-5 Real-Time Product & Pouch Traceability System
## Production-Grade IoT Traceability, Digital Twin & Smart Dispatch Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-cyan.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg)](https://threejs.org/)
[![SQLite WAL](https://img.shields.io/badge/SQLite-WAL_Mode-brightgreen.svg)](https://sqlite.org/)
[![MQTT](https://img.shields.io/badge/MQTT-Mosquitto_1883-orange.svg)](https://mosquitto.org/)
[![Tests](https://img.shields.io/badge/Tests-17_Passed-success.svg)](server/tests)

---

## 1. Executive Overview

This system delivers an end-to-end industrial IoT product traceability and priority dispatch platform for **INDO-MIM Shop-5**, a high-mix, low-volume precision machining facility featuring:
- **Shop Floor Footprint**: 118.10 m (L) × 60.50 m (W) = ~7,145 m².
- **Machine Fleet**: ~111 Machines (90 Vertical Machining Centers, 21 Wire Cut EDMs, Surface Grinders, and Zeiss CMM Metrology Lab).
- **Active WIP**: 2,000 – 3,000 transparent reusable pouches mapped to Work Orders, Drawings, and Material Heat Lots.
- **Tracking Strategy**: Hybrid Tracking Abstraction Layer (HAL) fusing Active BLE 5.0 beacons, UHF RFID portal gates, Mobile QR shelf scans, and CNC machine telemetry (MTConnect/FOCAS/OPC-UA).

---

## 2. Core Modules Implemented

1. **Live Tracking Dashboard**: Interactive 118.1m × 60.5m plant map with 12 receivers (RX-01..12), movement breadcrumb trail, live product cards, and interactive "Find It" audio buzzer synthesizer.
2. **Dedicated Digital Twin**: Dual-engine rendering with **2D Canvas** and **Three.js 3D Isometric View**, live CNC machine states (Running, Idle, Setup, Alarm, Waiting Material), Time Machine historical replay (1x to 100x), and discrete-event **What-If Sandbox**.
3. **Smart Dispatch Engine**: Multi-factor "Next Job" ranking ($w_{\text{slack}}, w_{\text{risk}}, w_{\text{setup}}, w_{\text{cust}}$) with explainable plain language reason codes, supervisor rebalancing, shipping priority, and a 30-day quantitative backtest vs FIFO & EDD.
4. **WIP Rack Management**: 36 Racks with 432 shelf slots (3 shelves × 4 slots) heat map and intelligent put-away slot calculator.
5. **Mapping Station**: QR work order lookup, tag tap, duplicate mapping prevention, and pouch cycle reuse state machine.
6. **Industrial Alert Engine**: 10 automated rules (Low Battery, Missing Tag, Idle > 4 hrs, Dwell Timeout, Duplicate Mapping, Wrong Route, Unauthorized Zone) with acknowledge/resolve workflow.
7. **End-to-End Genealogy**: Material heat lot certificate pack exportable to CSV/PDF, plus reverse traceability query.
8. **Operator PWA**: High-contrast touch tablet view with large buttons, camera barcode scanner, and Web Speech API voice search.
9. **Realistic Event Simulator**: In-process 18-step movement simulator with 5 live fault injectors (drop reader, machine alarm, battery drain, rush order, wrong route).

---

## 3. Quick Start (Running Locally)

### Prerequisites
- Node.js v18+ or v24
- Mosquitto MQTT Broker (running on port 1883)

### A) Start Backend Server
```bash
cd server
npm install
npx tsx src/index.ts
```
*Backend runs on `http://localhost:5000` (API) and `ws://localhost:5000/ws` (WebSocket).*

### B) Start Frontend Web Dashboard
```bash
cd client
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

### C) Run Automated Test Suite
```bash
cd server
npx tsx tests/runAllTests.ts
```
*Executes all 17 automated tests covering Location Resolver, Mapping, Alerts, Smart Dispatch, and What-If simulator.*

---

## 4. Production Docker Deployment

Deploy the complete stack (Mosquitto broker + Backend + Frontend) using Docker Compose:
```bash
docker-compose up --build -d
```

---

## 5. Documentation Directory

- [Hardware Integration Guide](docs/HARDWARE_INTEGRATION.md): MQTT topics, payload schemas, and CNC controller adapters.
- [Smart Dispatch Engine Specification](docs/DISPATCH_ENGINE_SPEC.md): Mathematical scoring formulas, weights, and backtest results.
- [Phase 1 Pilot Plan](docs/PILOT_PLAN.md): 6-week rollout plan for VMC Bay 1 and 150 pouches.
- [Cost-Benefit & ROI Model](docs/COST_BENEFIT_MODEL.md): 4.6-month payback calculation and 5-year TCO.
