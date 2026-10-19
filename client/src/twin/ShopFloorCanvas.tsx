import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  Layers, 
  Compass, 
  Radio, 
  Square, 
  Triangle, 
  Crosshair, 
  SlidersHorizontal 
} from 'lucide-react';

interface Machine {
  machine_id: string;
  machine_name: string;
  zone_id: string;
  machine_type: string;
  coord_x: number;
  coord_y: number;
  current_state: string;
  current_work_order_id?: string;
  spindle_load_pct?: number;
  cycle_duration_sec?: number;
}

interface Pouch {
  pouch_code: string;
  tag_code?: string;
  work_order_no?: string;
  current_zone_id?: string;
  coord_x?: number;
  coord_y?: number;
  confidence_pct?: number;
}

interface ShopFloorCanvasProps {
  machines: Machine[];
  pouches: Pouch[];
  selectedPouchCode?: string;
  onSelectMachine: (machineId: string) => void;
  onSelectPouch: (pouchCode: string) => void;
  activeHeatLayer?: 'NONE' | 'WIP_DENSITY' | 'UTILIZATION';
}

export const ShopFloorCanvas: React.FC<ShopFloorCanvasProps> = ({
  machines,
  pouches,
  selectedPouchCode,
  onSelectMachine,
  onSelectPouch,
  activeHeatLayer = 'NONE',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport transforms (Zoom & Pan)
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredEntity, setHoveredEntity] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Layer Visibility Toggles (Legend/Layers docked panel)
  const [showMachines, setShowMachines] = useState(true);
  const [showPouches, setShowPouches] = useState(true);
  const [showReaders, setShowReaders] = useState(true);
  const [showCoverage, setShowCoverage] = useState(false); // Off by default per spec
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showTrails, setShowTrails] = useState(true);
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [isWallDisplay, setIsWallDisplay] = useState(false);

  // Shop-5 physical dimensions (meters)
  const plantWidthMeters = 118.1;
  const plantHeightMeters = 60.5;

  // 10 Zones layout (Authentic Shop-5 geometry)
  const zones = useMemo(() => [
    { id: 'ZN-RAW', name: 'Raw Material Store', x: 0, y: 0, w: 24, h: 20, code: 'STORE' },
    { id: 'ZN-CUT', name: 'Cutting Section', x: 24, y: 0, w: 24, h: 20, code: 'SAW' },
    { id: 'ZN-RACK', name: 'WIP Storage (36 Racks)', x: 48, y: 0, w: 36, h: 20, code: 'RACKS' },
    { id: 'ZN-INSP-INT', name: 'First-Piece Inspection', x: 84, y: 0, w: 34.1, h: 20, code: 'QC-1' },
    { id: 'ZN-VMC-A', name: 'VMC Zone A (30 CNCs)', x: 0, y: 20, w: 40, h: 24, code: 'VMC-A' },
    { id: 'ZN-VMC-B', name: 'VMC Zone B (30 CNCs)', x: 40, y: 20, w: 40, h: 24, code: 'VMC-B' },
    { id: 'ZN-VMC-C', name: 'VMC Zone C (30 CNCs)', x: 80, y: 20, w: 22, h: 24, code: 'VMC-C' },
    { id: 'ZN-QUAL', name: 'CMM & Quality Room', x: 102, y: 20, w: 16.1, h: 24, code: 'CMM' },
    { id: 'ZN-WEDM', name: 'Wire EDM Zone (21 CNCs)', x: 0, y: 44, w: 48, h: 16.5, code: 'WEDM' },
    { id: 'ZN-PACK', name: 'Machine Packing', x: 48, y: 44, w: 40, h: 16.5, code: 'PACK' },
    { id: 'ZN-DISP', name: 'Dispatch Bay (Trucks)', x: 88, y: 44, w: 30.1, h: 16.5, code: 'DISP' },
  ], []);

  // 12 Hardware BLE/RFID Gateway Receivers
  const readers = useMemo(() => [
    { id: 'RX-01', x: 12, y: 10, label: 'RX-01 Raw Store', radius: 18 },
    { id: 'RX-02', x: 36, y: 10, label: 'RX-02 Cutting', radius: 18 },
    { id: 'RX-03', x: 66, y: 10, label: 'RX-03 WIP Racks', radius: 20 },
    { id: 'RX-04', x: 101, y: 10, label: 'RX-04 In-Process QC', radius: 20 },
    { id: 'RX-05', x: 4, y: 32, label: 'RX-05 West Perimeter', radius: 20 },
    { id: 'RX-06', x: 110, y: 32, label: 'RX-06 CMM Quality', radius: 16 },
    { id: 'RX-07', x: 20, y: 32, label: 'RX-07 VMC Zone A', radius: 22 },
    { id: 'RX-08', x: 60, y: 32, label: 'RX-08 VMC Zone B', radius: 22 },
    { id: 'RX-09', x: 91, y: 32, label: 'RX-09 VMC Zone C', radius: 20 },
    { id: 'RX-10', x: 24, y: 52, label: 'RX-10 WEDM Zone', radius: 22 },
    { id: 'RX-11', x: 68, y: 52, label: 'RX-11 Packing', radius: 22 },
    { id: 'RX-12', x: 103, y: 52, label: 'RX-12 Dispatch Bay', radius: 20 },
  ], []);

  // Selected Pouch data
  const selectedPouch = useMemo(() => {
    return pouches.find(p => p.pouch_code === selectedPouchCode);
  }, [pouches, selectedPouchCode]);

  // Handle Resize and Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Base scale preserving 118.1m : 60.5m aspect ratio with CAD margin
      const margin = 48; // room for dimension lines
      const availWidth = width - margin * 2;
      const availHeight = height - margin * 2;
      const baseScale = Math.min(availWidth / plantWidthMeters, availHeight / plantHeightMeters);

      const effectiveScale = baseScale * zoom;
      const plantPixelW = plantWidthMeters * effectiveScale;
      const plantPixelH = plantHeightMeters * effectiveScale;

      // Center plant on screen + user pan
      const originX = (width - plantPixelW) / 2 + pan.x;
      const originY = (height - plantPixelH) / 2 + pan.y;

      // Background canvas fill
      ctx.fillStyle = 'var(--map-bg, #111317)';
      ctx.fillRect(0, 0, width, height);

      // -------------------------------------------------------------
      // 1. CAD DIMENSION LINES (118.10 m and 60.50 m)
      // -------------------------------------------------------------
      const dimColor = 'var(--map-dimension, #4A505A)';
      ctx.strokeStyle = dimColor;
      ctx.fillStyle = dimColor;
      ctx.lineWidth = 1;

      // Horizontal Top Dimension Line (118.10 m)
      const dimY = originY - 18;
      ctx.beginPath();
      // Left extension
      ctx.moveTo(originX, originY - 4);
      ctx.lineTo(originX, dimY - 4);
      // Right extension
      ctx.moveTo(originX + plantPixelW, originY - 4);
      ctx.lineTo(originX + plantPixelW, dimY - 4);
      // Main dimension line
      ctx.moveTo(originX, dimY);
      ctx.lineTo(originX + plantPixelW, dimY);
      ctx.stroke();

      // Dimension Arrowheads
      ctx.beginPath();
      ctx.moveTo(originX, dimY);
      ctx.lineTo(originX + 6, dimY - 3);
      ctx.lineTo(originX + 6, dimY + 3);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(originX + plantPixelW, dimY);
      ctx.lineTo(originX + plantPixelW - 6, dimY - 3);
      ctx.lineTo(originX + plantPixelW - 6, dimY + 3);
      ctx.fill();

      // Top Dimension Text
      ctx.font = '500 11px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('118.10 m (OVERALL LENGTH)', originX + plantPixelW / 2, dimY - 3);

      // Vertical Left Dimension Line (60.50 m)
      const dimX = originX - 22;
      ctx.beginPath();
      // Top extension
      ctx.moveTo(originX - 4, originY);
      ctx.lineTo(dimX - 4, originY);
      // Bottom extension
      ctx.moveTo(originX - 4, originY + plantPixelH);
      ctx.lineTo(dimX - 4, originY + plantPixelH);
      // Main dimension line
      ctx.moveTo(dimX, originY);
      ctx.lineTo(dimX, originY + plantPixelH);
      ctx.stroke();

      // Arrowheads
      ctx.beginPath();
      ctx.moveTo(dimX, originY);
      ctx.lineTo(dimX - 3, originY + 6);
      ctx.lineTo(dimX + 3, originY + 6);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(dimX, originY + plantPixelH);
      ctx.lineTo(dimX - 3, originY + plantPixelH - 6);
      ctx.lineTo(dimX + 3, originY + plantPixelH - 6);
      ctx.fill();

      // Left Dimension Text (Rotated)
      ctx.save();
      ctx.translate(dimX - 4, originY + plantPixelH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('60.50 m (WIDTH)', 0, 0);
      ctx.restore();

      // -------------------------------------------------------------
      // 2. SHOP-5 OUTER WALL & GRID
      // -------------------------------------------------------------
      ctx.strokeStyle = '#2A2E35';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(originX, originY, plantPixelW, plantPixelH);

      // Coordinate converter helper
      const toScreenX = (mX: number) => originX + mX * effectiveScale;
      const toScreenY = (mY: number) => originY + mY * effectiveScale;

      // -------------------------------------------------------------
      // 3. ZONES & SUBTLE ENGINEERING TINTS
      // -------------------------------------------------------------
      zones.forEach(z => {
        const zx = toScreenX(z.x);
        const zy = toScreenY(z.y);
        const zw = z.w * effectiveScale;
        const zh = z.h * effectiveScale;

        // Subtle zone tint (max 4% opacity)
        ctx.fillStyle = 'var(--map-zone-tint, rgba(255, 255, 255, 0.03))';
        ctx.fillRect(zx, zy, zw, zh);

        // Thin 1px dashed zone boundary
        ctx.strokeStyle = '#2A2E35';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(zx, zy, zw, zh);
        ctx.setLineDash([]);

        // Typographic Hierarchy: Top-Left Anchor
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = '600 12px IBM Plex Sans, sans-serif';
        ctx.fillStyle = '#E7E9EC';
        ctx.fillText(z.name, zx + 8, zy + 6);

        // Zone Code & Machine Count
        const zoneMachines = machines.filter(m => m.zone_id === z.id);
        const runningInZone = zoneMachines.filter(m => m.current_state === 'RUNNING').length;

        ctx.font = '400 11px IBM Plex Mono, monospace';
        ctx.fillStyle = '#9AA0A8';
        if (zoneMachines.length > 0) {
          ctx.fillText(`${zoneMachines.length} CNCs • ${runningInZone} running`, zx + 8, zy + 22);
        } else {
          ctx.fillText(`Area: ${(z.w * z.h).toFixed(0)} m²`, zx + 8, zy + 22);
        }
      });

      // -------------------------------------------------------------
      // 4. MAIN CENTRAL AISLES (GANGWAYS)
      // -------------------------------------------------------------
      ctx.strokeStyle = '#22262C';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      // East-West Central Gangway
      ctx.beginPath();
      ctx.moveTo(originX, toScreenY(20));
      ctx.lineTo(originX + plantPixelW, toScreenY(20));
      ctx.moveTo(originX, toScreenY(44));
      ctx.lineTo(originX + plantPixelW, toScreenY(44));
      ctx.stroke();
      ctx.setLineDash([]);

      // -------------------------------------------------------------
      // 5. HARDWARE READERS (RX-01..12) & COVERAGE (DASHED, NO GLOW)
      // -------------------------------------------------------------
      if (showReaders) {
        readers.forEach(r => {
          const rx = toScreenX(r.x);
          const ry = toScreenY(r.y);

          // Coverage circle: thin dashed 1px outline (Off by default per spec)
          if (showCoverage) {
            ctx.beginPath();
            ctx.arc(rx, ry, r.radius * effectiveScale, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(76, 141, 214, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Gateway Icon: Small circle with antenna dot
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#4C8DD6';
          ctx.fill();
          ctx.strokeStyle = '#14161A';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Gateway label
          ctx.font = '500 10px IBM Plex Mono, monospace';
          ctx.fillStyle = '#9AA0A8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(r.id, rx, ry + 5);
        });
      }

      // -------------------------------------------------------------
      // 6. CNC MACHINES (~111 Machines: Shape + Color Glyphs)
      // -------------------------------------------------------------
      if (showMachines) {
        machines.forEach(m => {
          const mx = toScreenX(m.coord_x);
          const my = toScreenY(m.coord_y);

          const state = (m.current_state || 'OFFLINE').toUpperCase();
          const glyphSize = zoom >= 1.8 ? 12 : 8;

          // Color & Shape per token set
          ctx.save();
          if (state === 'RUNNING') {
            ctx.fillStyle = '#3FA37A';
            ctx.fillRect(mx - glyphSize / 2, my - glyphSize / 2, glyphSize, glyphSize);
          } else if (state === 'IDLE') {
            ctx.strokeStyle = '#8A9099';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(mx - glyphSize / 2, my - glyphSize / 2, glyphSize, glyphSize);
          } else if (state === 'SETUP') {
            ctx.fillStyle = '#4C8DD6';
            ctx.beginPath();
            ctx.moveTo(mx, my - glyphSize / 2);
            ctx.lineTo(mx + glyphSize / 2, my);
            ctx.lineTo(mx, my + glyphSize / 2);
            ctx.lineTo(mx - glyphSize / 2, my);
            ctx.closePath();
            ctx.fill();
          } else if (state === 'ALARM' || state === 'BREAKDOWN') {
            ctx.fillStyle = '#D9473F';
            ctx.beginPath();
            ctx.moveTo(mx, my - glyphSize / 2);
            ctx.lineTo(mx + glyphSize / 2, my + glyphSize / 2);
            ctx.lineTo(mx - glyphSize / 2, my + glyphSize / 2);
            ctx.closePath();
            ctx.fill();
          } else if (state === 'WAITING' || state === 'STARVED') {
            ctx.strokeStyle = '#E08A2E';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(mx - glyphSize / 2, my - glyphSize / 2, glyphSize, glyphSize);
            ctx.fillStyle = '#E08A2E';
            ctx.beginPath();
            ctx.moveTo(mx - glyphSize / 2, my - glyphSize / 2);
            ctx.lineTo(mx + glyphSize / 2, my + glyphSize / 2);
            ctx.lineTo(mx - glyphSize / 2, my + glyphSize / 2);
            ctx.closePath();
            ctx.fill();
          } else {
            // Offline cross
            ctx.strokeStyle = '#5A5F66';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(mx - glyphSize / 2, my - glyphSize / 2);
            ctx.lineTo(mx + glyphSize / 2, my + glyphSize / 2);
            ctx.moveTo(mx + glyphSize / 2, my - glyphSize / 2);
            ctx.lineTo(mx - glyphSize / 2, my + glyphSize / 2);
            ctx.stroke();
          }
          ctx.restore();

          // Show Machine ID only when zoomed in past threshold (spec requirement)
          if (zoom >= 1.8) {
            ctx.font = '500 9px IBM Plex Mono, monospace';
            ctx.fillStyle = '#9AA0A8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(m.machine_id, mx, my + glyphSize / 2 + 3);
          }
        });
      }

      // -------------------------------------------------------------
      // 7. POUCHES & SELECTED POUCH CROSSHAIR
      // -------------------------------------------------------------
      if (showPouches) {
        pouches.forEach(p => {
          if (!p.coord_x || !p.coord_y) return;
          const px = toScreenX(p.coord_x);
          const py = toScreenY(p.coord_y);

          const isSelected = p.pouch_code === selectedPouchCode;

          if (isSelected) {
            // Signal Amber Crosshair Marker
            ctx.strokeStyle = '#F2A900';
            ctx.lineWidth = 1.5;

            // Reticle circle
            ctx.beginPath();
            ctx.arc(px, py, 9, 0, Math.PI * 2);
            ctx.stroke();

            // Crosshair lines
            ctx.beginPath();
            ctx.moveTo(px - 14, py);
            ctx.lineTo(px + 14, py);
            ctx.moveTo(px, py - 14);
            ctx.lineTo(px, py + 14);
            ctx.stroke();

            // Dash Trail back to Store
            if (showTrails) {
              ctx.beginPath();
              ctx.setLineDash([3, 3]);
              ctx.strokeStyle = 'rgba(242, 169, 0, 0.4)';
              ctx.moveTo(toScreenX(12), toScreenY(10));
              ctx.lineTo(px, py);
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // Compact Callout Box
            const calloutText = `${p.pouch_code} • ${p.work_order_no || 'WO-100458'}`;
            ctx.font = '600 11px IBM Plex Mono, monospace';
            const textWidth = ctx.measureText(calloutText).width;

            ctx.fillStyle = '#1B1E23';
            ctx.fillRect(px + 12, py - 24, textWidth + 12, 20);
            ctx.strokeStyle = '#F2A900';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 12, py - 24, textWidth + 12, 20);

            ctx.fillStyle = '#F2A900';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(calloutText, px + 18, py - 14);
          } else {
            // Normal Pouch Dot: Small 2px clean white/graphite dot
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = '#E7E9EC';
            ctx.fill();
          }
        });
      }

      // -------------------------------------------------------------
      // 8. SCALE BAR & NORTH ARROW
      // -------------------------------------------------------------
      // Scale Bar (0m to 15m)
      const scaleBarMeters = 15;
      const scaleBarPixels = scaleBarMeters * effectiveScale;
      const scaleX = originX + 16;
      const scaleY = originY + plantPixelH - 16;

      ctx.strokeStyle = '#9AA0A8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(scaleX, scaleY);
      ctx.lineTo(scaleX + scaleBarPixels, scaleY);
      // Ticks
      ctx.moveTo(scaleX, scaleY - 4);
      ctx.lineTo(scaleX, scaleY + 4);
      ctx.moveTo(scaleX + scaleBarPixels / 2, scaleY - 3);
      ctx.lineTo(scaleX + scaleBarPixels / 2, scaleY + 3);
      ctx.moveTo(scaleX + scaleBarPixels, scaleY - 4);
      ctx.lineTo(scaleX + scaleBarPixels, scaleY + 4);
      ctx.stroke();

      ctx.font = '500 10px IBM Plex Mono, monospace';
      ctx.fillStyle = '#9AA0A8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('15 m', scaleX + scaleBarPixels / 2, scaleY - 4);

      // North Marker (Top-right)
      const northX = originX + plantPixelW - 24;
      const northY = originY + 24;
      ctx.beginPath();
      ctx.arc(northX, northY, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#4A505A';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(northX, northY - 9);
      ctx.lineTo(northX - 4, northY + 6);
      ctx.lineTo(northX, northY + 3);
      ctx.lineTo(northX + 4, northY + 6);
      ctx.closePath();
      ctx.fillStyle = '#E7E9EC';
      ctx.fill();

      ctx.font = 'bold 9px IBM Plex Sans, sans-serif';
      ctx.fillStyle = '#9AA0A8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('N', northX, northY + 14);

      ctx.restore();
    };

    render();
  }, [
    machines, 
    pouches, 
    selectedPouchCode, 
    zoom, 
    pan, 
    showMachines, 
    showPouches, 
    showReaders, 
    showCoverage, 
    showHeatmap, 
    showTrails, 
    zones, 
    readers
  ]);

  // Mouse Interaction: Pan, Zoom, Hover & Click Inspection
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    if (isPanning) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      return;
    }

    // Check hit test for hover tooltip (Machines)
    const dpr = window.devicePixelRatio || 1;
    const margin = 48;
    const availWidth = rect.width - margin * 2;
    const availHeight = rect.height - margin * 2;
    const baseScale = Math.min(availWidth / plantWidthMeters, availHeight / plantHeightMeters);
    const effectiveScale = baseScale * zoom;
    const plantPixelW = plantWidthMeters * effectiveScale;
    const plantPixelH = plantHeightMeters * effectiveScale;
    const originX = (rect.width - plantPixelW) / 2 + pan.x;
    const originY = (rect.height - plantPixelH) / 2 + pan.y;

    const hitDist = 12;
    let hit: any = null;

    for (const m of machines) {
      const mx = originX + m.coord_x * effectiveScale;
      const my = originY + m.coord_y * effectiveScale;
      const dist = Math.hypot(mx - mouseX, my - mouseY);
      if (dist < hitDist) {
        hit = { type: 'MACHINE', data: m };
        break;
      }
    }

    if (!hit) {
      for (const p of pouches) {
        if (!p.coord_x || !p.coord_y) continue;
        const px = originX + p.coord_x * effectiveScale;
        const py = originY + p.coord_y * effectiveScale;
        const dist = Math.hypot(px - mouseX, py - mouseY);
        if (dist < hitDist) {
          hit = { type: 'POUCH', data: p };
          break;
        }
      }
    }

    setHoveredEntity(hit);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleClick = () => {
    if (hoveredEntity) {
      if (hoveredEntity.type === 'MACHINE') {
        onSelectMachine(hoveredEntity.data.machine_id);
      } else if (hoveredEntity.type === 'POUCH') {
        onSelectPouch(hoveredEntity.data.pouch_code);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom(z => Math.max(0.6, Math.min(5.0, z * factor)));
  };

  const handleFitScreen = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-[#111317] ${
        isWallDisplay ? 'fixed inset-0 z-50 p-6' : ''
      }`}
      style={{ backgroundColor: 'var(--map-bg)' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block cursor-crosshair"
      />

      {/* Docked Layers & Legend Panel (Left Edge per spec) */}
      <div 
        className="absolute top-3 left-3 bg-[#1B1E23] border border-[#2A2E35] rounded-sm p-2 z-20 shadow-none text-xs"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)' }}
      >
        <button
          type="button"
          onClick={() => setShowLayersMenu(!showLayersMenu)}
          className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider text-[#9AA0A8] hover:text-[#E7E9EC]"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Layers & Legend</span>
        </button>

        {showLayersMenu && (
          <div className="mt-2.5 pt-2 border-t border-[#2A2E35] flex flex-col gap-1.5 text-xs">
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#E7E9EC]">
              <input 
                type="checkbox" 
                checked={showMachines} 
                onChange={e => setShowMachines(e.target.checked)}
                className="accent-[#F2A900]"
              />
              <span>111 CNC Machines</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#E7E9EC]">
              <input 
                type="checkbox" 
                checked={showPouches} 
                onChange={e => setShowPouches(e.target.checked)}
                className="accent-[#F2A900]"
              />
              <span>2,643 Pouches</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#E7E9EC]">
              <input 
                type="checkbox" 
                checked={showReaders} 
                onChange={e => setShowReaders(e.target.checked)}
                className="accent-[#F2A900]"
              />
              <span>12 Gateways (RX-01..12)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#E7E9EC]">
              <input 
                type="checkbox" 
                checked={showCoverage} 
                onChange={e => setShowCoverage(e.target.checked)}
                className="accent-[#F2A900]"
              />
              <span>Coverage Outlines (Dashed)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-[#E7E9EC]">
              <input 
                type="checkbox" 
                checked={showTrails} 
                onChange={e => setShowTrails(e.target.checked)}
                className="accent-[#F2A900]"
              />
              <span>Pouch History Trails</span>
            </label>

            <div className="mt-2 pt-2 border-t border-[#2A2E35] flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-[#9AA0A8] uppercase tracking-wider">
                Machine Glyphs
              </span>
              <div className="flex items-center gap-2 text-[11px] text-[#9AA0A8]">
                <span className="text-[#3FA37A]">■</span> Running
                <span className="text-[#8A9099]">□</span> Idle
                <span className="text-[#4C8DD6]">◆</span> Setup
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#9AA0A8]">
                <span className="text-[#D9473F]">▲</span> Alarm
                <span className="text-[#E08A2E]">◩</span> Waiting
                <span className="text-[#5A5F66]">✕</span> Offline
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Control Buttons (Top-Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1 z-20">
        <button
          type="button"
          onClick={() => setZoom(z => Math.min(5.0, z * 1.25))}
          title="Zoom In"
          className="btn-icon"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(z => Math.max(0.6, z * 0.8))}
          title="Zoom Out"
          className="btn-icon"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleFitScreen}
          title="Fit to Screen"
          className="btn-icon"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setIsWallDisplay(!isWallDisplay)}
          title={isWallDisplay ? 'Exit Wall Display' : 'Fullscreen Wall Display Mode'}
          className="btn-icon"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Machine & Pouch Hover Tooltip */}
      {hoveredEntity && (
        <div 
          className="fixed z-40 bg-[#1B1E23] border border-[#2A2E35] rounded-sm px-2.5 py-1.5 pointer-events-none text-xs"
          style={{
            left: `${mousePos.x + 12}px`,
            top: `${mousePos.y + 12}px`,
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-color)',
          }}
        >
          {hoveredEntity.type === 'MACHINE' ? (
            <div>
              <div className="flex items-center gap-2 font-mono font-semibold text-[#E7E9EC]">
                <span>{hoveredEntity.data.machine_id}</span>
                <span className="text-[10px] text-[#9AA0A8] font-sans">
                  ({hoveredEntity.data.machine_type})
                </span>
              </div>
              <div className="text-[11px] text-[#9AA0A8] mt-0.5">
                State: <strong style={{ color: 'var(--text-primary)' }}>{hoveredEntity.data.current_state}</strong>
              </div>
              {hoveredEntity.data.current_work_order_id && (
                <div className="text-[11px] font-mono text-[#F2A900]">
                  WO: {hoveredEntity.data.current_work_order_id}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="font-mono font-semibold text-[#F2A900]">
                {hoveredEntity.data.pouch_code}
              </div>
              <div className="text-[11px] text-[#9AA0A8]">
                WO: <span className="font-mono text-[#E7E9EC]">{hoveredEntity.data.work_order_no || 'WO-100458'}</span>
              </div>
              <div className="text-[11px] text-[#9AA0A8]">
                Zone: <span className="text-[#E7E9EC]">{hoveredEntity.data.current_zone_id || 'ZN-VMC-A'}</span>
              </div>
              <div className="text-[10px] font-mono text-[#3FA37A]">
                Confidence: {hoveredEntity.data.confidence_pct || 92}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
