# Hardware Integration Guide: INDO-MIM Shop-5
## Reader & Tag Onboarding, MQTT Specs, Payload Schemas, and Machine Adapters

---

## 1. Physical Architecture & Gateways Overview

INDO-MIM Shop-5 utilizes a hybrid hardware approach tailored for noisy, metal-dense CNC machining environments:
- **Active BLE 5.0 Tags**: Mounted on reusable transparent pouches. Transmit iBeacon / Eddystone telemetry at 1 Hz intervals (Tx power: 0 dBm, 3–5 year coin-cell battery life, IP65 sealed).
- **12x Industrial PoE BLE Gateways (RX-01 to RX-12)**: Strategically installed along the perimeter and ceiling gangways (118.10 m × 60.50 m) to ensure line-of-sight and multi-point triangulation.
- **Directional UHF RFID Gates**: Placed at Raw Material Store (RX-01-RFID) and Dispatch (RX-12-RFID) to log bulk tray transit.
- **Mobile QR Handhelds**: Rugged Android/iOS tablets running the Operator PWA for rack slot put-away scans and First-Piece inspection sign-offs.
- **CNC Telemetry Adapters**: Ethernet connections to machine controllers (Fanuc 0i-MF, Siemens 840D, Heidenhain TNC) via MTConnect, Fanuc FOCAS, or OPC-UA.

---

## 2. MQTT Broker & Topic Hierarchy

Gateways publish sensor telemetry to an on-premise Mosquitto MQTT broker on port `1883`.

### Topic Naming Standard
```
indomim/shop5/<reader_id>/<sensor_type>
```

| Topic Pattern | Source Hardware | Description |
| :--- | :--- | :--- |
| `indomim/shop5/rx01..12/ble` | BLE Gateways | Raw BLE advertising packets (RSSI, MAC, battery) |
| `indomim/shop5/rx01/rfid` | UHF RFID Portals | EPC Gen2 tag reads with antenna sequence |
| `indomim/shop5/cnc/telemetry` | Edge CNC Bridge | Spindle RPM, load %, execution state, alarm codes |
| `indomim/shop5/mobile/scan` | Operator PWA | Barcode/QR scan payloads from phone/tablet camera |

---

## 3. Payload Schemas

### A) BLE Gateway Ingestion Payload (`indomim/shop5/rx08/ble`)
```json
{
  "gatewayId": "RX-08",
  "mac": "E4:5F:01:23:AA:42",
  "tagCode": "TAG-005432",
  "pouchCode": "PCH-24-000458",
  "rssi": -52.4,
  "txPower": 0,
  "batteryMv": 3260,
  "batteryPct": 92,
  "motionBit": 0,
  "timestamp": 1715600598000
}
```

### B) UHF RFID Gate Payload (`indomim/shop5/rx12/rfid`)
```json
{
  "readerId": "RX-12-RFID",
  "epc": "E280116060000204781299AB",
  "pouchCode": "PCH-24-000458",
  "antennaId": 2,
  "rssi": -61.2,
  "direction": "EXIT",
  "timestamp": 1715600612000
}
```

### C) CNC Machine Telemetry Payload (`indomim/shop5/cnc/telemetry`)
```json
{
  "machineId": "VMC-42",
  "execution": "ACTIVE",
  "controllerMode": "AUTOMATIC",
  "currentProgram": "O1042.NC",
  "workOrderNo": "WO-100458",
  "spindleSpeedRpm": 8450,
  "spindleLoadPct": 68.4,
  "partCount": 42,
  "alarmCode": null,
  "alarmMessage": null,
  "operatorId": "USR-EMP-0234",
  "timestamp": 1715600620000
}
```

### D) Mobile QR Scan Payload (`indomim/shop5/mobile/scan`)
```json
{
  "scannedText": "INDO_MIM:PCH:PCH-24-000458:TAG-005432",
  "targetId": "C-3-2",
  "scanLocationType": "RACK_SLOT",
  "operatorId": "USR-EMP-0234",
  "timestamp": 1715600630000
}
```

---

## 4. CNC Machine Controller Adapters

For machines without native MTConnect, deploy a lightweight Python or Node edge agent running on the machine's local industrial PC:

```python
# Minimal Fanuc FOCAS Adapter Stub
import ctypes

def read_focas_telemetry(ip_address, machine_id):
    # Connect to Fanuc controller on Port 8193
    # Reads execution state, active program, spindle speed, and macro variables
    return {
        "machineId": machine_id,
        "execution": "ACTIVE",
        "spindleSpeedRpm": 8200,
        "spindleLoadPct": 62.0,
        "currentProgram": "O1042.NC",
        "alarmCode": None
    }
```

---

## 5. Metal-Environment RF Calibration

To eliminate signal reflection off steel machine casings:
1. Navigate to `/api/tracking/calibrate` or the Admin Calibration page.
2. Select the target reader (e.g. `RX-08` in VMC Zone B).
3. Apply an RSSI offset (e.g. `+2.5 dBm` or `-3.0 dBm`) based on reference beacon measurements.
4. The backend 1D Kalman filter and 4.0 dBm hysteresis threshold will automatically apply the offset to stabilize zone borders.
