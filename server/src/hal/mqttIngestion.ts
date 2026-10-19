import mqtt from 'mqtt';
import { LocationResolver } from '../core/locationResolver.js';
import { BleReceiverAdapter } from './bleReceiver.js';
import { RfidPortalAdapter } from './rfidPortal.js';
import { CncMachineAdapter } from './cncAdapter.js';
import { MobileQrScannerAdapter } from './qrScanner.js';
import { SocketManager } from '../websocket/socketManager.js';

export class MqttIngestionService {
  private client: mqtt.MqttClient | null = null;
  private bleAdapters: Map<string, BleReceiverAdapter> = new Map();
  private rfidAdapters: Map<string, RfidPortalAdapter> = new Map();

  constructor() {
    // Initialize 12 BLE receivers
    for (let i = 1; i <= 12; i++) {
      const rid = `RX-${i.toString().padStart(2, '0')}`;
      this.bleAdapters.set(rid, new BleReceiverAdapter(rid, `Gateway ${rid}`, 'ZN-VMC-B'));
    }

    // Initialize RFID Gate portals
    this.rfidAdapters.set('RX-01-RFID', new RfidPortalAdapter('RX-01-RFID', 'Raw Store RFID Gate', 'ZN-RAW'));
    this.rfidAdapters.set('RX-12-RFID', new RfidPortalAdapter('RX-12-RFID', 'Dispatch RFID Gate', 'ZN-DISP'));
  }

  public connect(brokerUrl: string = 'mqtt://127.0.0.1:1883'): void {
    console.log(`[MQTT] Connecting to broker at ${brokerUrl}...`);
    this.client = mqtt.connect(brokerUrl, {
      reconnectPeriod: 5000,
      connectTimeout: 5000,
    });

    this.client.on('connect', () => {
      console.log('[MQTT] Connected to Mosquitto Broker successfully!');
      this.client?.subscribe([
        'indomim/shop5/+/ble',
        'indomim/shop5/+/rfid',
        'indomim/shop5/+/cnc',
        'indomim/shop5/+/qr',
      ], (err) => {
        if (!err) {
          console.log('[MQTT] Subscribed to Shop-5 floor hardware topics.');
        }
      });
    });

    this.client.on('message', (topic: string, message: Buffer) => {
      try {
        const payload = JSON.parse(message.toString());
        this.handleMessage(topic, payload);
      } catch (err) {
        // non-json payload ignore
      }
    });

    this.client.on('error', (err) => {
      console.warn(`[MQTT] Broker notice: ${err.message}. Operating in internal simulated mode.`);
    });
  }

  private handleMessage(topic: string, payload: any): void {
    const parts = topic.split('/');
    const readerKey = parts[2]?.toUpperCase() || 'RX-08';
    const type = parts[3]?.toLowerCase();

    let rawEvent = null;

    if (type === 'ble') {
      const adapter = this.bleAdapters.get(readerKey) || this.bleAdapters.get('RX-08');
      if (adapter) {
        rawEvent = adapter.processRawPacket(payload);
      }
    } else if (type === 'rfid') {
      const adapter = this.rfidAdapters.get(readerKey) || this.rfidAdapters.get('RX-01-RFID');
      if (adapter) {
        rawEvent = adapter.processRawPacket(payload);
      }
    } else if (type === 'cnc') {
      rawEvent = CncMachineAdapter.parseTelemetry(payload);
    } else if (type === 'qr') {
      rawEvent = MobileQrScannerAdapter.parseScan(payload);
    }

    if (rawEvent) {
      const result = LocationResolver.resolveEvent(rawEvent);
      if (result && result.isLocationChanged) {
        SocketManager.broadcast({
          type: 'LOCATION_RESOLVED',
          payload: result,
        });
      }
    }
  }
}

export const mqttIngestion = new MqttIngestionService();
