import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { ModelStats } from './types.ts';

const loader = new STLLoader();

export interface LoadedModel {
  geometry: THREE.BufferGeometry;
  stats: ModelStats;
}

export function parseSTL(buffer: ArrayBuffer, fileName: string = 'model.stl'): LoadedModel {
  const geometry = loader.parse(buffer);
  
  // Ensure normals are computed
  geometry.computeVertexNormals();

  // Center horizontally (X, Z) and rest on Y=0 ground plane
  geometry.center();
  geometry.computeBoundingBox();
  const centeredBox = geometry.boundingBox!;
  const yOffset = -centeredBox.min.y;
  geometry.translate(0, yOffset, 0);

  // Recompute bounding sphere and box for camera framing
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  // Compute stats on the properly grounded geometry
  const stats = calculateGeometryStats(geometry, fileName, buffer.byteLength);

  return { geometry, stats };
}

function calculateGeometryStats(
  geometry: THREE.BufferGeometry,
  fileName: string,
  byteLength: number
): ModelStats {
  const pos = geometry.attributes.position;
  if (!pos) {
    throw new Error('Invalid STL: Missing vertex position buffer');
  }

  const triangleCount = pos.count / 3;
  const vertexCount = pos.count;

  geometry.computeBoundingBox();
  const box = geometry.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  box.getSize(size);

  let totalVolume = 0;
  let totalArea = 0;
  const comSum = new THREE.Vector3();
  const triCentroid = new THREE.Vector3();

  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const cross = new THREE.Vector3();

  // Iterate triangles
  for (let i = 0; i < pos.count; i += 3) {
    pA.fromBufferAttribute(pos, i);
    pB.fromBufferAttribute(pos, i + 1);
    pC.fromBufferAttribute(pos, i + 2);

    // Signed volume of tetrahedron formed by origin and triangle
    // V = (pA . (pB x pC)) / 6
    cross.crossVectors(pB, pC);
    const tetVol = pA.dot(cross) / 6.0;
    totalVolume += tetVol;

    // Tetrahedron centroid: (pA + pB + pC + 0) / 4
    triCentroid.copy(pA).add(pB).add(pC).multiplyScalar(0.25);
    comSum.addScaledVector(triCentroid, tetVol);

    // Surface area of triangle: 0.5 * |(pB - pA) x (pC - pA)|
    ab.subVectors(pB, pA);
    cb.subVectors(pC, pA);
    cross.crossVectors(ab, cb);
    totalArea += cross.length() * 0.5;
  }

  // Volume sign depends on vertex winding. Take absolute value.
  const volume = Math.abs(totalVolume);

  // Center of Mass (CoM)
  const centerOfMass = new THREE.Vector3();
  if (Math.abs(totalVolume) > 0.001) {
    centerOfMass.copy(comSum).divideScalar(totalVolume);
  } else {
    box.getCenter(centerOfMass);
  }

  return {
    name: fileName,
    fileSize: byteLength,
    triangleCount,
    vertexCount,
    dimensions: {
      x: Number(size.x.toFixed(2)),
      y: Number(size.y.toFixed(2)),
      z: Number(size.z.toFixed(2)),
    },
    volume: Number(volume.toFixed(2)),
    surfaceArea: Number(totalArea.toFixed(2)),
    isWatertight: volume > 0.001,
    centerOfMass: {
      x: Number(centerOfMass.x.toFixed(2)),
      y: Number(centerOfMass.y.toFixed(2)),
      z: Number(centerOfMass.z.toFixed(2)),
    },
  };
}
