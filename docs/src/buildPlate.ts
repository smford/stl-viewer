import * as THREE from 'three';

export interface PrinterPreset {
  id: string;
  name: string;
  width: number;  // X in mm
  depth: number;  // Z in mm
  height: number; // Y in mm
}

export const PRINTER_PRESETS: PrinterPreset[] = [
  { id: 'bambu-x1', name: 'Bambu Lab X1 / P1 (256×256×256)', width: 256, depth: 256, height: 256 },
  { id: 'prusa-mk4', name: 'Prusa MK3 / MK4 (250×210×220)', width: 250, depth: 210, height: 220 },
  { id: 'ender-3', name: 'Creality Ender 3 (220×220×250)', width: 220, depth: 220, height: 250 },
  { id: 'voron-350', name: 'Voron 2.4 (350×350×350)', width: 350, depth: 350, height: 350 },
  { id: 'mars-4', name: 'Elegoo Mars 4 (153×77×175)', width: 153, depth: 77, height: 175 },
];

export interface FitResult {
  fits: boolean;
  exceedsX: boolean;
  exceedsY: boolean;
  exceedsZ: boolean;
}

export class BuildPlateManager {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private currentPreset: PrinterPreset | null = null;
  private plateMesh: THREE.Mesh | null = null;
  private cageHelper: THREE.LineSegments | null = null;
  private gridHelper: THREE.GridHelper | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'build-plate-group';
    this.scene.add(this.group);
  }

  public setPreset(presetId: string | null) {
    this.clear();
    if (!presetId) {
      this.currentPreset = null;
      return;
    }

    const preset = PRINTER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    this.currentPreset = preset;
    const { width, depth, height } = preset;

    // 1. Build Plate Bed Surface (Spring Steel Sheet styling)
    const plateGeo = new THREE.PlaneGeometry(width, depth);
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    this.plateMesh = new THREE.Mesh(plateGeo, plateMat);
    this.plateMesh.rotation.x = -Math.PI / 2;
    this.plateMesh.position.y = -0.05;
    this.plateMesh.receiveShadow = true;
    this.group.add(this.plateMesh);

    // 2. Bed Grid Overlay
    const maxDim = Math.max(width, depth);
    this.gridHelper = new THREE.GridHelper(maxDim, Math.round(maxDim / 10), 0x38bdf8, 0x334155);
    (this.gridHelper.material as THREE.Material).transparent = true;
    (this.gridHelper.material as THREE.Material).opacity = 0.35;
    this.gridHelper.position.y = 0.01;
    this.group.add(this.gridHelper);

    // 3. 3D Printable Volume Wireframe Box
    const boxGeo = new THREE.BoxGeometry(width, height, depth);
    const wireGeo = new THREE.WireframeGeometry(boxGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.45,
    });
    this.cageHelper = new THREE.LineSegments(wireGeo, wireMat);
    this.cageHelper.position.y = height / 2;
    this.group.add(this.cageHelper);
  }

  public checkFit(box: THREE.Box3 | null): FitResult {
    if (!this.currentPreset || !box) {
      return { fits: true, exceedsX: false, exceedsY: false, exceedsZ: false };
    }

    const size = new THREE.Vector3();
    box.getSize(size);

    const exceedsX = size.x > this.currentPreset.width;
    const exceedsY = size.y > this.currentPreset.height;
    const exceedsZ = size.z > this.currentPreset.depth;
    const fits = !exceedsX && !exceedsY && !exceedsZ;

    // Update cage color based on fit
    if (this.cageHelper) {
      const mat = this.cageHelper.material as THREE.LineBasicMaterial;
      mat.color.setHex(fits ? 0x06b6d4 : 0xef4444);
      mat.opacity = fits ? 0.45 : 0.8;
    }

    return { fits, exceedsX, exceedsY, exceedsZ };
  }

  public getCurrentPreset(): PrinterPreset | null {
    return this.currentPreset;
  }

  public clear() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }
    this.plateMesh = null;
    this.cageHelper = null;
    this.gridHelper = null;
  }

  public destroy() {
    this.clear();
    this.scene.remove(this.group);
  }
}
