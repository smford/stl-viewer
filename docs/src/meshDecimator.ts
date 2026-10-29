import * as THREE from 'three';

/**
 * Fast O(N) Vertex Clustering Mesh Decimation.
 * Simplifies geometry by clustering vertices into a spatial voxel grid
 * and filtering out degenerate triangles.
 */
export function decimateGeometry(
  geometry: THREE.BufferGeometry,
  reductionRatio: number // 0.1 (mild 10% reduction) to 0.9 (aggressive 90% reduction)
): THREE.BufferGeometry {
  if (reductionRatio <= 0.01) {
    return geometry.clone();
  }

  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = nonIndexed.attributes.position;
  const count = pos.count;

  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);

  // Determine grid resolution based on reduction ratio and original triangle count
  // Higher reductionRatio -> coarser grid (fewer cells)
  const baseCells = Math.cbrt(count / 3);
  const resolution = Math.max(8, Math.round(baseCells * Math.pow(1 - reductionRatio * 0.85, 1.2)));
  const cellSize = maxDim / resolution;

  const minX = box.min.x;
  const minY = box.min.y;
  const minZ = box.min.z;

  // Map from grid coordinate key to cluster centroid point
  const cellMap = new Map<string, { sum: THREE.Vector3; count: number; index: number }>();
  const vertexToCellIndex: number[] = new Array(count);

  const p = new THREE.Vector3();
  let nextCellIndex = 0;

  for (let i = 0; i < count; i++) {
    p.fromBufferAttribute(pos, i);
    const gx = Math.floor((p.x - minX) / cellSize);
    const gy = Math.floor((p.y - minY) / cellSize);
    const gz = Math.floor((p.z - minZ) / cellSize);
    const key = `${gx}_${gy}_${gz}`;

    let cell = cellMap.get(key);
    if (!cell) {
      cell = { sum: p.clone(), count: 1, index: nextCellIndex++ };
      cellMap.set(key, cell);
    } else {
      cell.sum.add(p);
      cell.count++;
    }
    vertexToCellIndex[i] = cell.index;
  }

  // Compute average representative point for each cell
  const cellCentroids: THREE.Vector3[] = new Array(nextCellIndex);
  for (const cell of cellMap.values()) {
    cellCentroids[cell.index] = cell.sum.divideScalar(cell.count);
  }

  // Build new triangle list, dropping collapsed triangles (where 2 or 3 vertices share same cell)
  const newPositions: number[] = [];

  for (let i = 0; i < count; i += 3) {
    const iA = vertexToCellIndex[i];
    const iB = vertexToCellIndex[i + 1];
    const iC = vertexToCellIndex[i + 2];

    // If triangle collapsed into a line or point, discard it
    if (iA === iB || iB === iC || iA === iC) {
      continue;
    }

    const cA = cellCentroids[iA];
    const cB = cellCentroids[iB];
    const cC = cellCentroids[iC];

    newPositions.push(cA.x, cA.y, cA.z);
    newPositions.push(cB.x, cB.y, cB.z);
    newPositions.push(cC.x, cC.y, cC.z);
  }

  // Fallback: If over-simplified to empty, return clone of original
  if (newPositions.length === 0) {
    return geometry.clone();
  }

  const newGeo = new THREE.BufferGeometry();
  newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  newGeo.computeVertexNormals();
  newGeo.computeBoundingBox();
  newGeo.computeBoundingSphere();

  return newGeo;
}
