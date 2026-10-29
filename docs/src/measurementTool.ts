import * as THREE from 'three';

export interface MeasurementResult {
  id: string;
  pointA: THREE.Vector3;
  pointB: THREE.Vector3;
  distance: number;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
}

export class MeasurementTool {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private canvas: HTMLCanvasElement;
  private modelMesh: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  public isMeasuring = false;
  private pendingPoint: THREE.Vector3 | null = null;
  private previewMesh: THREE.Mesh;
  private group: THREE.Group;
  private measurements: MeasurementResult[] = [];

  public onMeasurementChange?: (measurements: MeasurementResult[]) => void;

  constructor(scene: THREE.Scene, camera: THREE.Camera, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.group = new THREE.Group();
    this.group.name = 'measurement-group';
    this.scene.add(this.group);

    // Hover reticle
    const reticleGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    this.previewMesh = new THREE.Mesh(reticleGeo, reticleMat);
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);

    this.bindEvents();
  }

  public setCamera(camera: THREE.Camera) {
    this.camera = camera;
  }

  public setModel(mesh: THREE.Mesh | null) {
    this.modelMesh = mesh;
    this.clear();
  }

  private bindEvents() {
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  public startMeasuring() {
    this.isMeasuring = true;
    this.pendingPoint = null;
    this.previewMesh.visible = false;
    this.canvas.style.cursor = 'crosshair';
  }

  public stopMeasuring() {
    this.isMeasuring = false;
    this.pendingPoint = null;
    this.previewMesh.visible = false;
    this.canvas.style.cursor = 'default';
  }

  public clear() {
    this.pendingPoint = null;
    this.measurements = [];
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if ((child as THREE.Mesh).geometry) {
        (child as THREE.Mesh).geometry.dispose();
      }
    }
    this.previewMesh.visible = false;
    this.onMeasurementChange?.([]);
  }

  private getIntersection(event: PointerEvent): THREE.Vector3 | null {
    if (!this.modelMesh) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.modelMesh, false);

    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.isMeasuring || !this.modelMesh) {
      this.previewMesh.visible = false;
      return;
    }

    const point = this.getIntersection(event);
    if (point) {
      this.previewMesh.position.copy(point);
      this.previewMesh.visible = true;
    } else {
      this.previewMesh.visible = false;
    }
  };

  private onPointerDown = (event: PointerEvent) => {
    // Only handle primary click
    if (!this.isMeasuring || event.button !== 0 || !this.modelMesh) return;

    const hit = this.getIntersection(event);
    if (!hit) return;

    if (!this.pendingPoint) {
      // First point selected
      this.pendingPoint = hit.clone();
      this.addPointMarker(this.pendingPoint, 0x10b981, 'A');
    } else {
      // Second point selected - complete measurement
      const pointA = this.pendingPoint.clone();
      const pointB = hit.clone();
      this.addPointMarker(pointB, 0xef4444, 'B');
      this.createMeasurementLine(pointA, pointB);

      const deltaX = Math.abs(pointB.x - pointA.x);
      const deltaY = Math.abs(pointB.y - pointA.y);
      const deltaZ = Math.abs(pointB.z - pointA.z);
      const distance = pointA.distanceTo(pointB);

      const result: MeasurementResult = {
        id: Math.random().toString(36).substring(2, 9),
        pointA,
        pointB,
        distance: Number(distance.toFixed(2)),
        deltaX: Number(deltaX.toFixed(2)),
        deltaY: Number(deltaY.toFixed(2)),
        deltaZ: Number(deltaZ.toFixed(2)),
      };

      this.measurements.push(result);
      this.pendingPoint = null;
      this.onMeasurementChange?.(this.measurements);
    }
  };

  private addPointMarker(point: THREE.Vector3, colorHex: number, label: string) {
    const geo = new THREE.SphereGeometry(1.2, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(point);
    mesh.renderOrder = 999;
    this.group.add(mesh);

    // Sprite label
    const sprite = this.createTextSprite(label, colorHex);
    sprite.position.copy(point).add(new THREE.Vector3(0, 2.5, 0));
    this.group.add(sprite);
  }

  private createMeasurementLine(pointA: THREE.Vector3, pointB: THREE.Vector3) {
    // Line geometry
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 1.5,
      gapSize: 0.8,
      depthTest: false,
      linewidth: 2,
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([pointA, pointB]);
    const line = new THREE.Line(lineGeo, lineMat);
    line.computeLineDistances();
    line.renderOrder = 998;
    this.group.add(line);

    // Midpoint label
    const mid = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
    const dist = pointA.distanceTo(pointB);
    const labelSprite = this.createTextSprite(`${dist.toFixed(2)} mm`, 0x38bdf8, true);
    labelSprite.position.copy(mid).add(new THREE.Vector3(0, 2, 0));
    this.group.add(labelSprite);
  }

  private createTextSprite(text: string, bgColor: number, isPill = false): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    if (isPill) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(16, 8, 224, 56, 28);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 36);
    } else {
      ctx.fillStyle = `#${bgColor.toString(16).padStart(6, '0')}`;
      ctx.beginPath();
      ctx.arc(128, 36, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 38);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(12, 3.4, 1);
    sprite.renderOrder = 1000;
    return sprite;
  }

  public destroy() {
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.clear();
    this.scene.remove(this.group);
    this.scene.remove(this.previewMesh);
  }
}
