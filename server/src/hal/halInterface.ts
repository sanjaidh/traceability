export type EventSourceType = 
  | 'BLE_RECEIVER' 
  | 'RFID_PORTAL' 
  | 'MOBILE_QR' 
  | 'MACHINE_TELEMETRY' 
  | 'MANUAL_SUPERVISOR';

export interface RawSensorEvent {
  sourceType: EventSourceType;
  readerId: string;
  tagId?: string;
  tagCode?: string;
  pouchCode?: string;
  workOrderNo?: string;
  machineId?: string;
  locationId?: string;
  rssi?: number;
  batteryMv?: number;
  antennaId?: string;
  direction?: 'ENTER' | 'EXIT' | 'IN_ZONE';
  machineState?: 'RUNNING' | 'IDLE' | 'SETUP' | 'ALARM' | 'OFFLINE' | 'WAITING_MATERIAL';
  programName?: string;
  spindleLoadPct?: number;
  spindleSpeedRpm?: number;
  alarmCode?: string;
  alarmMessage?: string;
  operatorId?: string;
  hardwareTimestamp: number;
  rawPayload?: any;
}

export interface NormalizedEvent {
  eventId: string;
  sourceType: EventSourceType;
  readerId: string;
  tagId: string;
  pouchId: string;
  cycleId?: string;
  zoneId: string;
  locationType: 'ZONE' | 'RACK_SLOT' | 'MACHINE' | 'IN_TRANSIT';
  locationId: string;
  smoothedRssi?: number;
  confidencePct: number;
  batteryPct?: number;
  timestamp: string;
}

export interface IReaderAdapter {
  readerId: string;
  readerName: string;
  zoneId: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isOnline(): boolean;
  calibrate(offsetDb: number): void;
  processRawPacket(payload: any): RawSensorEvent | null;
}
