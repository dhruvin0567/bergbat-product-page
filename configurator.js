import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PMREMGenerator } from 'three';

/**
 * BatModelManager - Handles 3D model loading, region splitting, and geometry management
 */
class BatModelManager {
  constructor(scene) {
    this.scene = scene;
    this.batModel = null;
    this.regions = {
      barrel: null,
      handle: null,
      knob: null
    };
    this.originalBounds = null;
    this.geometryMap = new Map(); // Store original geometries for region splitting
  }

  async loadModel(path) {
    return new Promise((resolve, reject) => {
      const loader = new OBJLoader();
      loader.load(
        path,
        (object) => {
          this.batModel = object;
          this._processModel();
          resolve(object);
        },
        undefined,
        reject
      );
    });
  }

  _processModel() {
    if (!this.batModel) return;

    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(this.batModel);
    this.originalBounds = {
      min: box.min.clone(),
      max: box.max.clone(),
      center: box.getCenter(new THREE.Vector3()),
      size: box.getSize(new THREE.Vector3())
    };

    // Center the model
    this.batModel.position.sub(this.originalBounds.center);

    // Scale to reasonable size
    const maxDim = Math.max(this.originalBounds.size.x, this.originalBounds.size.y, this.originalBounds.size.z);
    const scale = 20 / maxDim;
    this.batModel.scale.multiplyScalar(scale);

    // Update bounds after scaling
    const scaledBox = new THREE.Box3().setFromObject(this.batModel);
    this.originalBounds.min = scaledBox.min;
    this.originalBounds.max = scaledBox.max;
    this.originalBounds.size = scaledBox.getSize(new THREE.Vector3());

    // Split into regions
    this._splitIntoRegions();
  }

  _splitIntoRegions() {
    // Collect all meshes
    const meshes = [];
    this.batModel.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
      }
    });

    if (meshes.length === 0) return;

    // Use first mesh geometry (most OBJ files have single mesh, or combine manually)
    let sourceGeometry = meshes[0].geometry.clone();
    
    // If multiple meshes, we'll use the first one's structure
    // In production, you'd merge geometries properly or use a tool like BufferGeometryUtils
    
    // Split based on Y position (vertical axis)
    const positions = sourceGeometry.attributes.position.array;
    
    // Calculate Y ranges for regions
    // Assuming bat is oriented vertically (Y axis)
    const yMin = this.originalBounds.min.y;
    const yMax = this.originalBounds.max.y;
    const yRange = yMax - yMin;
    
    // Define region boundaries (typical bat proportions)
    const knobEnd = yMin + yRange * 0.15;        // Bottom 15% = knob
    const handleEnd = yMin + yRange * 0.40;      // Next 25% = handle (15-40%)
    // Top 60% = barrel (40-100%)

    // Create index arrays for each region
    const knobIndices = [];
    const handleIndices = [];
    const barrelIndices = [];

    // Group faces by their vertices' average Y position
    const index = sourceGeometry.index;
    if (index) {
      const indexArray = index.array;
      for (let i = 0; i < indexArray.length; i += 3) {
        const i1 = indexArray[i];
        const i2 = indexArray[i + 1];
        const i3 = indexArray[i + 2];

        const y1 = positions[i1 * 3 + 1];
        const y2 = positions[i2 * 3 + 1];
        const y3 = positions[i3 * 3 + 1];
        const avgY = (y1 + y2 + y3) / 3;

        if (avgY <= knobEnd) {
          knobIndices.push(i1, i2, i3);
        } else if (avgY <= handleEnd) {
          handleIndices.push(i1, i2, i3);
        } else {
          barrelIndices.push(i1, i2, i3);
        }
      }
    } else {
      // Non-indexed geometry - create index
      for (let i = 0; i < positions.length; i += 9) {
        const y1 = positions[i + 1];
        const y2 = positions[i + 4];
        const y3 = positions[i + 7];
        const avgY = (y1 + y2 + y3) / 3;
        const baseIndex = i / 3;

        if (avgY <= knobEnd) {
          knobIndices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        } else if (avgY <= handleEnd) {
          handleIndices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        } else {
          barrelIndices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        }
      }
    }

    // Create geometries for each region
    this.regions.knob = this._createRegionGeometry(sourceGeometry, knobIndices);
    this.regions.handle = this._createRegionGeometry(sourceGeometry, handleIndices);
    this.regions.barrel = this._createRegionGeometry(sourceGeometry, barrelIndices);

    // Remove original meshes
    meshes.forEach(mesh => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      } else {
        this.scene.remove(mesh);
      }
    });

    // Store original geometry reference
    this.geometryMap.set('original', sourceGeometry);
  }

  _createRegionGeometry(sourceGeometry, indices) {
    if (indices.length === 0) return null;

    // Use a remapping approach to create new geometry with only selected faces
    const indexMap = new Map(); // Map old index -> new index
    const newIndices = [];
    const newPositions = [];
    const newNormals = [];
    const newUVs = [];

    const sourcePositions = sourceGeometry.attributes.position;
    const sourceNormals = sourceGeometry.attributes.normal;
    const sourceUVs = sourceGeometry.attributes.uv;

    let newIndex = 0;

    // Process indices and create remapped arrays
    for (let i = 0; i < indices.length; i++) {
      const oldIndex = indices[i];
      
      if (!indexMap.has(oldIndex)) {
        indexMap.set(oldIndex, newIndex);
        
        const posIdx = oldIndex * 3;
        newPositions.push(
          sourcePositions.array[posIdx],
          sourcePositions.array[posIdx + 1],
          sourcePositions.array[posIdx + 2]
        );

        if (sourceNormals) {
          newNormals.push(
            sourceNormals.array[posIdx],
            sourceNormals.array[posIdx + 1],
            sourceNormals.array[posIdx + 2]
          );
        }

        if (sourceUVs) {
          const uvIdx = oldIndex * 2;
          newUVs.push(
            sourceUVs.array[uvIdx],
            sourceUVs.array[uvIdx + 1]
          );
        }

        newIndex++;
      }

      newIndices.push(indexMap.get(oldIndex));
    }

    // Create new geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    
    if (newNormals.length > 0) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
    } else {
      geometry.computeVertexNormals();
    }
    
    if (newUVs.length > 0) {
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(newUVs, 2));
    }

    geometry.setIndex(newIndices);
    geometry.computeBoundingSphere();

    return geometry;
  }

  getRegionMesh(regionName) {
    if (!this.regions[regionName]) return null;
    
    // Check if mesh already exists
    let mesh = this.scene.children.find(child => 
      child.userData.region === regionName && child.isMesh
    );

    if (!mesh) {
      const geometry = this.regions[regionName];
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      mesh = new THREE.Mesh(geometry, material);
      mesh.userData.region = regionName;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      // Apply pending materials if any
      const materialController = window.batConfigurator?.materialController;
      if (materialController?.pendingMaterials?.has(regionName)) {
        const options = materialController.pendingMaterials.get(regionName);
        materialController.pendingMaterials.delete(regionName);
        materialController.updateRegionMaterial(regionName, options);
      }
    }

    return mesh;
  }

  getBounds() {
    return this.originalBounds;
  }

  updateCupStyle(style) {
    // This would modify the barrel geometry to show cup variations
    // For now, we'll use material/texture techniques or shader modifications
    // In a production system, you'd have separate geometry variants
    const barrelMesh = this.getRegionMesh('barrel');
    if (!barrelMesh) return;

    // Store cup style in userData for material controller
    barrelMesh.userData.cupStyle = style;
  }

  updateTorpedo(enabled) {
    const barrelMesh = this.getRegionMesh('barrel');
    if (!barrelMesh) return;

    // Slight scale modification on barrel tip
    if (enabled) {
      barrelMesh.userData.torpedoScale = 1.05;
    } else {
      barrelMesh.userData.torpedoScale = 1.0;
    }
  }

  updateKnobStyle(style) {
    const knobMesh = this.getRegionMesh('knob');
    if (!knobMesh) return;
    knobMesh.userData.knobStyle = style;
  }
}

/**
 * MaterialController - Manages PBR materials, textures, and material properties
 */
class MaterialController {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.envMap = null;
    this.materials = new Map();
    this.presetColors = {
      barrel: [
        { name: 'Natural Wood', color: 0xD4A574 },
        { name: 'Black', color: 0x1a1a1a },
        { name: 'Blue', color: 0x2563eb },
        { name: 'Red', color: 0xdc2626 },
        { name: 'White', color: 0xf5f5f5 },
        { name: 'Grey', color: 0x6b7280 }
      ],
      handle: [
        { name: 'Black', color: 0x1a1a1a },
        { name: 'Brown', color: 0x8b4513 },
        { name: 'Blue', color: 0x2563eb },
        { name: 'Red', color: 0xdc2626 },
        { name: 'Grey', color: 0x6b7280 }
      ],
      knob: [
        { name: 'Black', color: 0x1a1a1a },
        { name: 'Blue', color: 0x2563eb },
        { name: 'Red', color: 0xdc2626 },
        { name: 'White', color: 0xf5f5f5 }
      ]
    };
    this._initEnvironment();
  }

  async _initEnvironment() {
    // Create a simple HDR-like environment map
    const pmremGenerator = new PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    // Create a procedural environment map for realistic lighting
    const envScene = new THREE.Scene();
    const envLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    envLight1.position.set(1, 1, 1);
    envScene.add(envLight1);

    const envLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    envLight2.position.set(-1, 0.5, -1);
    envScene.add(envLight2);

    const envLight3 = new THREE.AmbientLight(0xffffff, 0.3);
    envScene.add(envLight3);

    // Create environment map from scene
    const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
    this.envMap = renderTarget.texture;
    this.scene.environment = this.envMap;
    pmremGenerator.dispose();
  }

  getMaterial(regionName, options = {}) {
    // Create a more stable key
    const key = `${regionName}_${options.color || 0xffffff}_${options.roughness || 0.7}_${options.metalness || 0}_${options.envMapIntensity || 1.0}`;
    
    if (this.materials.has(key)) {
      const existingMaterial = this.materials.get(key);
      // Update properties if they've changed (for shared materials)
      if (existingMaterial.color.getHex() !== (options.color || 0xffffff)) {
        existingMaterial.color.setHex(options.color || 0xffffff);
      }
      existingMaterial.roughness = options.roughness || 0.7;
      existingMaterial.metalness = options.metalness || 0.0;
      existingMaterial.envMapIntensity = options.envMapIntensity || 1.0;
      return existingMaterial;
    }

    const material = new THREE.MeshStandardMaterial({
      color: options.color || 0xffffff,
      metalness: options.metalness || 0.0,
      roughness: options.roughness || 0.7,
      envMap: this.envMap,
      envMapIntensity: options.envMapIntensity || 1.0,
    });

    this.materials.set(key, material);
    return material;
  }

  updateRegionMaterial(regionName, options) {
    const batManager = window.batConfigurator?.modelManager;
    if (!batManager) return;

    const mesh = batManager.getRegionMesh(regionName);
    if (!mesh) {
      // Mesh doesn't exist yet, store options for later
      if (!this.pendingMaterials) this.pendingMaterials = new Map();
      this.pendingMaterials.set(regionName, options);
      return;
    }

    // Get or create material (materials are cached and shared when appropriate)
    const material = this.getMaterial(regionName, options);
    
    // Only update if material reference changed
    if (mesh.material !== material) {
      mesh.material = material;
    }
  }

  updateColor(regionName, color) {
    const options = this._getRegionOptions(regionName);
    options.color = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
    this.updateRegionMaterial(regionName, options);
  }

  updateFinish(regionName, finish) {
    const options = this._getRegionOptions(regionName);
    
    if (finish === 'glossy') {
      options.roughness = 0.1;
      options.metalness = 0.1;
      options.envMapIntensity = 1.5;
    } else if (finish === 'matte') {
      options.roughness = 0.9;
      options.metalness = 0.0;
      options.envMapIntensity = 0.8;
    }

    this.updateRegionMaterial(regionName, options);
  }

  updateGripStyle(style) {
    const options = this._getRegionOptions('handle');
    
    // Grip style affects roughness (texture feel)
    switch (style) {
      case 'smooth':
        options.roughness = 0.3;
        break;
      case 'wrapped':
        options.roughness = 0.7;
        break;
      case 'taper':
        options.roughness = 0.5;
        break;
    }

    this.updateRegionMaterial('handle', options);
  }

  _getRegionOptions(regionName) {
    const batManager = window.batConfigurator?.modelManager;
    if (!batManager) return {};

    const mesh = batManager.getRegionMesh(regionName);
    if (!mesh || !mesh.material) return {};

    const mat = mesh.material;
    return {
      color: mat.color?.getHex() || 0xffffff,
      roughness: mat.roughness || 0.7,
      metalness: mat.metalness || 0.0,
      envMapIntensity: mat.envMapIntensity || 1.0
    };
  }

  getPresetColors(regionName) {
    return this.presetColors[regionName] || [];
  }

  addEngraving(text) {
    // In production, this would create a decal texture or use decal geometry
    // For now, we'll store it in userData for potential texture generation
    const batManager = window.batConfigurator?.modelManager;
    if (!batManager) return;

    const barrelMesh = batManager.getRegionMesh('barrel');
    if (barrelMesh) {
      barrelMesh.userData.engraving = text;
    }
  }
}

/**
 * UIStateController - Manages UI state and interactions
 */
class UIStateController {
  constructor(modelManager, materialController) {
    this.modelManager = modelManager;
    this.materialController = materialController;
    this.state = {
      barrel: {
        color: 0xD4A574,
        finish: 'glossy',
        cupStyle: 'full',
        torpedo: false,
        engraving: ''
      },
      handle: {
        color: 0x1a1a1a,
        gripStyle: 'smooth',
        finish: 'matte'
      },
      knob: {
        color: 0x1a1a1a,
        style: 'round'
      }
    };
    this._initUI();
  }

  _initUI() {
    this._initTabs();
    this._initColorPickers();
    this._initControls();
    this._initCameraControls();
  }

  _initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(`${targetTab}-tab`).classList.add('active');
      });
    });
  }

  _initColorPickers() {
    // Barrel colors
    this._createColorPicker('barrel', this.materialController.getPresetColors('barrel'));
    
    // Handle colors
    this._createColorPicker('handle', this.materialController.getPresetColors('handle'));
    
    // Knob colors
    this._createColorPicker('knob', this.materialController.getPresetColors('knob'));
  }

  _createColorPicker(regionName, presetColors) {
    const container = document.getElementById(`${regionName}-color-picker`);
    if (!container) return;

    container.innerHTML = '';

    presetColors.forEach(preset => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = `#${preset.color.toString(16).padStart(6, '0')}`;
      
      if (this.state[regionName].color === preset.color) {
        swatch.classList.add('active');
      }

      swatch.addEventListener('click', () => {
        this._selectColor(regionName, preset.color);
        container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      });

      container.appendChild(swatch);
    });

    // Custom color picker
    const customBtn = document.createElement('div');
    customBtn.className = 'custom-color-btn';
    customBtn.innerHTML = '+';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = `#${this.state[regionName].color.toString(16).padStart(6, '0')}`;
    
    customBtn.addEventListener('click', () => colorInput.click());
    colorInput.addEventListener('change', (e) => {
      const color = parseInt(e.target.value.replace('#', ''), 16);
      this._selectColor(regionName, color);
    });

    customBtn.appendChild(colorInput);
    container.appendChild(customBtn);
  }

  _selectColor(regionName, color) {
    this.state[regionName].color = color;
    this.materialController.updateColor(regionName, color);
  }

  _initControls() {
    // Barrel finish
    document.querySelectorAll('#barrel-tab [data-finish]').forEach(btn => {
      btn.addEventListener('click', () => {
        const finish = btn.dataset.finish;
        this.state.barrel.finish = finish;
        this.materialController.updateFinish('barrel', finish);
        document.querySelectorAll('#barrel-tab [data-finish]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Barrel cup style
    document.querySelectorAll('#barrel-tab [data-cup]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cupStyle = btn.dataset.cup;
        this.state.barrel.cupStyle = cupStyle;
        this.modelManager.updateCupStyle(cupStyle);
        document.querySelectorAll('#barrel-tab [data-cup]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Torpedo toggle
    const torpedoSwitch = document.getElementById('torpedo-switch');
    torpedoSwitch.addEventListener('click', () => {
      torpedoSwitch.classList.toggle('active');
      const enabled = torpedoSwitch.classList.contains('active');
      this.state.barrel.torpedo = enabled;
      this.modelManager.updateTorpedo(enabled);
    });

    // Engraving text
    const engravingInput = document.getElementById('engraving-text');
    engravingInput.addEventListener('input', (e) => {
      this.state.barrel.engraving = e.target.value;
      this.materialController.addEngraving(e.target.value);
    });

    // Handle grip style
    document.querySelectorAll('#handle-tab [data-grip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gripStyle = btn.dataset.grip;
        this.state.handle.gripStyle = gripStyle;
        this.materialController.updateGripStyle(gripStyle);
        document.querySelectorAll('#handle-tab [data-grip]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Handle finish
    document.querySelectorAll('#handle-tab [data-finish]').forEach(btn => {
      btn.addEventListener('click', () => {
        const finish = btn.dataset.finish;
        this.state.handle.finish = finish;
        this.materialController.updateFinish('handle', finish);
        document.querySelectorAll('#handle-tab [data-finish]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Knob style
    document.querySelectorAll('#knob-tab [data-knob]').forEach(btn => {
      btn.addEventListener('click', () => {
        const knobStyle = btn.dataset.knob;
        this.state.knob.style = knobStyle;
        this.modelManager.updateKnobStyle(knobStyle);
        document.querySelectorAll('#knob-tab [data-knob]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  _initCameraControls() {
    const cameraBtns = document.querySelectorAll('.camera-btn');
    cameraBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (window.batConfigurator?.cameraController) {
          window.batConfigurator.cameraController.setView(view);
        }
      });
    });
  }
}

/**
 * CameraController - Manages camera positions and smooth transitions
 */
class CameraController {
  constructor(camera, controls, modelManager) {
    this.camera = camera;
    this.controls = controls;
    this.modelManager = modelManager;
    this.views = {
      full: { position: new THREE.Vector3(50, 30, 50), target: new THREE.Vector3(0, 0, 0) },
      barrel: { position: new THREE.Vector3(40, 50, 40), target: new THREE.Vector3(0, 20, 0) },
      handle: { position: new THREE.Vector3(30, 10, 30), target: new THREE.Vector3(0, -10, 0) }
    };
  }

  setView(viewName) {
    const view = this.views[viewName];
    if (!view) return;

    // Smooth transition
    this._animateTo(view.position, view.target);
  }

  _animateTo(targetPosition, targetLookAt) {
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1000; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-in-out)
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      this.camera.position.lerpVectors(startPosition, targetPosition, eased);
      this.controls.target.lerpVectors(startTarget, targetLookAt, eased);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }
}

/**
 * Main Configurator Application
 */
class BatConfigurator {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.modelManager = null;
    this.materialController = null;
    this.uiController = null;
    this.cameraController = null;
    this.animationId = null;
  }

  async init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(50, 30, 50);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    document.getElementById('canvas-container').appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // Lighting
    this._setupLighting();

    // Initialize managers
    this.modelManager = new BatModelManager(this.scene);
    this.materialController = new MaterialController(this.scene, this.renderer);
    this.cameraController = new CameraController(this.camera, this.controls, this.modelManager);

    // Load model
    try {
      await this.modelManager.loadModel('baseball.obj');
      
      // Create meshes for all regions first
      this.modelManager.getRegionMesh('barrel');
      this.modelManager.getRegionMesh('handle');
      this.modelManager.getRegionMesh('knob');
      
      // Initialize materials for all regions (now that meshes exist)
      this._initializeMaterials();
      
      // Setup UI
      this.uiController = new UIStateController(this.modelManager, this.materialController);
      
      // Hide loading overlay
      document.getElementById('loading-overlay').style.display = 'none';
      document.getElementById('ui-panel').style.display = 'block';
      
      // Start render loop
      this.animate();
    } catch (error) {
      console.error('Error loading model:', error);
      const loadingText = document.getElementById('loading-overlay').querySelector('.loading-text');
      if (loadingText) {
        loadingText.textContent = 'Error loading model: ' + error.message;
      }
    }

    // Handle resize
    window.addEventListener('resize', () => this._onWindowResize());

    // Expose for global access
    window.batConfigurator = this;
  }

  _setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Main directional light (key light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(50, 50, 50);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 200;
    keyLight.shadow.camera.left = -50;
    keyLight.shadow.camera.right = 50;
    keyLight.shadow.camera.top = 50;
    keyLight.shadow.camera.bottom = -50;
    keyLight.shadow.bias = -0.0001;
    this.scene.add(keyLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-30, 20, -30);
    this.scene.add(fillLight);

    // Rim light
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
    rimLight.position.set(0, 10, -50);
    this.scene.add(rimLight);
  }

  _initializeMaterials() {
    // Initialize default materials for all regions
    // Create default state if UI controller not ready
    const defaultState = {
      barrel: { color: 0xD4A574, finish: 'glossy' },
      handle: { color: 0x1a1a1a, finish: 'matte', gripStyle: 'smooth' },
      knob: { color: 0x1a1a1a }
    };

    this.materialController.updateColor('barrel', defaultState.barrel.color);
    this.materialController.updateFinish('barrel', defaultState.barrel.finish);
    
    this.materialController.updateColor('handle', defaultState.handle.color);
    this.materialController.updateFinish('handle', defaultState.handle.finish);
    this.materialController.updateGripStyle(defaultState.handle.gripStyle);
    
    this.materialController.updateColor('knob', defaultState.knob.color);
  }

  _onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    // Cleanup resources
  }
}

// Initialize application
const app = new BatConfigurator();
app.init();

