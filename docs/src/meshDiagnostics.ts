import * as THREE from 'three';

export interface MeshDiagnosticReport {
  isWatertight: boolean;
  boundaryEdgesCount: number;
  nonManifoldEdgesCount: number;
  degenerateTrianglesCount: number;
  defectEdgesGeometry: THREE.BufferGeometry | null;
}

/**
 * Analyzes triangle connectivity to detect holes and non-manifold edges.
 */
export function analyzeMeshTopology(geometry: THREE.BufferGeometry): MeshDiagnosticReport {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = nonIndexed.attributes.position;
  const count = pos.count;

  // Key format: quantize vertex positions to 0.001mm to handle floating point tolerance
  const quantize = (v: THREE.Vector3) =>
    `${Math.round(v.x * 1000)},${Math.round(v.y * 1000)},${Math.round(v.z * 1000)}`;

  const edgeMap = new Map<string, { count: number; p1: THREE.Vector3; p2: THREE.Vector3 }>();
  let degenerateCount = 0;

  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let i = 0; i < count; i += 3) {
    pA.fromBufferAttribute(pos, i);
    pB.fromBufferAttribute(pos, i + 1);
    pC.fromBufferAttribute(pos, i + 2);

    // Check degenerate triangle (zero area)
    cb.subVectors(pC, pB);
    ab.subVectors(pA, pB);
    cross.crossVectors(cb, ab);
    if (cross.lengthSq() < 1e-10) {
      degenerateCount++;
      continue;
    }

    const kA = quantize(pA);
    const kB = quantize(pB);
    const kC = quantize(pC);

    const edges = [
      { k1: kA, k2: kB, p1: pA.clone(), p2: pB.clone() },
      { k1: kB, k2: kC, p1: pB.clone(), p2: pC.clone() },
      { k1: kC, k2: kA, p1: pC.clone(), p2: pA.clone() },
    ];

    for (const e of edges) {
      // Sort canonical edge key
      const edgeKey = e.k1 < e.k2 ? `${e.k1}_${e.k2}` : `${e.k2}_${e.k1}`;
      const existing = edgeMap.get(edgeKey);
      if (existing) {
        existing.count++;
      } else {
        edgeMap.set(edgeKey, { count: 1, p1: e.p1, p2: e.p2 });
      }
    }
  }

  let boundaryCount = 0;
  let nonManifoldCount = 0;
  const defectPoints: THREE.Vector3[] = [];

  for (const entry of edgeMap.values()) {
    if (entry.count === 1) {
      boundaryCount++;
      defectPoints.push(entry.p1, entry.p2);
    } else if (entry.count > 2) {
      nonManifoldCount++;
      defectPoints.push(entry.p1, entry.p2);
    }
  }

  let defectEdgesGeometry: THREE.BufferGeometry | null = null;
  if (defectPoints.length > 0) {
    defectEdgesGeometry = new THREE.BufferGeometry().setFromPoints(defectPoints);
  }

  const isWatertight = boundaryCount === 0 && nonManifoldCount === 0 && degenerateCount === 0;

  return {
    isWatertight,
    boundaryEdgesCount: boundaryCount,
    nonManifoldEdgesCount: nonManifoldCount,
    degenerateTrianglesCount: degenerateCount,
    defectEdgesGeometry,
  };
}
