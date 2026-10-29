import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraView, LightingPreset, ViewerOptions } from './types.ts';
import { MeasurementTool } from './measurementTool.ts';
import { computeOverhangColors, type OverhangAnalysis } from './overhangAnalyzer.ts';
import { BuildPlateManager, type FitResult } from './buildPlate.ts';

export class STLViewer {
  public container: HTMLElement;
  public canvas: HTMLCanvasElement;
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public perspectiveCamera: THREE.PerspectiveCamera;
  public orthographicCamera: THREE.OrthographicCamera;
  public activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  public controls: OrbitControls;
  public measurementTool: MeasurementTool;
  public buildPlate: BuildPlateManager;

  // Scene elements
  private modelGroup: THREE.Group;
  private currentMesh: THREE.Mesh | null = null;
  private wireframeMesh: THREE.Mesh | null = null;
  private boundingBoxHelper: THREE.Box3Helper | null = null;
  private comMarker: THREE.Group | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private groundPlane: THREE.Mesh | null = null;

  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private dirLight1!: THREE.DirectionalLight;
  private dirLight2!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;

  // Clipping Plane
  private clipPlane: THREE.Plane;

  // State
  private options: ViewerOptions;
  private isAnimatingCamera = false;
  private animationFrameId: number | null = null;
  private modelBoundingSphere: THREE.Sphere | null = null;
  private modelBoundingBox: THREE.Box3 | null = null;
  private currentOverhangAnalysis: OverhangAnalysis | null = null;

  // Callback for stats / changes
  public onCameraChange?: () => void;

  constructor(container: HTMLElement, options: ViewerOptions) {
    this.container = container;
    this.options = { ...options };

    // Canvas setup
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stl-canvas';
    this.container.appendChild(this.canvas);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent scene, styled via CSS background

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;

    // Cameras
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 2000);
    this.perspectiveCamera.position.set(60, 60, 80);

    const frustumSize = 100;
    this.orthographicCamera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      2000
    );
    this.orthographicCamera.position.set(60, 60, 80);

    this.activeCamera = this.options.cameraType === 'orthographic' 
      ? this.orthographicCamera 
      : this.perspectiveCamera;

    // Controls
    this.controls = new OrbitControls(this.activeCamera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    this.controls.addEventListener('change', () => {
      this.onCameraChange?.();
    });

    // Model group
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    // Section Clipping plane (default normal Z, constant 0)
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    // Setup Lighting & Environment
    this.setupLights();
    this.setupGridAndGround();

    // Measurement Tool
    this.measurementTool = new MeasurementTool(this.scene, this.activeCamera, this.canvas);

    // Build Plate Manager
    this.buildPlate = new BuildPlateManager(this.scene);

    // Listen to resize
    window.addEventListener('resize', this.onResize);

    // Start render loop
    this.animate = this.animate.bind(this);
    this.animate();
  }

  private setupLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);

    // Key directional light (casts soft shadow)
    this.dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    this.dirLight1.position.set(80, 120, 80);
    this.dirLight1.castShadow = true;
    this.dirLight1.shadow.mapSize.width = 2048;
    this.dirLight1.shadow.mapSize.height = 2048;
    this.dirLight1.shadow.camera.near = 10;
    this.dirLight1.shadow.camera.far = 400;
    const d = 80;
    this.dirLight1.shadow.camera.left = -d;
    this.dirLight1.shadow.camera.right = d;
    this.dirLight1.shadow.camera.top = d;
    this.dirLight1.shadow.camera.bottom = -d;
    this.dirLight1.shadow.bias = -0.0005;
    this.scene.add(this.dirLight1);

    // Fill light
    this.dirLight2 = new THREE.DirectionalLight(0xffffff, 0.7);
    this.dirLight2.position.set(-80, 60, -60);
    this.scene.add(this.dirLight2);

    // Rim light for edge definition
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    this.rimLight.position.set(0, -60, -80);
    this.scene.add(this.rimLight);

    this.applyLightingPreset(this.options.lightingPreset);
  }

  public applyLightingPreset(preset: LightingPreset) {
    this.options.lightingPreset = preset;
    switch (preset) {
      case 'studio':
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 0.85;
        this.dirLight1.color.setHex(0xffffff);
        this.dirLight1.intensity = 1.3;
        this.dirLight2.color.setHex(0xe0e7ff);
        this.dirLight2.intensity = 0.65;
        this.rimLight.color.setHex(0x38bdf8);
        this.rimLight.intensity = 0.4;
        break;

      case 'daylight':
        this.ambientLight.color.setHex(0xffffff);
        this.ambientLight.intensity = 1.0;
        this.dirLight1.color.setHex(0xfffbeb);
        this.dirLight1.intensity = 1.5;
        this.dirLight2.color.setHex(0xbfdbfe);
        this.dirLight2.intensity = 0.8;
        this.rimLight.color.setHex(0xffffff);
        this.rimLight.intensity = 0.2;
        break;

      case 'cyber':
        this.ambientLight.color.setHex(0x1e1e38);
        this.ambientLight.intensity = 0.6;
        this.dirLight1.color.setHex(0x06b6d4);
        this.dirLight1.intensity = 1.8;
        this.dirLight2.color.setHex(0xec4899);
        this.dirLight2.intensity = 1.2;
        this.rimLight.color.setHex(0x8b5cf6);
        this.rimLight.intensity = 1.0;
        break;

      case 'warm':
        this.ambientLight.color.setHex(0x451a03);
        this.ambientLight.intensity = 0.7;
        this.dirLight1.color.setHex(0xf97316);
        this.dirLight1.intensity = 1.6;
        this.dirLight2.color.setHex(0xfde047);
        this.dirLight2.intensity = 0.8;
        this.rimLight.color.setHex(0xf43f5e);
        this.rimLight.intensity = 0.5;
        break;
    }
  }

  private setupGridAndGround() {
    // Elegant dual-color grid
    const size = 160;
    const divisions = 32;
    this.gridHelper = new THREE.GridHelper(size, divisions, 0x64748b, 0x334155);
    (this.gridHelper.material as THREE.Material).transparent = true;
    (this.gridHelper.material as THREE.Material).opacity = 0.4;
    this.gridHelper.position.y = -0.01;
    this.scene.add(this.gridHelper);

    // Ground plane with soft contact shadow receiver
    const planeGeo = new THREE.PlaneGeometry(size, size);
    const planeMat = new THREE.ShadowMaterial({
      opacity: 0.35,
    });
    this.groundPlane = new THREE.Mesh(planeGeo, planeMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -0.02;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);

    this.gridHelper.visible = this.options.showGrid;
    this.groundPlane.visible = this.options.showShadows;
  }

  public setModel(geometry: THREE.BufferGeometry) {
    // Clear old mesh
    if (this.currentMesh) {
      this.modelGroup.remove(this.currentMesh);
      this.currentMesh.geometry.dispose();
      this.currentMesh = null;
    }
    if (this.wireframeMesh) {
      this.modelGroup.remove(this.wireframeMesh);
      this.wireframeMesh.geometry.dispose();
      this.wireframeMesh = null;
    }
    if (this.boundingBoxHelper) {
      this.scene.remove(this.boundingBoxHelper);
      this.boundingBoxHelper.dispose();
      this.boundingBoxHelper = null;
    }

    // Geometry metadata
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    this.modelBoundingBox = geometry.boundingBox!.clone();
    this.modelBoundingSphere = geometry.boundingSphere!.clone();

    // Adapt grid and shadow light size to model bounds
    this.adaptEnvironmentToModel();

    // Create main mesh
    const material = this.createMaterial();
    this.currentMesh = new THREE.Mesh(geometry, material);
    this.currentMesh.castShadow = true;
    this.currentMesh.receiveShadow = true;
    this.modelGroup.add(this.currentMesh);
    this.measurementTool.setModel(this.currentMesh);

    // Create wireframe overlay mesh
    const wireMat = new THREE.MeshBasicMaterial({
      color: this.options.wireframeColor,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.wireframeMesh = new THREE.Mesh(geometry, wireMat);
    this.wireframeMesh.visible = this.options.wireframeOverlay;
    this.modelGroup.add(this.wireframeMesh);

    // Bounding box helper
    this.boundingBoxHelper = new THREE.Box3Helper(this.modelBoundingBox, new THREE.Color(0x38bdf8));
    this.boundingBoxHelper.visible = this.options.showBoundingBox;
    this.scene.add(this.boundingBoxHelper);

    // Update clipping limits
    this.updateClipping();

    // Check build plate fit
    this.buildPlate.checkFit(this.modelBoundingBox);

    // Fit camera to new model
    this.fitCameraToModel(true);
  }

  private adaptEnvironmentToModel() {
    if (!this.modelBoundingSphere) return;
    const r = Math.max(this.modelBoundingSphere.radius, 10);
    const gridDim = Math.ceil(r * 4);

    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      this.gridHelper = new THREE.GridHelper(gridDim, 32, 0x64748b, 0x334155);
      (this.gridHelper.material as THREE.Material).transparent = true;
      (this.gridHelper.material as THREE.Material).opacity = 0.35;
      this.gridHelper.position.y = -0.01;
      this.gridHelper.visible = this.options.showGrid;
      this.scene.add(this.gridHelper);
    }

    if (this.groundPlane) {
      this.groundPlane.geometry.dispose();
      this.groundPlane.geometry = new THREE.PlaneGeometry(gridDim, gridDim);
    }

    // Adjust shadow camera bounds
    const s = r * 1.8;
    this.dirLight1.position.set(s * 1.2, s * 1.8, s * 1.2);
    this.dirLight1.shadow.camera.left = -s;
    this.dirLight1.shadow.camera.right = s;
    this.dirLight1.shadow.camera.top = s;
    this.dirLight1.shadow.camera.bottom = -s;
    this.dirLight1.shadow.camera.near = r * 0.1;
    this.dirLight1.shadow.camera.far = s * 6;
    this.dirLight1.shadow.camera.updateProjectionMatrix();
  }

  private createMaterial(): THREE.Material {
    const clippingPlanes = this.options.sectionClipping.enabled ? [this.clipPlane] : [];
    const color = new THREE.Color(this.options.materialColor);

    switch (this.options.shadingMode) {
      case 'wireframe':
        return new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          clippingPlanes,
        });

      case 'flat':
        return new THREE.MeshStandardMaterial({
          color,
          flatShading: true,
          roughness: 0.6,
          metalness: 0.1,
          clippingPlanes,
          side: THREE.DoubleSide,
        });

      case 'clay':
        return new THREE.MeshLambertMaterial({
          color,
          clippingPlanes,
          side: THREE.DoubleSide,
        });

      case 'glossy':
        return new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.1,
          metalness: 0.05,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
          reflectivity: 0.9,
          clippingPlanes,
          side: THREE.DoubleSide,
        });

      case 'metal':
        return new THREE.MeshStandardMaterial({
          color,
          roughness: 0.25,
          metalness: 0.85,
          clippingPlanes,
          side: THREE.DoubleSide,
        });

      case 'xray':
        return new THREE.MeshPhysicalMaterial({
          color,
          transparent: true,
          opacity: 0.45,
          roughness: 0.2,
          transmission: 0.6,
          thickness: 1.5,
          clippingPlanes,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

      case 'normals':
        return new THREE.MeshNormalMaterial({
          clippingPlanes,
          side: THREE.DoubleSide,
        });

      case 'overhang':
        if (this.currentMesh) {
          this.applyOverhangColorsToMesh(this.currentMesh);
        }
        return new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.45,
          metalness: 0.1,
          clippingPlanes,
          side: THREE.DoubleSide,
        });

      case 'standard':
      default:
        return new THREE.MeshPhysicalMaterial({
          color,
          roughness: this.options.roughness,
          metalness: this.options.metalness,
          clearcoat: 0.3,
          clearcoatRoughness: 0.2,
          clippingPlanes,
          side: THREE.DoubleSide,
        });
    }
  }

  public applyOverhangColorsToMesh(mesh: THREE.Mesh) {
    const geometry = mesh.geometry;
    const analysis = computeOverhangColors(geometry, this.options.overhangThreshold);
    this.currentOverhangAnalysis = analysis;
    geometry.setAttribute('color', new THREE.BufferAttribute(analysis.vertexColors, 3));
    geometry.attributes.color.needsUpdate = true;
  }

  public getOverhangAnalysis(): OverhangAnalysis | null {
    if (!this.currentMesh) return null;
    if (!this.currentOverhangAnalysis) {
      this.currentOverhangAnalysis = computeOverhangColors(
        this.currentMesh.geometry,
        this.options.overhangThreshold
      );
    }
    return this.currentOverhangAnalysis;
  }

  public updateMaterial() {
    if (!this.currentMesh) return;
    const oldMat = this.currentMesh.material;
    this.currentMesh.material = this.createMaterial();
    if (Array.isArray(oldMat)) {
      oldMat.forEach((m) => m.dispose());
    } else {
      oldMat.dispose();
    }

    if (this.wireframeMesh) {
      this.wireframeMesh.visible = this.options.wireframeOverlay;
      (this.wireframeMesh.material as THREE.MeshBasicMaterial).color.set(this.options.wireframeColor);
    }
  }

  public updateClipping() {
    const { enabled, axis, planeConstant, negated } = this.options.sectionClipping;
    if (!enabled) {
      if (this.currentMesh && this.currentMesh.material) {
        (this.currentMesh.material as THREE.Material).clippingPlanes = [];
      }
      return;
    }

    const normal = new THREE.Vector3();
    if (axis === 'x') normal.set(1, 0, 0);
    else if (axis === 'y') normal.set(0, 1, 0);
    else normal.set(0, 0, 1);

    if (negated) {
      normal.negate();
      this.clipPlane.normal.copy(normal);
      this.clipPlane.constant = planeConstant;
    } else {
      this.clipPlane.normal.copy(normal);
      this.clipPlane.constant = -planeConstant;
    }

    if (this.currentMesh && this.currentMesh.material) {
      (this.currentMesh.material as THREE.Material).clippingPlanes = [this.clipPlane];
    }
  }

  public setOptions(newOptions: Partial<ViewerOptions>) {
    const prev = { ...this.options };
    this.options = { ...this.options, ...newOptions };

    if (
      newOptions.shadingMode !== undefined ||
      newOptions.overhangThreshold !== undefined ||
      newOptions.materialColor !== undefined ||
      newOptions.roughness !== undefined ||
      newOptions.metalness !== undefined ||
      newOptions.wireframeOverlay !== undefined ||
      newOptions.wireframeColor !== undefined
    ) {
      if (this.currentMesh && (this.options.shadingMode === 'overhang' || newOptions.overhangThreshold !== undefined)) {
        this.applyOverhangColorsToMesh(this.currentMesh);
      }
      this.updateMaterial();
    }

    if (newOptions.lightingPreset !== undefined && newOptions.lightingPreset !== prev.lightingPreset) {
      this.applyLightingPreset(newOptions.lightingPreset);
    }

    if (newOptions.showGrid !== undefined && this.gridHelper) {
      this.gridHelper.visible = newOptions.showGrid;
    }

    if (newOptions.showShadows !== undefined && this.groundPlane) {
      this.groundPlane.visible = newOptions.showShadows;
    }

    if (newOptions.showBoundingBox !== undefined && this.boundingBoxHelper) {
      this.boundingBoxHelper.visible = newOptions.showBoundingBox;
    }

    if (newOptions.showCenterOfMass !== undefined && !newOptions.showCenterOfMass && this.comMarker) {
      this.scene.remove(this.comMarker);
      this.comMarker = null;
    }

    if (newOptions.autoRotate !== undefined) {
      this.controls.autoRotate = newOptions.autoRotate;
    }

    if (newOptions.autoRotateSpeed !== undefined) {
      this.controls.autoRotateSpeed = newOptions.autoRotateSpeed;
    }

    if (newOptions.sectionClipping !== undefined) {
      this.updateClipping();
    }

    if (newOptions.cameraType !== undefined && newOptions.cameraType !== prev.cameraType) {
      this.switchCameraType(newOptions.cameraType);
    }
  }

  public getOptions(): ViewerOptions {
    return { ...this.options };
  }

  public updateCenterOfMassMarker(comCoords?: { x: number; y: number; z: number }) {
    if (this.comMarker) {
      this.scene.remove(this.comMarker);
      this.comMarker = null;
    }

    if (!this.options.showCenterOfMass || !comCoords) return;

    this.comMarker = new THREE.Group();
    this.comMarker.name = 'com-marker';

    const r = 2.0;
    // Central sphere
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 16, 16), sphereMat);
    sphere.renderOrder = 999;
    this.comMarker.add(sphere);

    // Gimbal crosshair rings
    const ringMat = new THREE.LineBasicMaterial({ color: 0xfacc15, depthTest: false, linewidth: 2 });
    const ringGeo = new THREE.BufferGeometry();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const theta = (i / 32) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, 0));
    }
    ringGeo.setFromPoints(pts);

    const ringZ = new THREE.Line(ringGeo, ringMat);
    ringZ.renderOrder = 999;
    const ringX = new THREE.Line(ringGeo.clone().rotateY(Math.PI / 2), ringMat);
    ringX.renderOrder = 999;
    const ringY = new THREE.Line(ringGeo.clone().rotateX(Math.PI / 2), ringMat);
    ringY.renderOrder = 999;

    this.comMarker.add(ringZ, ringX, ringY);
    this.comMarker.position.set(comCoords.x, comCoords.y, comCoords.z);
    this.scene.add(this.comMarker);
  }

  public rotateModel(axis: 'x' | 'y' | 'z', degrees: number) {
    if (!this.currentMesh) return;
    const rad = (degrees * Math.PI) / 180;
    const geom = this.currentMesh.geometry;

    if (axis === 'x') geom.rotateX(rad);
    else if (axis === 'y') geom.rotateY(rad);
    else if (axis === 'z') geom.rotateZ(rad);

    geom.computeVertexNormals();
    this.regroundGeometry(geom);
  }

  public autoOrientModel() {
    if (!this.currentMesh) return;
    const geom = this.currentMesh.geometry;

    // Test 6 canonical rotations to minimize bounding height (fastest print) and maximize base footprint
    const candidateRotations = [
      { x: 0, z: 0 },
      { x: Math.PI / 2, z: 0 },
      { x: -Math.PI / 2, z: 0 },
      { x: Math.PI, z: 0 },
      { x: 0, z: Math.PI / 2 },
      { x: 0, z: -Math.PI / 2 },
    ];

    let bestScore = Infinity;
    let bestRot = candidateRotations[0];

    for (const rot of candidateRotations) {
      const testGeom = geom.clone();
      if (rot.x !== 0) testGeom.rotateX(rot.x);
      if (rot.z !== 0) testGeom.rotateZ(rot.z);
      testGeom.computeBoundingBox();
      const sz = new THREE.Vector3();
      testGeom.boundingBox!.getSize(sz);

      // Score: heavily penalize height (Y) to encourage flat stable prints
      const score = sz.y * 2.0 - (sz.x * sz.z) * 0.01;
      if (score < bestScore) {
        bestScore = score;
        bestRot = rot;
      }
      testGeom.dispose();
    }

    if (bestRot.x !== 0) geom.rotateX(bestRot.x);
    if (bestRot.z !== 0) geom.rotateZ(bestRot.z);
    geom.computeVertexNormals();
    this.regroundGeometry(geom);
  }

  private regroundGeometry(geom: THREE.BufferGeometry) {
    geom.center();
    geom.computeBoundingBox();
    const yOffset = -geom.boundingBox!.min.y;
    geom.translate(0, yOffset, 0);

    geom.computeBoundingSphere();
    geom.computeBoundingBox();
    this.modelBoundingBox = geom.boundingBox!.clone();
    this.modelBoundingSphere = geom.boundingSphere!.clone();

    if (this.wireframeMesh) {
      this.wireframeMesh.geometry = geom;
    }

    if (this.boundingBoxHelper) {
      this.scene.remove(this.boundingBoxHelper);
      this.boundingBoxHelper.dispose();
      this.boundingBoxHelper = new THREE.Box3Helper(this.modelBoundingBox, new THREE.Color(0x38bdf8));
      this.boundingBoxHelper.visible = this.options.showBoundingBox;
      this.scene.add(this.boundingBoxHelper);
    }

    this.adaptEnvironmentToModel();
    this.updateClipping();
    this.buildPlate.checkFit(this.modelBoundingBox);
    this.onCameraChange?.();
  }

  public getBoundingBox(): THREE.Box3 | null {
    return this.modelBoundingBox;
  }

  public checkPrintBedFit(): FitResult {
    return this.buildPlate.checkFit(this.modelBoundingBox);
  }

  public switchCameraType(type: 'perspective' | 'orthographic') {
    const prevCam = this.activeCamera;
    const target = this.controls.target.clone();

    if (type === 'orthographic') {
      const distance = prevCam.position.distanceTo(target);
      const aspect = this.container.clientWidth / this.container.clientHeight;
      const fovRad = (this.perspectiveCamera.fov * Math.PI) / 180;
      const frustumHeight = 2 * distance * Math.tan(fovRad / 2);
      const frustumWidth = frustumHeight * aspect;

      this.orthographicCamera.left = -frustumWidth / 2;
      this.orthographicCamera.right = frustumWidth / 2;
      this.orthographicCamera.top = frustumHeight / 2;
      this.orthographicCamera.bottom = -frustumHeight / 2;
      this.orthographicCamera.position.copy(prevCam.position);
      this.orthographicCamera.rotation.copy(prevCam.rotation);
      this.orthographicCamera.updateProjectionMatrix();

      this.activeCamera = this.orthographicCamera;
    } else {
      this.perspectiveCamera.position.copy(prevCam.position);
      this.perspectiveCamera.rotation.copy(prevCam.rotation);
      this.perspectiveCamera.updateProjectionMatrix();

      this.activeCamera = this.perspectiveCamera;
    }

    this.controls.object = this.activeCamera;
    this.controls.update();
    this.measurementTool.setCamera(this.activeCamera);
    this.onCameraChange?.();
  }

  public fitCameraToModel(instant = false) {
    if (!this.modelBoundingSphere || !this.modelBoundingBox) return;

    const sphere = this.modelBoundingSphere;
    const center = new THREE.Vector3(
      sphere.center.x,
      (this.modelBoundingBox.max.y + this.modelBoundingBox.min.y) / 2,
      sphere.center.z
    );

    const radius = Math.max(sphere.radius, 1);
    const fov = this.perspectiveCamera.fov * (Math.PI / 180);
    const distance = Math.abs(radius / Math.sin(fov / 2)) * 1.35;

    const targetPos = new THREE.Vector3(
      center.x + distance * 0.7,
      center.y + distance * 0.5,
      center.z + distance * 0.7
    );

    if (instant) {
      this.activeCamera.position.copy(targetPos);
      this.controls.target.copy(center);
      this.activeCamera.lookAt(center);
      this.controls.update();
      this.onCameraChange?.();
    } else {
      this.animateCameraTo(targetPos, center);
    }
  }

  public setView(view: CameraView) {
    if (!this.modelBoundingSphere || !this.modelBoundingBox) return;

    const sphere = this.modelBoundingSphere;
    const center = new THREE.Vector3(
      sphere.center.x,
      (this.modelBoundingBox.max.y + this.modelBoundingBox.min.y) / 2,
      sphere.center.z
    );
    const radius = Math.max(sphere.radius, 1);
    const fov = this.perspectiveCamera.fov * (Math.PI / 180);
    const distance = Math.abs(radius / Math.sin(fov / 2)) * 1.4;

    const targetPos = new THREE.Vector3();

    switch (view) {
      case 'iso':
        targetPos.set(center.x + distance * 0.7, center.y + distance * 0.6, center.z + distance * 0.7);
        break;
      case 'top':
        targetPos.set(center.x, center.y + distance, center.z + 0.0001);
        break;
      case 'bottom':
        targetPos.set(center.x, center.y - distance, center.z + 0.0001);
        break;
      case 'front':
        targetPos.set(center.x, center.y, center.z + distance);
        break;
      case 'back':
        targetPos.set(center.x, center.y, center.z - distance);
        break;
      case 'left':
        targetPos.set(center.x - distance, center.y, center.z);
        break;
      case 'right':
        targetPos.set(center.x + distance, center.y, center.z);
        break;
    }

    this.animateCameraTo(targetPos, center);
  }

  private animateCameraTo(targetPosition: THREE.Vector3, targetLookAt: THREE.Vector3, duration = 400) {
    if (this.isAnimatingCamera) return;
    this.isAnimatingCamera = true;

    const startPos = this.activeCamera.position.clone();
    const startTarget = this.controls.target.clone();
    const startTime = performance.now();

    const step = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Smooth cubic ease out
      const ease = 1 - Math.pow(1 - progress, 3);

      this.activeCamera.position.lerpVectors(startPos, targetPosition, ease);
      this.controls.target.lerpVectors(startTarget, targetLookAt, ease);
      this.controls.update();
      this.onCameraChange?.();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.isAnimatingCamera = false;
      }
    };

    requestAnimationFrame(step);
  }

  public takeScreenshot(transparent = false): string {
    const originalBackground = this.scene.background;
    if (transparent) {
      this.scene.background = null;
    } else {
      this.scene.background = new THREE.Color(0x0a0f1d);
    }

    // Hide grid/helpers temporarily if desired, or keep as is
    this.renderer.render(this.scene, this.activeCamera);
    const dataUrl = this.canvas.toDataURL('image/png');

    this.scene.background = originalBackground;
    return dataUrl;
  }

  private onResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    const aspect = width / height;

    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    if (this.modelBoundingSphere) {
      const r = this.modelBoundingSphere.radius * 2.5;
      this.orthographicCamera.left = (-r * aspect) / 2;
      this.orthographicCamera.right = (r * aspect) / 2;
      this.orthographicCamera.top = r / 2;
      this.orthographicCamera.bottom = -r / 2;
    }
    this.orthographicCamera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.onCameraChange?.();
  };

  private animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (this.options.autoRotate && !this.isAnimatingCamera) {
      this.controls.update();
    } else {
      this.controls.update();
    }

    this.renderer.render(this.scene, this.activeCamera);
  }

  public destroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.measurementTool.destroy();
    this.buildPlate.destroy();
    this.renderer.dispose();
  }
}
