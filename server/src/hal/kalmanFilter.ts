/**
 * 1D Kalman Filter and Sliding-Window Smoother for High-Multipath Industrial Environments
 * Mitigates metal reflection spikes, fading, and RF shadows around CNC enclosures.
 */

export class RssiKalmanFilter {
  private q: number; // Process noise covariance
  private r: number; // Measurement noise covariance
  private x: number; // Value estimate (RSSI)
  private p: number; // Estimation error covariance
  private k: number; // Kalman gain

  constructor(processNoise: number = 0.05, measurementNoise: number = 3.5, initialRssi: number = -75.0) {
    this.q = processNoise;
    this.r = measurementNoise;
    this.x = initialRssi;
    this.p = 1.0;
    this.k = 0.0;
  }

  public update(measurement: number): number {
    // Prediction update
    this.p = this.p + this.q;

    // Measurement update
    this.k = this.p / (this.p + this.r);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * this.p;

    return this.x;
  }

  public getEstimate(): number {
    return this.x;
  }
}

interface TagFilterState {
  kalman: RssiKalmanFilter;
  recentRssi: number[];
  currentZoneId: string;
  candidateZoneId?: string;
  candidateCount: number;
  lastSeenTime: number;
}

export class ShopFloorSignalProcessor {
  private tagStates: Map<string, TagFilterState> = new Map();
  private readerCalibrationOffsets: Map<string, number> = new Map();

  // Hysteresis configuration
  private hysteresisDb: number = 4.0; // Must be 4 dB stronger to switch zones
  private requiredConsecutiveReads: number = 3;
  private dedupWindowMs: number = 500; // Drop duplicate reads within 500ms

  constructor() {
    // Default calibration offsets (in dBm) for readers RX-01 to RX-12
    for (let i = 1; i <= 12; i++) {
      const rid = `RX-${i.toString().padStart(2, '0')}`;
      this.readerCalibrationOffsets.set(rid, 0.0);
    }
  }

  public setReaderCalibration(readerId: string, offsetDb: number): void {
    this.readerCalibrationOffsets.set(readerId, offsetDb);
  }

  public getReaderCalibration(readerId: string): number {
    return this.readerCalibrationOffsets.get(readerId) || 0.0;
  }

  public getAllReaderCalibrations(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [k, v] of this.readerCalibrationOffsets.entries()) {
      result[k] = v;
    }
    return result;
  }

  public processReading(
    tagId: string,
    rawRssi: number,
    detectedZoneId: string,
    readerId: string,
    nowMs: number = Date.now()
  ): {
    smoothedRssi: number;
    resolvedZoneId: string;
    isZoneChanged: boolean;
    isDuplicate: boolean;
  } {
    const offset = this.readerCalibrationOffsets.get(readerId) || 0.0;
    const calibratedRssi = rawRssi + offset;

    let state = this.tagStates.get(tagId);

    if (!state) {
      state = {
        kalman: new RssiKalmanFilter(0.05, 3.5, calibratedRssi),
        recentRssi: [calibratedRssi],
        currentZoneId: detectedZoneId,
        candidateZoneId: undefined,
        candidateCount: 0,
        lastSeenTime: nowMs,
      };
      this.tagStates.set(tagId, state);

      return {
        smoothedRssi: calibratedRssi,
        resolvedZoneId: detectedZoneId,
        isZoneChanged: false,
        isDuplicate: false,
      };
    }

    // Check deduplication window
    if (nowMs - state.lastSeenTime < this.dedupWindowMs) {
      return {
        smoothedRssi: state.kalman.getEstimate(),
        resolvedZoneId: state.currentZoneId,
        isZoneChanged: false,
        isDuplicate: true,
      };
    }

    state.lastSeenTime = nowMs;

    // Run Kalman smoothing
    const smoothedRssi = state.kalman.update(calibratedRssi);
    state.recentRssi.push(smoothedRssi);
    if (state.recentRssi.length > 5) state.recentRssi.shift();

    // Hysteresis & zone flipping logic
    let isZoneChanged = false;

    if (detectedZoneId === state.currentZoneId) {
      state.candidateZoneId = undefined;
      state.candidateCount = 0;
    } else {
      // Different zone proposed
      if (state.candidateZoneId === detectedZoneId) {
        state.candidateCount++;
      } else {
        state.candidateZoneId = detectedZoneId;
        state.candidateCount = 1;
      }

      // Check if threshold and consecutive reads met
      if (state.candidateCount >= this.requiredConsecutiveReads) {
        state.currentZoneId = detectedZoneId;
        state.candidateZoneId = undefined;
        state.candidateCount = 0;
        isZoneChanged = true;
      }
    }

    return {
      smoothedRssi,
      resolvedZoneId: state.currentZoneId,
      isZoneChanged,
      isDuplicate: false,
    };
  }

  public getTagState(tagId: string): TagFilterState | undefined {
    return this.tagStates.get(tagId);
  }
}

export const signalProcessor = new ShopFloorSignalProcessor();
