import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { DigitalTwinEngine } from '../core/digitalTwin.js';

export class SocketManager {
  private static wss: WebSocketServer | null = null;
  private static clients: Set<WebSocket> = new Set();
  private static broadcastInterval: NodeJS.Timeout | null = null;

  public static initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log(`[WebSocket] Client connected. Total active clients: ${this.clients.size}`);

      // Send initial live twin snapshot immediately on connect
      try {
        const live = DigitalTwinEngine.getLiveTwinState();
        ws.send(JSON.stringify({ type: 'INITIAL_STATE', payload: live }));
      } catch (err) {
        console.error('[WebSocket] Failed to send initial state:', err);
      }

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          } else if (parsed.type === 'TRIGGER_BUZZER') {
            // Broadcast buzzer trigger to floor visualization
            SocketManager.broadcast({
              type: 'BUZZER_ACTIVATED',
              payload: { pouchCode: parsed.pouchCode, timestamp: Date.now() },
            });
          }
        } catch (err) {
          // ignore non-json
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WebSocket] Client disconnected. Total active: ${this.clients.size}`);
      });
    });

    // Broadcast live telemetry state every 2 seconds
    this.broadcastInterval = setInterval(() => {
      if (this.clients.size > 0) {
        try {
          const live = DigitalTwinEngine.getLiveTwinState();
          this.broadcast({ type: 'TWIN_TICK', payload: live });
        } catch (err) {
          console.error('[WebSocket Broadcast Error]', err);
        }
      }
    }, 2000);
  }

  public static broadcast(data: { type: string; payload: any }): void {
    if (!this.wss || this.clients.size === 0) return;
    const msg = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }
}
