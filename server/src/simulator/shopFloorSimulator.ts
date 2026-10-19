import { db } from '../db/database.js';
import { LocationResolver } from '../core/locationResolver.js';
import { AlertEngine } from '../core/alertEngine.js';

export class ShopFloorSimulator {
  private isRunning: boolean = false;
  private speedMultiplier: number = 10; // 1x to 100x
  private intervalTimer: NodeJS.Timeout | null = null;
  private tickCount: number = 0;

  constructor() {
    this.start();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Simulator] Shop-5 Floor Simulator started at ${this.speedMultiplier}x speed.`);

    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 2000); // 2-second simulation tick
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    console.log('[Simulator] Shop Floor Simulator paused.');
  }

  public setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(1, Math.min(100, multiplier));
    console.log(`[Simulator] Simulation speed adjusted to ${this.speedMultiplier}x.`);
  }

  public getStatus(): { isRunning: boolean; speed: number; ticks: number } {
    return {
      isRunning: this.isRunning,
      speed: this.speedMultiplier,
      ticks: this.tickCount,
    };
  }

  private tick(): void {
    if (!this.isRunning) return;
    this.tickCount++;

    try {
      // 1. Advance running CNC machines cycle duration
      db.prepare(`
        UPDATE machines
        SET cycle_duration_sec = cycle_duration_sec + ?
        WHERE current_state = 'RUNNING'
      `).run(2 * this.speedMultiplier);

      // Periodically vary spindle load on 10 random running machines
      const runningMachines = db.prepare("SELECT machine_id FROM machines WHERE current_state = 'RUNNING' LIMIT 15").all() as any[];
      for (const rm of runningMachines) {
        const load = 50 + Math.floor(Math.random() * 40);
        db.prepare('UPDATE machines SET spindle_load_pct = ? WHERE machine_id = ?').run(load, rm.machine_id);
      }

      // 2. Simulate 3 to 8 pouch movements / RSSI pulses across zones
      const activePouches = db.prepare(`
        SELECT p.pouch_code, t.tag_code, pc.current_zone_id, pc.current_location_id, pc.cycle_id
        FROM pouches p
        JOIN tags t ON p.tag_id = t.tag_id
        JOIN pouch_cycles pc ON p.current_cycle_id = pc.cycle_id
        WHERE pc.status = 'ACTIVE'
        ORDER BY RANDOM()
        LIMIT 6
      `).all() as any[];

      for (const p of activePouches) {
        // Gaussian noise around reader
        const baseRssi = -68.0 + (Math.random() * 6 - 3);

        // Pick reader corresponding to current zone
        const reader = db.prepare('SELECT reader_id FROM readers WHERE zone_id = ? LIMIT 1').get(p.current_zone_id) as any;
        const readerId = reader?.reader_id || 'RX-08';

        LocationResolver.resolveEvent({
          sourceType: 'BLE_RECEIVER',
          readerId,
          tagCode: p.tag_code,
          pouchCode: p.pouch_code,
          rssi: baseRssi,
          batteryMv: 3250 + Math.floor(Math.random() * 50),
          hardwareTimestamp: Date.now(),
        });
      }

      // 3. Every 15 ticks, run periodic alert scanner
      if (this.tickCount % 15 === 0) {
        AlertEngine.scanPeriodicAlerts();
      }
    } catch (err) {
      console.error('[Simulator Error]', err);
    }
  }
}

export const simulator = new ShopFloorSimulator();
