import { RawSensorEvent } from './halInterface.js';

export class MobileQrScannerAdapter {
  public static parseScan(payload: {
    scannedText: string;
    operatorId: string;
    scanLocationType: 'RACK_SLOT' | 'MACHINE' | 'MAPPING_STATION';
    targetId: string; // e.g. "C-3-2" or "VMC-42"
    timestamp?: number;
  }): RawSensorEvent {
    // Parse scanned text (e.g. "INDO_MIM:PCH:PCH-24-000458:TAG-000458")
    let pouchCode = payload.scannedText;
    let tagCode: string | undefined;

    if (payload.scannedText.includes(':')) {
      const parts = payload.scannedText.split(':');
      if (parts.length >= 3) {
        pouchCode = parts[2];
        tagCode = parts[3];
      }
    }

    return {
      sourceType: 'MOBILE_QR',
      readerId: `SCANNER-${payload.operatorId}`,
      pouchCode,
      tagCode,
      locationId: payload.targetId,
      operatorId: payload.operatorId,
      hardwareTimestamp: payload.timestamp || Date.now(),
      rawPayload: payload,
    };
  }
}
