import * as THREE from 'three';
import type { CameraView } from './types.ts';

export class OrientationGizmo {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private mainCamera: THREE.Camera;
  private onViewSelect: (view: CameraView) => void;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private interactiveNodes: { mesh: THREE.Mesh; view: CameraView; color: THREE.Color }[] = [];

  constructor(
    container: HTMLElement,
    mainCamera: THREE.Camera,
    onViewSelect: (view: CameraView) => void
  ) {
    this.mainCamera = mainCamera;
    this.onViewSelect = onViewSelect;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'gizmo-canvas';
    this.canvas.width = 90;
    this.canvas.height = 90;
    container.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(90, 90);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    const size = 65;
    this.camera = new THREE.OrthographicCamera(-size, size, size, -size, 0.1, 500);
    this.camera.position.set(0, 0, 150);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.buildGizmo();

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  public setMainCamera(camera: THREE.Camera) {
    this.mainCamera = camera;
  }

  private buildGizmo() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(50, 50, 50);
    this.scene.add(dirLight);

    const axisLength = 32;
    const nodeRadius = 6.5;

    // Helper to create axis cylinder line
    const createAxisLine = (dir: THREE.Vector3, colorHex: number) => {
      const geom = new THREE.CylinderGeometry(1.2, 1.2, axisLength, 8);
      geom.translate(0, axisLength / 2, 0);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const mesh = new THREE.Mesh(geom, mat);
      
      const up = new THREE.Vector3(0, 1, 0);
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
      mesh.setRotationFromQuaternion(quat);
      this.scene.add(mesh);
    };

    // Helper to create clickable axis terminal sphere
    const createAxisNode = (pos: THREE.Vector3, colorHex: number, view: CameraView, text: string) => {
      const sphereGeo = new THREE.SphereGeometry(nodeRadius, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.3,
        metalness: 0.2,
      });
      const nodeMesh = new THREE.Mesh(sphereGeo, sphereMat);
      nodeMesh.position.copy(pos);
      this.scene.add(nodeMesh);

      // Create text canvas sprite
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 34);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(10, 10, 1);
      nodeMesh.add(sprite);

      this.interactiveNodes.push({
        mesh: nodeMesh,
        view,
        color: new THREE.Color(colorHex),
      });
    };

    // Center subtle sphere
    const centerMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const centerMesh = new THREE.Mesh(new THREE.SphereGeometry(3.5, 16, 16), centerMat);
    this.scene.add(centerMesh);

    // X Axis - Red (Right / Left)
    createAxisLine(new THREE.Vector3(1, 0, 0), 0xef4444);
    createAxisNode(new THREE.Vector3(axisLength, 0, 0), 0xef4444, 'right', 'X');

    // Y Axis - Green (Top / Bottom)
    createAxisLine(new THREE.Vector3(0, 1, 0), 0x10b981);
    createAxisNode(new THREE.Vector3(0, axisLength, 0), 0x10b981, 'top', 'Y');

    // Z Axis - Blue (Front / Back)
    createAxisLine(new THREE.Vector3(0, 0, 1), 0x3b82f6);
    createAxisNode(new THREE.Vector3(0, 0, axisLength), 0x3b82f6, 'front', 'Z');

    // Negative opposite nodes (subtle gray)
    createAxisNode(new THREE.Vector3(-axisLength, 0, 0), 0x64748b, 'left', '-X');
    createAxisNode(new THREE.Vector3(0, -axisLength, 0), 0x64748b, 'bottom', '-Y');
    createAxisNode(new THREE.Vector3(0, 0, -axisLength), 0x64748b, 'back', '-Z');
  }

  private onPointerDown = (event: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = this.interactiveNodes.map((n) => n.mesh);
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const target = this.interactiveNodes.find((n) => n.mesh === hit);
      if (target) {
        this.onViewSelect(target.view);
      }
    }
  };

  public update(targetCenter?: THREE.Vector3) {
    // Synchronize rotation with main camera relative to orbit target
    const center = targetCenter || new THREE.Vector3(0, 0, 0);
    this.camera.position
      .copy(this.mainCamera.position)
      .sub(center)
      .normalize()
      .multiplyScalar(150);
    this.camera.up.copy(this.mainCamera.up);
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  public destroy() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.dispose();
  }
}
