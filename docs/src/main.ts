import {
  createIcons,
  Box,
  Focus,
  Compass,
  ArrowUp,
  Square,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  Move,
  RotateCw,
  Video,
  Grid3x3,
  SlidersHorizontal,
  Upload,
  Download,
  Camera,
  Maximize,
  Sliders,
  X,
  Info,
  Palette,
  Scissors,
  Sun,
  Pipette,
  UploadCloud,
  Check
} from 'lucide';
import { STLViewer } from './viewer.ts';
import { OrientationGizmo } from './orientationGizmo.ts';
import { parseSTL, type LoadedModel } from './stlLoader.ts';
import { SAMPLE_MODELS } from './sampleModels.ts';
import type { CameraView, LightingPreset, ShadingMode, ViewerOptions } from './types.ts';

// Initialize Lucide icons
function refreshIcons() {
  createIcons({
    icons: {
      Box,
      Focus,
      Compass,
      ArrowUp,
      Square,
      ArrowRight,
      ArrowDown,
      ArrowLeft,
      Move,
      RotateCw,
      Video,
      Grid3x3,
      SlidersHorizontal,
      Upload,
      Download,
      Camera,
      Maximize,
      Sliders,
      X,
      Info,
      Palette,
      Scissors,
      Sun,
      Pipette,
      UploadCloud,
      Check,
    },
  });
}

// Initial viewer configuration
const defaultOptions: ViewerOptions = {
  shadingMode: 'standard',
  materialColor: '#3b82f6',
  roughness: 0.35,
  metalness: 0.1,
  wireframeOverlay: false,
  wireframeColor: '#ffffff',
  showGrid: true,
  showShadows: true,
  showBoundingBox: false,
  showAxes: true,
  autoRotate: false,
  autoRotateSpeed: 2.0,
  cameraType: 'perspective',
  lightingPreset: 'studio',
  sectionClipping: {
    enabled: false,
    axis: 'y',
    planeConstant: 0,
    negated: false,
  },
};

// Application State
let viewer: STLViewer;
let gizmo: OrientationGizmo;
let currentBuffer: ArrayBuffer | null = null;
let currentFileName = 'model.stl';

// DOM Element References
const viewportContainer = document.getElementById('viewport-container') as HTMLElement;
const gizmoContainer = document.getElementById('gizmo-container') as HTMLElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const sampleSelect = document.getElementById('sample-select') as HTMLSelectElement;
const activeModelNameEl = document.getElementById('active-model-name') as HTMLElement;
const dropOverlay = document.getElementById('drop-overlay') as HTMLElement;
const loadingOverlay = document.getElementById('loading-overlay') as HTMLElement;
const loadingText = document.getElementById('loading-text') as HTMLElement;
const toastContainer = document.getElementById('toast-container') as HTMLElement;

// Quick Dock Buttons
const btnFit = document.getElementById('btn-fit') as HTMLButtonElement;
const btnViewsMenu = document.getElementById('btn-views-menu') as HTMLButtonElement;
const viewsDropdown = document.getElementById('views-dropdown') as HTMLElement;
const btnAutoRotate = document.getElementById('btn-autorotate') as HTMLButtonElement;
const btnCamToggle = document.getElementById('btn-cam-toggle') as HTMLButtonElement;
const camTypeLabel = document.getElementById('cam-type-label') as HTMLElement;
const btnWireframeToggle = document.getElementById('btn-wireframe-toggle') as HTMLButtonElement;
const btnPanelToggle = document.getElementById('btn-panel-toggle') as HTMLButtonElement;

// Nav action buttons
const btnDownloadStl = document.getElementById('btn-download-stl') as HTMLButtonElement;
const btnSnapshot = document.getElementById('btn-snapshot') as HTMLButtonElement;
const btnFullscreen = document.getElementById('btn-fullscreen') as HTMLButtonElement;

// Inspector Elements
const inspectorPanel = document.getElementById('inspector-panel') as HTMLElement;
const btnClosePanel = document.getElementById('btn-close-panel') as HTMLButtonElement;
const tabButtons = document.querySelectorAll<HTMLButtonElement>('.inspector-tabs .tab-btn');
const tabPanes = document.querySelectorAll<HTMLElement>('.tab-pane');

// Stats Elements
const statTriangles = document.getElementById('stat-triangles') as HTMLElement;
const statVertices = document.getElementById('stat-vertices') as HTMLElement;
const statVolume = document.getElementById('stat-volume') as HTMLElement;
const statArea = document.getElementById('stat-area') as HTMLElement;
const dimX = document.getElementById('dim-x') as HTMLElement;
const dimY = document.getElementById('dim-y') as HTMLElement;
const dimZ = document.getElementById('dim-z') as HTMLElement;
const statFilesize = document.getElementById('stat-filesize') as HTMLElement;
const statIntegrity = document.getElementById('stat-integrity') as HTMLElement;

// Appearance Controls
const shadingButtons = document.querySelectorAll<HTMLButtonElement>('[data-shading]');
const colorSwatches = document.querySelectorAll<HTMLButtonElement>('[data-color]');
const customColorInput = document.getElementById('custom-color-input') as HTMLInputElement;
const roughnessSlider = document.getElementById('roughness-slider') as HTMLInputElement;
const roughnessVal = document.getElementById('roughness-val') as HTMLElement;
const metalnessSlider = document.getElementById('metalness-slider') as HTMLInputElement;
const metalnessVal = document.getElementById('metalness-val') as HTMLElement;
const toggleWireframeOverlay = document.getElementById('toggle-wireframe-overlay') as HTMLInputElement;

// Section Clipping Controls
const toggleClipping = document.getElementById('toggle-clipping') as HTMLInputElement;
const clippingControlsBlock = document.getElementById('clipping-controls') as HTMLElement;
const clipAxisButtons = document.querySelectorAll<HTMLButtonElement>('[data-clip-axis]');
const slicePosSlider = document.getElementById('slice-pos-slider') as HTMLInputElement;
const slicePosVal = document.getElementById('slice-pos-val') as HTMLElement;
const toggleClipInvert = document.getElementById('toggle-clip-invert') as HTMLInputElement;

// Studio Controls
const lightButtons = document.querySelectorAll<HTMLButtonElement>('[data-light]');
const toggleGrid = document.getElementById('toggle-grid') as HTMLInputElement;
const toggleShadows = document.getElementById('toggle-shadows') as HTMLInputElement;
const toggleBbox = document.getElementById('toggle-bbox') as HTMLInputElement;
const autorotateSpeed = document.getElementById('autorotate-speed') as HTMLInputElement;
const speedVal = document.getElementById('speed-val') as HTMLElement;

/**
 * Toast Notification Utility
 */
function showToast(message: string, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i data-lucide="check" style="width:14px;height:14px;color:#34d399"></i> <span>${message}</span>`;
  toastContainer.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.remove();
  }, duration + 300);
}

/**
 * Update UI Stats Panel
 */
function updateStatsUI(loaded: LoadedModel) {
  const { stats } = loaded;
  statTriangles.textContent = stats.triangleCount.toLocaleString();
  statVertices.textContent = stats.vertexCount.toLocaleString();
  
  // Format volume (convert mm³ to cm³)
  const volumeCm3 = stats.volume / 1000;
  statVolume.textContent = `${volumeCm3.toFixed(2)} cm³`;

  // Format surface area (convert mm² to cm²)
  const areaCm2 = stats.surfaceArea / 100;
  statArea.textContent = `${areaCm2.toFixed(2)} cm²`;

  dimX.textContent = `${stats.dimensions.x.toFixed(2)} mm`;
  dimY.textContent = `${stats.dimensions.y.toFixed(2)} mm`;
  dimZ.textContent = `${stats.dimensions.z.toFixed(2)} mm`;

  const kb = stats.fileSize / 1024;
  statFilesize.textContent = kb >= 1024 
    ? `${(kb / 1024).toFixed(2)} MB` 
    : `${kb.toFixed(1)} KB`;

  statIntegrity.textContent = stats.isWatertight ? 'Watertight (Solid)' : 'Surface Mesh';
  statIntegrity.className = stats.isWatertight ? 'info-val badge-ok' : 'info-val';

  activeModelNameEl.textContent = stats.name;
  activeModelNameEl.title = stats.name;

  // Recalculate clipping slider values based on model bounding box
  syncClippingPlane();
}

/**
 * Synchronize Section Clipping Plane with current slider and axis
 */
function syncClippingPlane() {
  const box = viewer.getBoundingBox();
  if (!box) return;

  const axis = viewer.getOptions().sectionClipping.axis;
  const min = box.min[axis];
  const max = box.max[axis];
  const percent = parseFloat(slicePosSlider.value) / 100;
  const constant = min + percent * (max - min);

  viewer.setOptions({
    sectionClipping: {
      ...viewer.getOptions().sectionClipping,
      planeConstant: constant,
    },
  });
}

/**
 * Load STL ArrayBuffer into Viewer
 */
function loadSTLBuffer(buffer: ArrayBuffer, name: string) {
  try {
    loadingOverlay.classList.remove('hidden');
    loadingText.textContent = `Rendering ${name}...`;

    setTimeout(() => {
      currentBuffer = buffer;
      currentFileName = name;

      const loaded = parseSTL(buffer, name);
      viewer.setModel(loaded.geometry);
      updateStatsUI(loaded);

      loadingOverlay.classList.add('hidden');
      showToast(`Loaded ${name} (${loaded.stats.triangleCount.toLocaleString()} triangles)`);
    }, 20);
  } catch (err) {
    loadingOverlay.classList.add('hidden');
    console.error('Failed to load STL:', err);
    alert('Failed to parse STL file. Please check that it is a valid binary or ASCII STL.');
  }
}

/**
 * Setup All Event Handlers
 */
function setupEventHandlers() {
  // File Upload Input
  fileInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result instanceof ArrayBuffer) {
          loadSTLBuffer(event.target.result, file.name);
          sampleSelect.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    }
  });

  // Sample Model Selector
  sampleSelect.addEventListener('change', () => {
    const val = sampleSelect.value;
    const sample = SAMPLE_MODELS.find((s) => s.id === val);
    if (sample) {
      const buffer = sample.getBuffer();
      loadSTLBuffer(buffer, `${sample.name}.stl`);
    }
  });

  // Drag & Drop
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dropOverlay.classList.remove('hidden');
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
      dropOverlay.classList.add('hidden');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('hidden');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.stl')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result instanceof ArrayBuffer) {
            loadSTLBuffer(event.target.result, file.name);
            sampleSelect.value = '';
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        alert('Please drop a valid .stl 3D file.');
      }
    }
  });

  // Fit to View
  btnFit.addEventListener('click', () => {
    viewer.fitCameraToModel(false);
  });

  // Views Dropdown Toggle
  btnViewsMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    viewsDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!viewsDropdown.contains(e.target as Node) && e.target !== btnViewsMenu) {
      viewsDropdown.classList.add('hidden');
    }
  });

  // Views Selection
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view') as CameraView;
      viewer.setView(view);
      viewsDropdown.classList.add('hidden');
    });
  });

  // Auto Rotate Toggle
  btnAutoRotate.addEventListener('click', () => {
    const isRotating = !viewer.getOptions().autoRotate;
    viewer.setOptions({ autoRotate: isRotating });
    btnAutoRotate.classList.toggle('active', isRotating);
  });

  // Camera Projection Toggle (Persp vs Ortho)
  btnCamToggle.addEventListener('click', () => {
    const current = viewer.getOptions().cameraType;
    const next = current === 'perspective' ? 'orthographic' : 'perspective';
    viewer.setOptions({ cameraType: next });
    camTypeLabel.textContent = next === 'perspective' ? 'Persp' : 'Ortho';
    gizmo.setMainCamera(viewer.activeCamera);
    showToast(`Camera switched to ${next.toUpperCase()}`);
  });

  // Wireframe Quick Toggle
  btnWireframeToggle.addEventListener('click', () => {
    const current = viewer.getOptions().wireframeOverlay;
    viewer.setOptions({ wireframeOverlay: !current });
    toggleWireframeOverlay.checked = !current;
    btnWireframeToggle.classList.toggle('active', !current);
  });

  // Inspector Panel Toggle
  const toggleInspector = () => {
    inspectorPanel.classList.toggle('panel-collapsed');
    btnPanelToggle.classList.toggle('active', !inspectorPanel.classList.contains('panel-collapsed'));
  };

  btnPanelToggle.addEventListener('click', toggleInspector);
  btnClosePanel.addEventListener('click', toggleInspector);

  // Inspector Tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      tabPanes.forEach((p) => p.classList.add('hidden'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab) {
        document.getElementById(targetTab)?.classList.remove('hidden');
      }
    });
  });

  // Shading Buttons
  shadingButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      shadingButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-shading') as ShadingMode;
      viewer.setOptions({ shadingMode: mode });
    });
  });

  // Color Swatches
  colorSwatches.forEach((btn) => {
    btn.addEventListener('click', () => {
      colorSwatches.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const color = btn.getAttribute('data-color')!;
      viewer.setOptions({ materialColor: color });
      customColorInput.value = color;
    });
  });

  // Custom Color Input
  customColorInput.addEventListener('input', () => {
    colorSwatches.forEach((b) => b.classList.remove('active'));
    viewer.setOptions({ materialColor: customColorInput.value });
  });

  // Roughness Slider
  roughnessSlider.addEventListener('input', () => {
    const val = parseFloat(roughnessSlider.value);
    roughnessVal.textContent = val.toFixed(2);
    viewer.setOptions({ roughness: val });
  });

  // Metalness Slider
  metalnessSlider.addEventListener('input', () => {
    const val = parseFloat(metalnessSlider.value);
    metalnessVal.textContent = val.toFixed(2);
    viewer.setOptions({ metalness: val });
  });

  // Wireframe Overlay Checkbox
  toggleWireframeOverlay.addEventListener('change', () => {
    viewer.setOptions({ wireframeOverlay: toggleWireframeOverlay.checked });
    btnWireframeToggle.classList.toggle('active', toggleWireframeOverlay.checked);
  });

  // Section Clipping Toggle
  toggleClipping.addEventListener('change', () => {
    const enabled = toggleClipping.checked;
    clippingControlsBlock.classList.toggle('disabled', !enabled);
    viewer.setOptions({
      sectionClipping: {
        ...viewer.getOptions().sectionClipping,
        enabled,
      },
    });
    if (enabled) {
      syncClippingPlane();
    }
  });

  // Clip Axis Buttons
  clipAxisButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      clipAxisButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const axis = btn.getAttribute('data-clip-axis') as 'x' | 'y' | 'z';
      viewer.setOptions({
        sectionClipping: {
          ...viewer.getOptions().sectionClipping,
          axis,
        },
      });
      syncClippingPlane();
    });
  });

  // Slice Position Slider
  slicePosSlider.addEventListener('input', () => {
    slicePosVal.textContent = `${slicePosSlider.value}%`;
    syncClippingPlane();
  });

  // Invert Clip
  toggleClipInvert.addEventListener('change', () => {
    viewer.setOptions({
      sectionClipping: {
        ...viewer.getOptions().sectionClipping,
        negated: toggleClipInvert.checked,
      },
    });
    syncClippingPlane();
  });

  // Lighting Presets
  lightButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      lightButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.getAttribute('data-light') as LightingPreset;
      viewer.setOptions({ lightingPreset: preset });
    });
  });

  // Grid / Shadow / BBox Toggles
  toggleGrid.addEventListener('change', () => {
    viewer.setOptions({ showGrid: toggleGrid.checked });
  });
  toggleShadows.addEventListener('change', () => {
    viewer.setOptions({ showShadows: toggleShadows.checked });
  });
  toggleBbox.addEventListener('change', () => {
    viewer.setOptions({ showBoundingBox: toggleBbox.checked });
  });

  // Auto-rotate Speed Slider
  autorotateSpeed.addEventListener('input', () => {
    const speed = parseFloat(autorotateSpeed.value);
    speedVal.textContent = `${speed.toFixed(1)}x`;
    viewer.setOptions({ autoRotateSpeed: speed });
  });

  // Download Current STL
  btnDownloadStl.addEventListener('click', () => {
    if (!currentBuffer) return;
    const blob = new Blob([currentBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFileName;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${currentFileName}`);
  });

  // Screenshot Snapshot
  btnSnapshot.addEventListener('click', () => {
    const dataUrl = viewer.takeScreenshot(false);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${currentFileName.replace(/\.stl$/i, '')}-snapshot.png`;
    a.click();
    showToast('Saved high-resolution snapshot');
  });

  // Fullscreen
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen error:', err);
      });
    }
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

    switch (e.key.toLowerCase()) {
      case 'f':
        viewer.fitCameraToModel(false);
        break;
      case 'r':
        btnAutoRotate.click();
        break;
      case 'w':
        btnWireframeToggle.click();
        break;
      case 'p':
        btnCamToggle.click();
        break;
      case 'i':
        btnPanelToggle.click();
        break;
      case 's':
        btnSnapshot.click();
        break;
      case 'escape':
        viewsDropdown.classList.add('hidden');
        if (window.innerWidth <= 768 && !inspectorPanel.classList.contains('panel-collapsed')) {
          inspectorPanel.classList.add('panel-collapsed');
          btnPanelToggle.classList.remove('active');
        }
        break;
    }
  });
}

/**
 * Application Bootstrap
 */
function init() {
  refreshIcons();

  // Initialize Three.js STL Viewer
  viewer = new STLViewer(viewportContainer, defaultOptions);

  // Initialize Interactive Corner Gizmo
  gizmo = new OrientationGizmo(gizmoContainer, viewer.activeCamera, (view) => {
    viewer.setView(view);
  });

  // Link camera updates to orientation gizmo
  viewer.onCameraChange = () => {
    gizmo.update(viewer.controls.target);
  };

  // Wire UI event listeners
  setupEventHandlers();

  // Default: On mobile screens, collapse inspector panel by default; on desktop, open by default
  if (window.innerWidth <= 768) {
    inspectorPanel.classList.add('panel-collapsed');
    btnPanelToggle.classList.remove('active');
  } else {
    btnPanelToggle.classList.add('active');
  }

  // Load default sample model: Mechanical Gear
  const defaultSample = SAMPLE_MODELS[0];
  const buffer = defaultSample.getBuffer();
  loadSTLBuffer(buffer, `${defaultSample.name}.stl`);

  // Initial gizmo render
  gizmo.update(viewer.controls.target);
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
