export type ShadingMode = 
  | 'standard' 
  | 'clay' 
  | 'glossy' 
  | 'metal' 
  | 'flat' 
  | 'xray' 
  | 'normals' 
  | 'wireframe'
  | 'overhang';

export type LightingPreset = 'studio' | 'daylight' | 'cyber' | 'warm';

export type CameraView = 'iso' | 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

export interface ModelStats {
  name: string;
  fileSize: number;
  triangleCount: number;
  vertexCount: number;
  dimensions: { x: number; y: number; z: number };
  volume: number;       // in mm³
  surfaceArea: number;  // in mm²
  isWatertight: boolean;
  centerOfMass: { x: number; y: number; z: number };
}

export interface ViewerOptions {
  shadingMode: ShadingMode;
  materialColor: string;
  roughness: number;
  metalness: number;
  wireframeOverlay: boolean;
  wireframeColor: string;
  showGrid: boolean;
  showShadows: boolean;
  showBoundingBox: boolean;
  showAxes: boolean;
  showCenterOfMass: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  cameraType: 'perspective' | 'orthographic';
  lightingPreset: LightingPreset;
  overhangThreshold: number;
  sectionClipping: {
    enabled: boolean;
    axis: 'x' | 'y' | 'z';
    planeConstant: number;
    negated: boolean;
  };
}
