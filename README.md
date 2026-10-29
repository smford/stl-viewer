# 3D STL Studio & Viewer

A clean, sleek, modern web application for rendering, inspecting, and manipulating 3D STL (Stereolithography) files in real time. Designed with a responsive, glassmorphic UI optimized for **desktop**, **tablet**, and **mobile** devices.

Built with **Three.js**, **TypeScript**, **Vite**, and **Lucide Icons**.

🌐 **Live Demo (GitHub Pages)**: [https://smford.github.io/stl-viewer/](https://smford.github.io/stl-viewer/)

---

## 🌟 Key Features

### 1. 3D Rendering & Natural Touch Navigation
- **OrbitControls**:
  - **Desktop**: Left click + drag to rotate, Right click (or Shift + Left click) to pan, Mouse wheel to zoom.
  - **Touch (Mobile / Tablet)**: 1-finger drag to rotate, 2-finger pinch to zoom & drag to pan. Handled via `touch-action: none` to prevent screen scroll conflicts.
- **Interactive Orientation Gizmo (Corner ViewCube)**: Real-time 3D axis indicator (X, Y, Z). Click any axis or face to snap camera views smoothly.
- **Camera Views Menu**: Quick animated transitions to **Isometric**, **Top (Y+)**, **Front (Z+)**, **Right (X+)**, **Bottom (Y-)**, **Left (X-)**, and **Back (Z-)**.
- **Perspective vs. Orthographic**: Instant toggle between Perspective and true CAD Orthographic camera projections.
- **Auto-Rotation (Turntable)**: Showcase mode with adjustable rotation speed.
- **Fit-to-View**: Automatic camera framing calculating the bounding sphere and optimal FOV distance.

### 2. Shading, Styling & Materials
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
- **PBR Controls**: Fine-tune surface Roughness and Metalness with interactive sliders.

### 3. Inspection & Physical Metrics
- **Instant Geometry Diagnostics**:
  - Exact **Triangle Count** & **Vertex Count**.
  - Watertight / Solid mesh verification.
  - Real-world **Bounding Box Dimensions** ($X \times Y \times Z$ in mm).
  - Exact **Volume** estimation ($cm^3$ or $mm^3$) using divergence theorem.
  - **Surface Area** calculation ($cm^2$).
  - File format detection (Binary vs. ASCII) & file size indicator.

### 4. Interactive Section Slicing (Cross-Section Cut)
- Real-time CAD clipping plane slicing along **X**, **Y**, or **Z** axes.
- Slide from 0% to 100% through the model volume.
- Invert slice direction toggle.

### 5. Studio Lighting & Environment
- **Lighting Presets**: Studio Three-Point, Clean Daylight, Cyberpunk Neon, and Warm Sunset.
- **Adaptive Ground Grid & Floor Shadows**: Dynamic shadow catcher plane and grid that automatically scale to match any imported model size.
- **Bounding Box Helper**: 3D bounding box wireframe outline toggle.

### 6. File Handling & Samples
- **Drag & Drop**: Drag any `.stl` file directly into the browser window with animated glowing dropzone overlay.
- **File Picker**: Native file selector compatible with desktop and mobile file pickers.
- **Pre-bundled Procedural Sample Models**:
  - *Mechanical Spur Gear* (18-tooth gear with bore and lightening holes)
  - *Torus Knot (2,3)* (intricate topological manifold)
  - *20mm Calibration Cube* (classic 3D printing test piece)
  - *Faceted Geodesic Gem* (icosahedral faceted structure)
- **Export Capabilities**:
  - **Download High-Res Snapshot (PNG)**.
  - **Download active STL** file.

---

## 📱 Mobile & Tablet Responsive Design

- **Mobile View**:
  - Viewport-first layout with `touch-action: none` to prevent screen scroll conflicts.
  - Floating bottom dock for thumb-friendly access to primary camera and styling actions.
  - Slide-up bottom sheet modal for the Inspector & Tools panel.
  - Support for iOS/Android safe area insets (`env(safe-area-inset-bottom)`).
- **Tablet & Desktop**:
  - Floating top navigation bar with quick sample model switcher.
  - Collapsible floating glass inspector panel.
  - Keyboard shortcuts.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|:---:|:---|
| <kbd>F</kbd> | Fit camera to model |
| <kbd>R</kbd> | Toggle turntable auto-rotation |
| <kbd>W</kbd> | Toggle wireframe overlay |
| <kbd>P</kbd> | Switch Perspective / Orthographic camera |
| <kbd>I</kbd> | Toggle Inspector panel |
| <kbd>S</kbd> | Take high-resolution screenshot |
| <kbd>Esc</kbd> | Close open menus and inspector |

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or newer)
- npm

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
│       └── deploy.yml      # Automated GitHub Actions deployment to GitHub Pages
├── README.md               # Root repository documentation
├── .gitignore              # Git ignore rules for node_modules and build artifacts
└── docs/                   # Web application source & GitHub Pages root
    ├── index.html          # Modern semantic HTML5 markup with glassmorphism UI
    ├── package.json        # Dependencies (three, lucide, vite, typescript)
    ├── package-lock.json   # Deterministic dependency lockfile
    ├── tsconfig.json       # TypeScript compiler configuration
    ├── vite.config.ts      # Vite configuration with relative base path support
    └── src/
        ├── main.ts             # Application controller, UI state & event handling
        ├── viewer.ts           # Three.js WebGL scene, cameras, lights, clipping & render loop
        ├── orientationGizmo.ts # Interactive corner 3D axis gizmo (ViewCube)
        ├── stlLoader.ts        # Binary & ASCII STL parser, volume, bounds & stats calculator
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
