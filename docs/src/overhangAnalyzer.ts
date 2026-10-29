import * as THREE from 'three';

export interface OverhangAnalysis {
  overhangRatio: number; // percentage 0 - 100
  overhangArea: number;  // in mm²
  totalArea: number;     // in mm²
  vertexColors: Float32Array;
}

/**
 * Computes vertex colors highlighting downward-facing overhang angles.
 * - Safe (>= thresholdDeg): Cool Blue / Gray (#64748b)
 * - Warning (within 10 deg of threshold): Yellow / Amber (#f59e0b)
 * - Critical Overhang (< thresholdDeg from horizontal): Vibrant Red (#ef4444)
 */
export function computeOverhangColors(
  geometry: THREE.BufferGeometry,
  thresholdDeg = 45
): OverhangAnalysis {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = nonIndexed.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  let totalArea = 0;
  let overhangArea = 0;
  let overhangTriangles = 0;
  const totalTriangles = count / 3;

  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const normal = new THREE.Vector3();

  // Colors
  const colorSafe = new THREE.Color(0x64748b);     // Slate / Neutral
  const colorWarning = new THREE.Color(0xf59e0b);  // Amber
  const colorCritical = new THREE.Color(0xef4444); // Red

  for (let i = 0; i < count; i += 3) {
    pA.fromBufferAttribute(pos, i);
    pB.fromBufferAttribute(pos, i + 1);
    pC.fromBufferAttribute(pos, i + 2);

    cb.subVectors(pC, pB);
    ab.subVectors(pA, pB);
    normal.crossVectors(cb, ab);
    const triArea = normal.length() * 0.5;
    totalArea += triArea;
    normal.normalize();

    let r = colorSafe.r;
    let g = colorSafe.g;
    let b = colorSafe.b;

    // A surface points downward if normal.y < 0
    if (normal.y < -0.001) {
      // Angle between normal and horizontal bed:
      // When normal is straight down (ny = -1), angle with horizontal is 0° (flat ceiling)
      // When normal is horizontal (ny = 0), angle is 90° (vertical wall)
      const angleFromHorizontalDeg = Math.asin(Math.abs(normal.y)) * (180 / Math.PI);

      if (angleFromHorizontalDeg < thresholdDeg) {
        // Needs support!
        overhangArea += triArea;
        overhangTriangles++;

        if (angleFromHorizontalDeg < thresholdDeg - 10) {
          // Critical steep overhang
          r = colorCritical.r;
          g = colorCritical.g;
          b = colorCritical.b;
        } else {
          // Moderate warning overhang
          r = colorWarning.r;
          g = colorWarning.g;
          b = colorWarning.b;
        }
      }
    }

    // Apply color to all 3 vertices of the triangle
    for (let v = 0; v < 3; v++) {
      const idx = (i + v) * 3;
      colors[idx] = r;
      colors[idx + 1] = g;
      colors[idx + 2] = b;
    }
  }

  const overhangRatio = totalTriangles > 0 ? (overhangTriangles / totalTriangles) * 100 : 0;

  return {
    overhangRatio: Number(overhangRatio.toFixed(1)),
    overhangArea: Number(overhangArea.toFixed(1)),
    totalArea: Number(totalArea.toFixed(1)),
    vertexColors: colors,
  };
}
