import { RawSensorEvent } from './halInterface.js';

export interface CncMachineTelemetry {
  machineId: string;
  execution: 'ACTIVE' | 'READY' | 'INTERRUPTED' | 'STOPPED';
  controllerMode: 'AUTOMATIC' | 'MANUAL' | 'MDI';
  currentProgram?: string;
  workOrderNo?: string;
  spindleSpeedRpm?: number;
  spindleLoadPct?: number;
  partCount?: number;
  alarmCode?: string;
  alarmMessage?: string;
  operatorId?: string;
  timestamp?: number;
}

export class CncMachineAdapter {
  public static parseTelemetry(telemetry: CncMachineTelemetry): RawSensorEvent {
    let machineState: 'RUNNING' | 'IDLE' | 'SETUP' | 'ALARM' | 'OFFLINE' | 'WAITING_MATERIAL' = 'IDLE';

    if (telemetry.alarmCode) {
      machineState = 'ALARM';
    } else if (telemetry.execution === 'ACTIVE' && (telemetry.spindleSpeedRpm || 0) > 100) {
      machineState = 'RUNNING';
    } else if (telemetry.controllerMode === 'MANUAL' || telemetry.execution === 'INTERRUPTED') {
      machineState = 'SETUP';
    } else if (telemetry.execution === 'READY') {
      machineState = 'IDLE';
    }

    return {
      sourceType: 'MACHINE_TELEMETRY',
      readerId: `CNC-ADAPTER-${telemetry.machineId}`,
      machineId: telemetry.machineId,
      workOrderNo: telemetry.workOrderNo,
      programName: telemetry.currentProgram,
      spindleLoadPct: telemetry.spindleLoadPct || 0,
      spindleSpeedRpm: telemetry.spindleSpeedRpm || 0,
      alarmCode: telemetry.alarmCode,
      alarmMessage: telemetry.alarmMessage,
      machineState,
      operatorId: telemetry.operatorId,
      hardwareTimestamp: telemetry.timestamp || Date.now(),
      rawPayload: telemetry,
    };
  }
}
