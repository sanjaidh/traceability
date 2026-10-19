import { IReaderAdapter, RawSensorEvent } from './halInterface.js';

export class RfidPortalAdapter implements IReaderAdapter {
  public readerId: string;
  public readerName: string;
  public zoneId: string;
  private online: boolean = true;
  private calibrationOffsetDb: number = 0;
  private lastAntennaRead: Map<string, { antennaId: number; time: number }> = new Map();

  constructor(readerId: string, readerName: string, zoneId: string) {
    this.readerId = readerId;
    this.readerName = readerName;
    this.zoneId = zoneId;
  }

  public async connect(): Promise<void> {
    this.online = true;
    console.log(`[RFID Adapter] ${this.readerId} connected via LLRP.`);
  }

  public async disconnect(): Promise<void> {
    this.online = false;
  }

  public isOnline(): boolean {
    return this.online;
  }

  public calibrate(offsetDb: number): void {
    this.calibrationOffsetDb = offsetDb;
  }

  /**
   * Evaluates sequential antenna reads (e.g. Antenna 1 = outer portal, Antenna 2 = inner portal)
   * Sequence 1 -> 2: ENTER
   * Sequence 2 -> 1: EXIT
   */
  public processRawPacket(payload: {
    epc: string;
    pouchCode?: string;
    antennaId: number; // 1 or 2
    rssi: number;
    timestamp?: number;
  }): RawSensorEvent | null {
    if (!this.online) return null;

    const now = payload.timestamp || Date.now();
    let direction: 'ENTER' | 'EXIT' | 'IN_ZONE' = 'IN_ZONE';

    const previous = this.lastAntennaRead.get(payload.epc);
    if (previous && (now - previous.time) < 4000) {
      if (previous.antennaId === 1 && payload.antennaId === 2) {
        direction = 'ENTER';
      } else if (previous.antennaId === 2 && payload.antennaId === 1) {
        direction = 'EXIT';
      }
    }

    this.lastAntennaRead.set(payload.epc, { antennaId: payload.antennaId, time: now });

    return {
      sourceType: 'RFID_PORTAL',
      readerId: this.readerId,
      pouchCode: payload.pouchCode || payload.epc,
      antennaId: `ANT-${payload.antennaId}`,
      rssi: payload.rssi + this.calibrationOffsetDb,
      direction,
      hardwareTimestamp: now,
      rawPayload: payload,
    };
  }
}
