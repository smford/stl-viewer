# 3D STL Studio & Viewer

A clean, sleek, modern web application for rendering, inspecting, and manipulating 3D STL (Stereolithography) files in real time. Designed with a responsive, glassmorphic UI optimized for **desktop**, **tablet**, and **mobile** devices.

Built with **Three.js**, **TypeScript**, **Vite**, and **Lucide Icons**.

🌐 **Live Demo (GitHub Pages)**: [http://stephenford.org/stl-viewer/](http://stephenford.org/stl-viewer/) *(or [https://smford.github.io/stl-viewer/](https://smford.github.io/stl-viewer/))*

---

## 🌟 Key Features

### 1. 3D Rendering & Natural Touch Navigation
- **OrbitControls**:
  - **Desktop**: Left click + drag to rotate, Right click (or Shift + Left click) to pan, Mouse wheel to zoom.
  - **Touch (Mobile / Tablet)**: 1-finger drag to rotate, 2-finger pinch to zoom & drag to pan (`touch-action: none` prevents screen scroll interference).
- **Interactive Orientation Gizmo (Corner ViewCube)**: Real-time 3D axis indicator (X, Y, Z). Click any axis or face to snap camera views smoothly.
- **Camera Views Menu**: Quick animated transitions to **Isometric**, **Top (Y+)**, **Front (Z+)**, **Right (X+)**, **Bottom (Y-)**, **Left (X-)**, and **Back (Z-)**.
- **Perspective vs. Orthographic**: Instant toggle between Perspective and true CAD Orthographic camera projections.
- **Auto-Rotation (Turntable)**: Showcase mode with adjustable rotation speed.
- **Fit-to-View**: Automatic camera framing calculating the bounding sphere and optimal FOV distance.

### 2. 📏 CAD Caliper & 3D Point-to-Point Measurement
- Click any two points on the model surface to measure real-world millimeter distances.
- Renders 3D dimension line, endpoint spherical markers (A & B), midpoint floating distance badge, and delta dimensions ($\Delta X, \Delta Y, \Delta Z$).
- Supports multiple persistent measurements with instant clear.

### 3. 🖨️ 3D Printing & Slicer Tools
- **Overhang Angle Heatmap**: Real-time shader analyzing triangle normals relative to the build plate. Highlights printable (safe), warning, and critical support-requiring angles with a customizable threshold slider ($30^\circ - 65^\circ$).
- **Printer Build Volume Simulator**: Visualize realistic spring-steel PEI print beds and bounding cages for:
  - Bambu Lab X1 / P1 / A1 ($256 \times 256 \times 256\text{ mm}$)
  - Prusa MK3 / MK4 ($250 \times 210 \times 220\text{ mm}$)
  - Creality Ender 3 ($220 \times 220 \times 250\text{ mm}$)
  - Voron 2.4 ($350 \times 350 \times 350\text{ mm}$)
  - Elegoo Mars 4 ($153 \times 77 \times 175\text{ mm}$)
- **Bed Clearance Verification**: Automatically checks whether the part fits within the selected printer envelope, alerting if dimensions exceed printable limits.
- **Filament Weight, Length & Cost Estimator**: Calculates exact filament weight (grams), 1.75mm extrusion length (meters), and print cost ($) based on material density (PLA, PETG, ABS, TPU, Resin), infill percentage ($10\% - 100\%$), and spool price.
- **Center of Mass (CoM)**: Calculates exact 3D center of gravity using the divergence theorem on closed polyhedral tetrahedra, rendered as an internal 3D gimbal gyroscope marker.
- **Auto-Orient on Build Plate**: Automatically tests orthogonal orientations to select the orientation that maximizes base stability and minimizes overall print height. Quick 90° rotation buttons for X, Y, and Z axes.

### 4. 🔍 Mesh Topology Diagnostics & Decimation
- **Integrity Checker**: Detects boundary holes (open edges), non-manifold edges (faces sharing $>2$ triangles), and degenerate triangles.
- **Defect Highlighting**: Toggleable bright magenta wireframe highlighting mesh defects in 3D space.
- **Client-Side Mesh Decimation**: In-browser polygon reduction ($10\% - 90\%$) using spatial vertex clustering to simplify heavy 3D scans down to lightweight meshes without UI freeze.

### 5. 🧩 Multi-Model Assembly Workspace & Exploded View
- Load and inspect multiple STL files simultaneously in an assembly hierarchy.
- Per-part color customizer, visibility toggles (eye icon), and individual deletion.
- **Exploded View Slider**: Smoothly expands all parts radially from the assembly centroid to inspect internal fits and clearances.

### 6. 🎨 Shading, Styling & Materials
- **Shading Modes**:
  - **Studio Smooth**: MeshPhysicalMaterial with clearcoat and specular reflections.
  - **Matte Clay**: Smooth diffuse CAD clay look.
  - **Glossy Resin**: High-gloss translucent 3D print resin aesthetic.
  - **Metallic Aluminum**: Brushed metal finish with environment reflection.
  - **Flat / Faceted**: Reveals raw triangle facet geometry.
  - **X-Ray / Ghost**: Semi-transparent structural view with depth preservation.
  - **Normals Visualizer**: Diagnostic mode displaying surface normal vectors (detects flipped normals).
  - **Wireframe**: Clean polygon wireframe geometry.
- **Wireframe Overlay**: Toggle subtle wireframe lines overlaid on top of any solid shaded material.
- **Curated Color Swatches & Custom Picker**: Cobalt Blue, Prusa Orange, Cyan CAD, Emerald, Ceramic White, Titanium Slate, Brass Gold, Crimson, or any HEX/RGB color.
- **Interactive Section Slicing**: Real-time CAD clipping plane slicing along X, Y, or Z axes with direction flipping.

### 7. 📹 Export, Video & Sharing
- **360° Turntable Video Recorder**: Record smooth 5-second 60 FPS turntable video loops exported directly to WebM format.
- **High-Res Snapshot**: Download crisp PNG screenshots with clean studio background.
- **STL Export**: Download active STL models (including simplified/decimated versions).
- **PWA & Offline Support**: Progressive Web App with offline service worker caching and native OS file handling (`.stl` association).
- **URL Parameter Loading**: Direct remote loading via `?url=https://.../model.stl` or `?sample=gear`.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|:---:|:---|
| <kbd>F</kbd> | Fit camera to model |
| <kbd>R</kbd> | Toggle turntable auto-rotation |
| <kbd>M</kbd> | Toggle Point-to-Point Caliper measurement |
| <kbd>W</kbd> | Toggle wireframe overlay |
| <kbd>P</kbd> | Switch Perspective / Orthographic camera |
| <kbd>I</kbd> | Toggle Inspector panel |
| <kbd>S</kbd> | Take high-resolution screenshot |
| <kbd>Esc</kbd> | Close open menus and inspector |

---

## 🚀 Quick Start

### Local Development
```bash
# Navigate to the docs/ directory where the app is located
cd docs

# Install dependencies
npm install

# Start development server with hot-reload
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Production Build
```bash
cd docs
npm run build
npm run preview
```

---

## 🏗 Architecture & Code Structure

```
stl-viewer/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Automated GitHub Actions deployment to GitHub Pages
├── README.md                   # Root repository documentation
├── .gitignore                  # Git ignore rules for node_modules and build artifacts
└── docs/                       # Web application source & GitHub Pages root
    ├── index.html              # Modern semantic HTML5 markup with glassmorphism UI
    ├── manifest.json           # PWA web manifest with file_handlers for .stl
    ├── sw.js                   # Service worker for offline caching
    ├── package.json            # Dependencies (three, lucide, vite, typescript)
    ├── package-lock.json       # Deterministic dependency lockfile
    ├── tsconfig.json           # TypeScript compiler configuration
    ├── vite.config.ts          # Vite configuration with relative base path support
    └── src/
        ├── main.ts             # Application controller, UI state & event handling
        ├── viewer.ts           # Three.js WebGL scene, cameras, lights, clipping & render loop
        ├── measurementTool.ts  # 3D Point-to-Point Caliper with 3D sprites and dimension lines
        ├── overhangAnalyzer.ts # 3D print overhang normal angle calculator & heatmap
        ├── buildPlate.ts       # 3D printer bed simulator & clearance verification
        ├── meshDiagnostics.ts  # Topology analyzer (holes, non-manifold edges, degenerates)
        ├── meshDecimator.ts    # Spatial vertex-clustering polygon simplification
        ├── assemblyManager.ts  # Multi-STL hierarchy and exploded view animator
        ├── videoRecorder.ts    # 360° turntable MediaRecorder video generator
        ├── orientationGizmo.ts # Interactive corner 3D axis gizmo (ViewCube)
        ├── stlLoader.ts        # Binary & ASCII STL parser, volume, bounds & CoM calculator
        ├── sampleModels.ts     # Procedural binary STL generators for instant demo models
        ├── types.ts            # TypeScript interfaces and types
        └── style.css           # Glassmorphic, mobile-first responsive CSS design system
```

---

## 🚢 GitHub Pages CI/CD

Deployments are automated through **GitHub Actions** via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
Whenever changes are pushed to `main`, GitHub Actions automatically:
1. Checks out the code.
2. Installs dependencies inside `docs/`.
3. Compiles TypeScript and builds production assets with Vite.
4. Packages and publishes the site directly to GitHub Pages.
