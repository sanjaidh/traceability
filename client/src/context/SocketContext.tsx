import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

interface TwinState {
  timestamp: string;
  machines: any[];
  pouches: any[];
  bottlenecks: any[];
  kpis: {
    totalActivePouches: number;
    inMachining: number;
    waitingInspection: number;
    inRacks: number;
    inPacking: number;
    inDispatch: number;
    runningMachines: number;
    idleMachines: number;
    alarmMachines: number;
    openAlerts: number;
  };
}

interface SocketContextType {
  connected: boolean;
  twinState: TwinState | null;
  lastEvent: any;
  triggerBuzzer: (pouchCode: string) => void;
  playLocalBuzzerTone: () => void;
}

const SocketContext = createContext<SocketContextType>({
  connected: false,
  twinState: null,
  lastEvent: null,
  triggerBuzzer: () => {},
  playLocalBuzzerTone: () => {},
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [twinState, setTwinState] = useState<TwinState | null>(null);
  const [lastEvent, setLastEvent] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Synthesize realistic BLE Tag LED/Buzzer sound via Web Audio API
  const playLocalBuzzerTone = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz high pitch
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime + 0.15); // chirp up
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn('Web Audio not allowed without prior user interaction');
    }
  };

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    let reconnectTimer: any;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'INITIAL_STATE' || data.type === 'TWIN_TICK') {
            setTwinState(data.payload);
          } else if (data.type === 'BUZZER_ACTIVATED') {
            playLocalBuzzerTone();
            setLastEvent(data);
          } else {
            setLastEvent(data);
          }
        } catch (err) {
          // ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    // Fallback polling for initial state if WS connects slowly
    fetch('/api/digital-twin/live')
      .then((res) => res.json())
      .then((data) => setTwinState(data))
      .catch(() => {});

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  const triggerBuzzer = (pouchCode: string) => {
    playLocalBuzzerTone();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'TRIGGER_BUZZER', pouchCode }));
    }
  };

  return (
    <SocketContext.Provider value={{ connected, twinState, lastEvent, triggerBuzzer, playLocalBuzzerTone }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
