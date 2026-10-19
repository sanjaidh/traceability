import { IReaderAdapter, RawSensorEvent } from './halInterface.js';

export class BleReceiverAdapter implements IReaderAdapter {
  public readerId: string;
  public readerName: string;
  public zoneId: string;
  private online: boolean = true;
  private calibrationOffsetDb: number = 0;

  constructor(readerId: string, readerName: string, zoneId: string) {
    this.readerId = readerId;
    this.readerName = readerName;
    this.zoneId = zoneId;
  }

  public async connect(): Promise<void> {
    this.online = true;
    console.log(`[BLE Adapter] ${this.readerId} connected to gateway stream.`);
  }

  public async disconnect(): Promise<void> {
    this.online = false;
    console.log(`[BLE Adapter] ${this.readerId} disconnected.`);
  }

  public isOnline(): boolean {
    return this.online;
  }

  public calibrate(offsetDb: number): void {
    this.calibrationOffsetDb = offsetDb;
    console.log(`[BLE Adapter] ${this.readerId} calibrated with offset: ${offsetDb} dBm`);
  }

  public processRawPacket(payload: {
    mac: string;
    tagCode?: string;
    pouchCode?: string;
    rssi: number;
    batteryMv?: number;
    timestamp?: number;
  }): RawSensorEvent | null {
    if (!this.online) return null;

    const rawRssi = payload.rssi + this.calibrationOffsetDb;

    return {
      sourceType: 'BLE_RECEIVER',
      readerId: this.readerId,
      tagCode: payload.tagCode,
      pouchCode: payload.pouchCode,
      rssi: rawRssi,
      batteryMv: payload.batteryMv || 3300,
      direction: 'IN_ZONE',
      hardwareTimestamp: payload.timestamp || Date.now(),
      rawPayload: payload,
    };
  }
}
