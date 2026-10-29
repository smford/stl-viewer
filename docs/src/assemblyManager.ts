import * as THREE from 'three';

export interface AssemblyPart {
  id: string;
  name: string;
  geometry: THREE.BufferGeometry;
  mesh: THREE.Mesh;
  originalPosition: THREE.Vector3;
  centroid: THREE.Vector3;
  color: string;
  visible: boolean;
}

export class AssemblyManager {
  private scene: THREE.Scene;
  public group: THREE.Group;
  public parts: AssemblyPart[] = [];

  public onPartsChange?: (parts: AssemblyPart[]) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'assembly-group';
    this.scene.add(this.group);
  }

  public addPart(geometry: THREE.BufferGeometry, name: string, colorHex: string): AssemblyPart {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const centroid = new THREE.Vector3();
    box.getCenter(centroid);

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const part: AssemblyPart = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      geometry,
      mesh,
      originalPosition: mesh.position.clone(),
      centroid,
      color: colorHex,
      visible: true,
    };

    this.parts.push(part);
    this.onPartsChange?.(this.parts);
    return part;
  }

  public removePart(id: string) {
    const idx = this.parts.findIndex((p) => p.id === id);
    if (idx !== -1) {
      const part = this.parts[idx];
      this.group.remove(part.mesh);
      part.geometry.dispose();
      (part.mesh.material as THREE.Material).dispose();
      this.parts.splice(idx, 1);
      this.onPartsChange?.(this.parts);
    }
  }

  public setPartVisibility(id: string, visible: boolean) {
    const part = this.parts.find((p) => p.id === id);
    if (part) {
      part.visible = visible;
      part.mesh.visible = visible;
      this.onPartsChange?.(this.parts);
    }
  }

  public setPartColor(id: string, colorHex: string) {
    const part = this.parts.find((p) => p.id === id);
    if (part) {
      part.color = colorHex;
      (part.mesh.material as THREE.MeshStandardMaterial).color.set(colorHex);
      this.onPartsChange?.(this.parts);
    }
  }

  public setExplodedProgress(progress: number) { // 0 to 1
    if (this.parts.length <= 1) return;

    // Calculate common centroid of all parts
    const overallCentroid = new THREE.Vector3();
    let totalWeight = 0;
    for (const part of this.parts) {
      if (part.visible) {
        overallCentroid.add(part.centroid);
        totalWeight++;
      }
    }
    if (totalWeight > 0) {
      overallCentroid.divideScalar(totalWeight);
    }

    const maxSpread = 40; // Max displacement in mm
    for (const part of this.parts) {
      const dir = new THREE.Vector3().subVectors(part.centroid, overallCentroid);
      if (dir.lengthSq() < 0.001) {
        // Fallback direction if part was centered at origin
        dir.set(0, 1, 0);
      } else {
        dir.normalize();
      }

      // Displace outward
      const offset = dir.multiplyScalar(progress * maxSpread);
      part.mesh.position.copy(part.originalPosition).add(offset);
    }
  }

  public getCombinedBoundingBox(): THREE.Box3 {
    const box = new THREE.Box3();
    for (const part of this.parts) {
      if (part.visible) {
        box.expandByObject(part.mesh);
      }
    }
    return box;
  }

  public clear() {
    for (const part of this.parts) {
      this.group.remove(part.mesh);
      part.geometry.dispose();
      (part.mesh.material as THREE.Material).dispose();
    }
    this.parts = [];
    this.onPartsChange?.(this.parts);
  }

  public destroy() {
    this.clear();
    this.scene.remove(this.group);
  }
}
