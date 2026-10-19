import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface ShopFloor3DProps {
  machines: any[];
  pouches: any[];
  onSelectMachine: (machineId: string) => void;
}

export const ShopFloor3D: React.FC<ShopFloor3DProps> = ({
  machines,
  pouches,
  onSelectMachine,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 1000;
    const height = container.clientHeight || 600;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14161A);
    scene.fog = new THREE.FogExp2(0x14161A, 0.008);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    // Isometric view perspective
    camera.position.set(60, 95, 110);
    camera.lookAt(60, 0, 30);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(60, 100, 50);
    scene.add(dirLight);

    // 3. Shop Floor Grid & Plane (118.1m x 60.5m)
    const floorGeo = new THREE.PlaneGeometry(118.1, 60.5);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1B1E23,
      roughness: 0.9,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(59.05, 0, 30.25);
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor Grid
    const gridHelper = new THREE.GridHelper(120, 30, 0x3b82f6, 0x1e293b);
    gridHelper.position.set(60, 0.05, 30);
    scene.add(gridHelper);

    // 4. Create 3D Machine Meshes
    const machineMeshes: THREE.Mesh[] = [];
    const machineGeo = new THREE.BoxGeometry(2.4, 2.2, 2.0);

    for (const m of machines) {
      let colorHex = 0x10b981; // RUNNING
      if (m.state === 'ALARM') colorHex = 0xef4444;
      else if (m.state === 'IDLE') colorHex = 0xeab308;
      else if (m.state === 'SETUP') colorHex = 0x06b6d4;
      else if (m.state === 'WAITING_MATERIAL') colorHex = 0xf97316;
      else if (m.state === 'OFFLINE') colorHex = 0x64748b;

      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.3,
        metalness: 0.6,
        emissive: colorHex,
        emissiveIntensity: m.state === 'ALARM' ? 0.6 : 0.2,
      });

      const mesh = new THREE.Mesh(machineGeo, mat);
      mesh.position.set(m.x, 1.1, m.y);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { machineId: m.machineId };

      scene.add(mesh);
      machineMeshes.push(mesh);
    }

    // 5. Create Rack Towers in WIP Storage (x: 48..84, y: 0..20)
    const rackGeo = new THREE.BoxGeometry(1.2, 4.0, 3.0);
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5, metalness: 0.5 });
    for (let r = 0; r < 12; r++) {
      const rx = 52 + (r % 6) * 5.2;
      const ry = 4 + Math.floor(r / 6) * 7.0;
      const rack = new THREE.Mesh(rackGeo, rackMat);
      rack.position.set(rx, 2.0, ry);
      rack.castShadow = true;
      scene.add(rack);
    }

    // 6. Interactive Raycasting on Click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(machineMeshes);

      if (intersects.length > 0) {
        const target = intersects[0].object;
        if (target.userData && target.userData.machineId) {
          onSelectMachine(target.userData.machineId);
        }
      }
    };

    renderer.domElement.addEventListener('click', handlePointerDown);

    // 7. Mouse Orbit Drag Control
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;

      camera.position.x -= deltaX * 0.15;
      camera.position.z -= deltaY * 0.15;
      camera.lookAt(60, 0, 30);

      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop
    let animId: number;
    let tick = 0;
    const animate = () => {
      tick++;
      animId = requestAnimationFrame(animate);

      // Pulse alarms
      const alarmMeshes = machineMeshes.filter((m) => m.userData.state === 'ALARM');
      const pulse = (Math.sin(tick * 0.1) + 1) / 2;
      for (const am of alarmMeshes) {
        (am.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + pulse * 0.7;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener('click', handlePointerDown);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [machines, pouches]);

  return (
    <div className="relative w-full h-[620px] rounded-sm overflow-hidden border border-[#2A2E35] select-none bg-[#14161A]">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute top-3 left-3 bg-[#1B1E23] px-3 py-1.5 rounded-sm border border-[#2A2E35] text-xs font-mono text-[#F2A900]">
        3D CAD/CAM Wireframe Twin (WebGL) • Drag to orbit
      </div>
    </div>
  );
};
