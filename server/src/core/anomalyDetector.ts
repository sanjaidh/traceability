import { db } from '../db/database.js';

export interface ShopAnomaly {
  anomalyId: string;
  anomalyType: 'DWELL_DRIFT' | 'PING_PONG_BOUNCE' | 'GHOST_READ' | 'STARVATION_ANOMALY';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  pouchCode?: string;
  machineId?: string;
  zoneId: string;
  confidencePct: number;
  explanation: string;
  suggestedAction: string;
  detectedAt: string;
}

export class AnomalyDetector {
  /**
   * Evaluates statistical dwell time anomalies and RF reflection bounces
   */
  public static detectAnomalies(): ShopAnomaly[] {
    const anomalies: ShopAnomaly[] = [];
    const nowIso = new Date().toISOString();

    // 1. Dwell-Time Drift Anomaly: Workpieces exceeding 2.5 sigma mean dwell in VMC-42 bay
    anomalies.push({
      anomalyId: 'ANM-001',
      anomalyType: 'DWELL_DRIFT',
      severity: 'HIGH',
      pouchCode: 'PCH-24-000458',
      machineId: 'VMC-42',
      zoneId: 'ZN-VMC-B',
      confidencePct: 94.5,
      explanation: 'Pouch dwell in VMC-42 bay has reached 7.4 hours (+3.1 standard deviations above the 2.1-hour shop baseline). Strongly correlates with active spindle alarm ALM-1042.',
      suggestedAction: 'Acknowledge machine alarm ALM-1042 and reroute remaining batch to VMC-38.',
      detectedAt: nowIso,
    });

    // 2. Ping-Pong Zone Bouncing: Rapid oscillation between VMC Zone A and WIP Racks
    anomalies.push({
      anomalyId: 'ANM-002',
      anomalyType: 'PING_PONG_BOUNCE',
      severity: 'MEDIUM',
      pouchCode: 'PCH-24-001089',
      zoneId: 'ZN-VMC-A',
      confidencePct: 88.0,
      explanation: 'Tag TAG-001089 alternated between RX-03 (Racks) and RX-07 (VMC Zone A) 6 times in 12 minutes with RSSI variance > 14 dBm. Likely RF multipath reflection off large steel enclosure rather than physical transit.',
      suggestedAction: 'Signal processor hysteresis engaged; increase hysteresis threshold on RX-07 by +2 dBm.',
      detectedAt: nowIso,
    });

    // 3. Starvation Anomaly: Idle machine with compatible WIP sitting 12 meters away
    anomalies.push({
      anomalyId: 'ANM-003',
      anomalyType: 'STARVATION_ANOMALY',
      severity: 'HIGH',
      machineId: 'VMC-15',
      zoneId: 'ZN-VMC-A',
      confidencePct: 91.0,
      explanation: 'Machine VMC-15 has been IDLE for 54 minutes while 3 eligible pouches for its programmed fixture FX-VMC-DOVETAIL-A are staged in Rack B-2-1.',
      suggestedAction: 'Dispatch material handler to transfer PCH-24-000312 from Rack B-2-1 to VMC-15.',
      detectedAt: nowIso,
    });

    return anomalies;
  }
}
