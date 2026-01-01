import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PMREMGenerator } from 'three';

class BatModelManager {
  constructor(scene) {
    this.scene = scene;
    this.batModel = null;
    this.batGroup = null;
    this.regions = {
      barrel: null,
      handle: null,
      knob: null,
      knobFace: null
    };
    this.originalBounds = null;
    this.geometryMap = new Map();
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

    this.batGroup = new THREE.Group();
    this.batGroup.name = 'batGroup';
    this.scene.add(this.batGroup);

    const box = new THREE.Box3().setFromObject(this.batModel);
    this.originalBounds = {
      min: box.min.clone(),
      max: box.max.clone(),
      center: box.getCenter(new THREE.Vector3()),
      size: box.getSize(new THREE.Vector3())
    };

    this.batModel.position.sub(this.originalBounds.center);
    
    // Rotate bat to horizontal position (around X axis)
    this.batModel.rotation.x = -Math.PI / 2;

    const maxDim = Math.max(this.originalBounds.size.x, this.originalBounds.size.y, this.originalBounds.size.z);
    const scale = 20 / maxDim;
    this.batModel.scale.multiplyScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(this.batModel);
    this.originalBounds.min = scaledBox.min;
    this.originalBounds.max = scaledBox.max;
    this.originalBounds.size = scaledBox.getSize(new THREE.Vector3());

    this._splitIntoRegions();
  }

  _splitIntoRegions() {
    const meshes = [];
    this.batModel.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
      }
    });

    if (meshes.length === 0) return;

    let sourceGeometry = meshes[0].geometry.clone();
    
    const positions = sourceGeometry.attributes.position.array;

    const yMin = this.originalBounds.min.y;
    const yMax = this.originalBounds.max.y;
    const yRange = yMax - yMin;
    
    const knobEnd = yMin + yRange * 0.15;        
    const handleEnd = yMin + yRange * 0.40;      

    const knobIndices = [];
    const handleIndices = [];
    const barrelIndices = [];

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

    this.regions.knob = this._createRegionGeometry(sourceGeometry, knobIndices);
    this.regions.handle = this._createRegionGeometry(sourceGeometry, handleIndices);
    this.regions.barrel = this._createRegionGeometry(sourceGeometry, barrelIndices);
    
    if (this.regions.knob) {
      this._splitKnobIntoFaceAndBody();
    }

    meshes.forEach(mesh => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      } else {
        this.scene.remove(mesh);
      }
    });

    this.geometryMap.set('original', sourceGeometry);
  }

  _createRegionGeometry(sourceGeometry, indices) {
    if (indices.length === 0) return null;

    const indexMap = new Map(); 
    const newIndices = [];
    const newPositions = [];
    const newNormals = [];
    const newUVs = [];

    const sourcePositions = sourceGeometry.attributes.position;
    const sourceNormals = sourceGeometry.attributes.normal;
    const sourceUVs = sourceGeometry.attributes.uv;

    let newIndex = 0;

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

  _splitKnobIntoFaceAndBody() {
    if (!this.regions.knob) return;

    const knobGeometry = this.regions.knob;
    const positions = knobGeometry.attributes.position.array;
    let normals = knobGeometry.attributes.normal;
    const index = knobGeometry.index;

    if (!index) {
      console.warn('Knob geometry has no index, cannot split into face and body');
      return;
    }

    if (!normals) {
      knobGeometry.computeVertexNormals();
      normals = knobGeometry.attributes.normal;
      if (!normals) return;
    }

    const knobBox = new THREE.Box3();
    for (let i = 0; i < positions.length; i += 3) {
      knobBox.expandByPoint(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
    }
    const knobSize = knobBox.getSize(new THREE.Vector3());
    const knobMin = knobBox.min;
    const knobMax = knobBox.max;

    const maxDim = Math.max(knobSize.x, knobSize.y, knobSize.z);
    let faceAxis = 'x';
    let faceEnd = knobMin.x;
    let faceThreshold = 0;

    if (knobSize.x === maxDim) {
      faceAxis = 'x';
      const xRange = knobMax.x - knobMin.x;
      faceThreshold = xRange * 0.15; 
    } else if (knobSize.y === maxDim) {
      faceAxis = 'y';
      const yRange = knobMax.y - knobMin.y;
      faceThreshold = yRange * 0.15;
    } else {
      faceAxis = 'z';
      const zRange = knobMax.z - knobMin.z;
      faceThreshold = zRange * 0.15;
    }

    const faceIndices = [];
    const bodyIndices = [];
    const indexArray = index.array;
    const normalArray = normals.array;

    for (let i = 0; i < indexArray.length; i += 3) {
      const i1 = indexArray[i];
      const i2 = indexArray[i + 1];
      const i3 = indexArray[i + 2];

      const x1 = positions[i1 * 3];
      const y1 = positions[i1 * 3 + 1];
      const z1 = positions[i1 * 3 + 2];
      const x2 = positions[i2 * 3];
      const y2 = positions[i2 * 3 + 1];
      const z2 = positions[i2 * 3 + 2];
      const x3 = positions[i3 * 3];
      const y3 = positions[i3 * 3 + 1];
      const z3 = positions[i3 * 3 + 2];

      const nx1 = normalArray[i1 * 3];
      const ny1 = normalArray[i1 * 3 + 1];
      const nz1 = normalArray[i1 * 3 + 2];
      const nx2 = normalArray[i2 * 3];
      const ny2 = normalArray[i2 * 3 + 1];
      const nz2 = normalArray[i2 * 3 + 2];
      const nx3 = normalArray[i3 * 3];
      const ny3 = normalArray[i3 * 3 + 1];
      const nz3 = normalArray[i3 * 3 + 2];

      let avgPos, avgNormal;
      if (faceAxis === 'x') {
        avgPos = (x1 + x2 + x3) / 3;
        avgNormal = (nx1 + nx2 + nx3) / 3;
        const isAtMinEnd = avgPos <= knobMin.x + faceThreshold;
        const isAtMaxEnd = avgPos >= knobMax.x - faceThreshold;
        const normalPointsOut = (isAtMinEnd && avgNormal < -0.5) || (isAtMaxEnd && avgNormal > 0.5);
        const isFace = (isAtMinEnd || isAtMaxEnd) && normalPointsOut;
        
        if (isFace) {
          faceIndices.push(i1, i2, i3);
        } else {
          bodyIndices.push(i1, i2, i3);
        }
      } else if (faceAxis === 'y') {
        avgPos = (y1 + y2 + y3) / 3;
        avgNormal = (ny1 + ny2 + ny3) / 3;
        const isAtMinEnd = avgPos <= knobMin.y + faceThreshold;
        const isAtMaxEnd = avgPos >= knobMax.y - faceThreshold;
        const normalPointsOut = (isAtMinEnd && avgNormal < -0.5) || (isAtMaxEnd && avgNormal > 0.5);
        const isFace = (isAtMinEnd || isAtMaxEnd) && normalPointsOut;
        
        if (isFace) {
          faceIndices.push(i1, i2, i3);
        } else {
          bodyIndices.push(i1, i2, i3);
        }

      } else {
        avgPos = (z1 + z2 + z3) / 3;
        avgNormal = (nz1 + nz2 + nz3) / 3;
        const isAtMinEnd = avgPos <= knobMin.z + faceThreshold;
        const isAtMaxEnd = avgPos >= knobMax.z - faceThreshold;
        const normalPointsOut = (isAtMinEnd && avgNormal < -0.5) || (isAtMaxEnd && avgNormal > 0.5);
        const isFace = (isAtMinEnd || isAtMaxEnd) && normalPointsOut;
        
        if (isFace) {
          faceIndices.push(i1, i2, i3);
        } else {
          bodyIndices.push(i1, i2, i3);
        }
      }
    }

    if (faceIndices.length > 0) {
      this.regions.knobFace = this._createRegionGeometry(knobGeometry, faceIndices);
      
      if (bodyIndices.length > 0) {
        this.regions.knob = this._createRegionGeometry(knobGeometry, bodyIndices);
      }
    }
  }

  getRegionMesh(regionName) {
    const actualRegionName = regionName === 'knobFace' ? 'knobFace' : regionName;
    
    if (!this.regions[actualRegionName]) return null;
    
    let mesh = null;
    if (this.batGroup) {
      this.batGroup.traverse((child) => {
        if (child.isMesh && child.userData.region === actualRegionName) {
          mesh = child;
        }
      });
    }

    if (!mesh) {
      const geometry = this.regions[actualRegionName];
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
      mesh = new THREE.Mesh(geometry, material);
      mesh.userData.region = actualRegionName;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      if (this.batGroup) {
        this.batGroup.add(mesh);
      } else {
        this.scene.add(mesh);
      }

      const materialController = window.batConfigurator?.materialController;
      if (materialController?.pendingMaterials?.has(actualRegionName)) {
        const options = materialController.pendingMaterials.get(actualRegionName);
        materialController.pendingMaterials.delete(actualRegionName);
        materialController.updateRegionMaterial(actualRegionName, options);
      }
    }

    return mesh;
  }

  getBatGroup() {
    return this.batGroup;
  }

  getBounds() {
    return this.originalBounds;
  }

  updateCupStyle(style) {
    const barrelMesh = this.getRegionMesh('barrel');
    if (!barrelMesh) return;

    barrelMesh.userData.cupStyle = style;
  }

  updateTorpedo(enabled) {
    const barrelMesh = this.getRegionMesh('barrel');
    if (!barrelMesh) return;

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

class MaterialController {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.envMap = null;
    this.materials = new Map();
    this.presetColors = {
      barrel: [
        { name: 'Navy Blue', color: 0x1e3a5f },
        { name: 'Blue', color: 0x2563eb },
        { name: 'Black', color: 0x1a1a1a },
        { name: 'Dark Brown', color: 0x5d4037 },
        { name: 'Reddish Brown', color: 0x8b4513 },
        { name: 'Dark Gray', color: 0x424242 },
        { name: 'Red', color: 0xdc2626 },
        { name: 'Purple', color: 0x7c3aed },
        { name: 'Natural Wood', color: 0xD4A574 },
        { name: 'Dark Green', color: 0x2e7d32 },
        { name: 'Light Gray', color: 0x9e9e9e },
        { name: 'Cream', color: 0xf5deb3 },
        { name: 'Navy Blue 2', color: 0x0d47a1 }
      ],
      handle: [
        { name: 'Natural Wood', color: 0xD4A574 },
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
    this.engravingText = null;
    this.engravingCanvas = null;
    this._initEnvironment();
  }

  async _initEnvironment() {
    const pmremGenerator = new PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    
    // Studio lighting setup
    const envLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    envLight1.position.set(2, 3, 2);
    envScene.add(envLight1);

    const envLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    envLight2.position.set(-2, 1, -2);
    envScene.add(envLight2);

    const envLight3 = new THREE.AmbientLight(0xffffff, 0.4);
    envScene.add(envLight3);

    const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
    this.envMap = renderTarget.texture;
    this.scene.environment = this.envMap;
    pmremGenerator.dispose();
  }

  getMaterial(regionName, options = {}) {
    const material = new THREE.MeshStandardMaterial({
      color: options.color || 0xffffff,
      metalness: options.metalness || 0.0,
      roughness: options.roughness || 0.7,
      envMap: this.envMap,
      envMapIntensity: options.envMapIntensity || 1.0,
    });

    // Add wood grain texture for handle
    if (regionName === 'handle' && options.useWoodTexture) {
      const woodTexture = this._createWoodTexture();
      material.map = woodTexture;
      material.roughness = 0.8;
      material.metalness = 0.0;
    }

    // Add painted barrel texture
    if (regionName === 'barrel') {
      material.roughness = options.roughness || 0.2;
      material.metalness = options.metalness || 0.1;
      material.envMapIntensity = options.envMapIntensity || 1.5;
    }

    return material;
  }

  _createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const baseColor = '#D4A574';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add wood grain lines
    ctx.strokeStyle = '#B8956A';
    ctx.lineWidth = 2;
    for (let i = 0; i < 50; i++) {
      const y = (i * canvas.height) / 50;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y + Math.sin(i * 0.5) * 3);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    return texture;
  }

  updateRegionMaterial(regionName, options) {
    const batManager = window.batConfigurator?.modelManager;
    if (!batManager) return;

    const mesh = batManager.getRegionMesh(regionName);
    if (!mesh) {
      if (!this.pendingMaterials) this.pendingMaterials = new Map();
      this.pendingMaterials.set(regionName, options);
      return;
    }

    const material = this.getMaterial(regionName, options);
    
    if (mesh.material) {
      if (mesh.material.map) mesh.material.map.dispose();
      if (mesh.material.dispose) mesh.material.dispose();
    }
    
    mesh.material = material;
  }

  updateColor(regionName, color) {
    if (regionName === 'knob') {
      const batManager = window.batConfigurator?.modelManager;
      const targetRegion = (batManager && batManager.regions.knobFace) ? 'knobFace' : 'knob';
      const options = this._getRegionOptions(targetRegion);
      options.color = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
      this.updateRegionMaterial(targetRegion, options);
    } else {
      const options = this._getRegionOptions(regionName);
      options.color = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
      
      // Preserve wood texture for handle
      if (regionName === 'handle') {
        options.useWoodTexture = true;
      }
      
      this.updateRegionMaterial(regionName, options);
    }
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

    // Preserve wood texture for handle
    if (regionName === 'handle') {
      options.useWoodTexture = true;
    }

    this.updateRegionMaterial(regionName, options);
  }

  updateGripStyle(style) {
    const options = this._getRegionOptions('handle');
    options.useWoodTexture = true;
    
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
    const batManager = window.batConfigurator?.modelManager;
    if (!batManager) return;

    const barrelMesh = batManager.getRegionMesh('barrel');
    if (!barrelMesh) return;

    // Remove existing engraving
    if (this.engravingText) {
      const batGroup = batManager?.getBatGroup();
      if (batGroup && this.engravingText.parent === batGroup) {
        batGroup.remove(this.engravingText);
      } else if (this.engravingText.parent) {
        this.engravingText.parent.remove(this.engravingText);
      }
      if (this.engravingText.material) {
        if (this.engravingText.material.map) this.engravingText.material.map.dispose();
        this.engravingText.material.dispose();
      }
      if (this.engravingText.geometry) {
        this.engravingText.geometry.dispose();
      }
      this.engravingText = null;
    }

    if (!text || text.trim() === '') return;

    // Create canvas for text
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Get barrel bounds to position text correctly
    const box = new THREE.Box3().setFromObject(barrelMesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Create plane for text - positioned on top of barrel
    const textWidth = Math.min(text.length * 0.6, size.x * 0.5);
    const textHeight = size.z * 0.2;
    const geometry = new THREE.PlaneGeometry(textWidth, textHeight);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      emissive: 0xffffff,
      emissiveIntensity: 0.6
    });

    const textMesh = new THREE.Mesh(geometry, material);
    // Position on top of barrel (since bat is rotated, Y is up)
    textMesh.position.set(center.x, center.y + size.y * 0.5 + 0.1, center.z);
    textMesh.rotation.x = -Math.PI / 2;
    
    const batGroup = batManager?.getBatGroup() || barrelMesh.parent || this.scene;
    batGroup.add(textMesh);
    this.engravingText = textMesh;
    barrelMesh.userData.engraving = text;
  }
}
class UIStateController {
  constructor(modelManager, materialController) {
    this.modelManager = modelManager;
    this.materialController = materialController;
    this.state = {
      barrel: {
        color: 0x1e3a5f,
        finish: 'glossy',
        cupStyle: 'full',
        torpedo: false,
        engraving: ''
      },
      handle: {
        color: 0xD4A574,
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

        if (targetTab !== 'specs') {
          const configurator = window.batConfigurator;
          if (configurator?.cameraController) {
            configurator.cameraController.setView(targetTab);
          }
        }
      });
    });
  }

  _initColorPickers() {
    this._createColorPicker('barrel', this.materialController.getPresetColors('barrel'));
    
    this._createColorPicker('handle', this.materialController.getPresetColors('handle'));
    
    this._createColorPicker('knob', this.materialController.getPresetColors('knob'));
  }

  _createColorPicker(regionName, presetColors) {
    const container = document.getElementById(`${regionName}-color-picker`);
    if (!container) return;

    container.innerHTML = '';

    presetColors.forEach(preset => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      const hexColor = `#${preset.color.toString(16).padStart(6, '0')}`;
      swatch.style.backgroundColor = hexColor;
      swatch.title = preset.name;
      
      if (this.state[regionName].color === preset.color) {
        swatch.classList.add('active');
      }

      swatch.addEventListener('click', () => {
        this._selectColor(regionName, preset.color);
        container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        
        // Update label if barrel
        if (regionName === 'barrel') {
          const label = container.closest('.control-group').querySelector('.control-label');
          if (label) {
            label.textContent = `Barrel Color - ${preset.name}`;
          }
        }
      });

      container.appendChild(swatch);
    });

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
    document.querySelectorAll('#barrel-tab [data-finish]').forEach(btn => {
      btn.addEventListener('click', () => {
        const finish = btn.dataset.finish;
        this.state.barrel.finish = finish;
        this.materialController.updateFinish('barrel', finish);
        document.querySelectorAll('#barrel-tab [data-finish]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.querySelectorAll('#barrel-tab [data-cup]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cupStyle = btn.dataset.cup;
        this.state.barrel.cupStyle = cupStyle;
        this.modelManager.updateCupStyle(cupStyle);
        document.querySelectorAll('#barrel-tab [data-cup]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const torpedoSwitch = document.getElementById('torpedo-switch');
    torpedoSwitch.addEventListener('click', () => {
      torpedoSwitch.classList.toggle('active');
      const enabled = torpedoSwitch.classList.contains('active');
      this.state.barrel.torpedo = enabled;
      this.modelManager.updateTorpedo(enabled);
    });

    const engravingInput = document.getElementById('engraving-text');
    const charCount = document.getElementById('char-count');
    if (engravingInput && charCount) {
      engravingInput.addEventListener('input', (e) => {
        const text = e.target.value;
        this.state.barrel.engraving = text;
        charCount.textContent = `${text.length}/25`;
        this.materialController.addEngraving(text);
      });
    }

    document.querySelectorAll('#handle-tab [data-grip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gripStyle = btn.dataset.grip;
        this.state.handle.gripStyle = gripStyle;
        this.materialController.updateGripStyle(gripStyle);
        document.querySelectorAll('#handle-tab [data-grip]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.querySelectorAll('#handle-tab [data-finish]').forEach(btn => {
      btn.addEventListener('click', () => {
        const finish = btn.dataset.finish;
        this.state.handle.finish = finish;
        this.materialController.updateFinish('handle', finish);
        document.querySelectorAll('#handle-tab [data-finish]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

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
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomInBtn = document.getElementById('zoom-in');
    
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        const configurator = window.batConfigurator;
        if (configurator?.camera) {
          const currentDistance = configurator.camera.position.length();
          const newDistance = Math.min(currentDistance * 1.2, 100);
          configurator.camera.position.normalize().multiplyScalar(newDistance);
          if (configurator.controls) {
            configurator.controls.update();
          }
        }
      });
    }
    
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        const configurator = window.batConfigurator;
        if (configurator?.camera) {
          const currentDistance = configurator.camera.position.length();
          const newDistance = Math.max(currentDistance * 0.8, 25);
          configurator.camera.position.normalize().multiplyScalar(newDistance);
          if (configurator.controls) {
            configurator.controls.update();
          }
        }
      });
    }
  }
}
class ModelRotationController {
  constructor(batGroup) {
    this.batGroup = batGroup;
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.targetRotation = { x: 0, y: 0, z: 0 };
    this.isAnimating = false;
    this.animationId = null;
  }

  setRotation(regionName) {
    if (!this.batGroup) return;

    const rotations = {
      knob: { x: 0, y: Math.PI / 2, z: 0 },       
      barrel: { x: 0, y: Math.PI, z: 0 },          
      handle: { x: 0, y: Math.PI / 2, z: 0 },      
      full: { x: 0, y: Math.PI / 4, z: 0 }         
    };

    const target = rotations[regionName] || rotations.full;
    this.targetRotation = { ...target };
    
    if (!this.isAnimating) {
      this._animateRotation();
    }
  }

  _animateRotation() {
    this.isAnimating = true;
    const startRotation = { ...this.currentRotation };
    const duration = 1000; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.currentRotation.x = startRotation.x + (this.targetRotation.x - startRotation.x) * eased;
      this.currentRotation.y = startRotation.y + (this.targetRotation.y - startRotation.y) * eased;
      this.currentRotation.z = startRotation.z + (this.targetRotation.z - startRotation.z) * eased;

      if (this.batGroup) {
        this.batGroup.rotation.x = this.currentRotation.x;
        this.batGroup.rotation.y = this.currentRotation.y;
        this.batGroup.rotation.z = this.currentRotation.z;
      }

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        this.currentRotation = { ...this.targetRotation };
      }
    };

    animate();
  }

  getRegionCenter(regionName) {
    const batManager = window.batConfigurator?.modelManager;
    if (!batManager) return new THREE.Vector3(0, 0, 0);

    const mesh = batManager.getRegionMesh(regionName);
    if (!mesh) return new THREE.Vector3(0, 0, 0);

    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    if (this.batGroup) {
      this.batGroup.updateMatrixWorld();
      center.applyMatrix4(this.batGroup.matrixWorld);
    }
    
    return center;
  }
}

class CameraController {
  constructor(camera, controls, modelManager, rotationController) {
    this.camera = camera;
    this.controls = controls;
    this.modelManager = modelManager;
    this.rotationController = rotationController;
    this.currentView = 'full';
    this.bounds = null;
    
    if (modelManager) {
      this.bounds = modelManager.getBounds();
    }
  }

  setView(viewName) {
    this.currentView = viewName;

    if (this.rotationController) {
      this.rotationController.setRotation(viewName);
    }

    const delay = viewName === 'knob' ? 600 : 200;
    setTimeout(() => {
      this._updateCameraForRegion(viewName);
    }, delay);
  }

  _updateCameraForRegion(regionName) {
    if (!this.bounds) return;

    const maxDim = Math.max(this.bounds.size.x, this.bounds.size.y, this.bounds.size.z);
    let targetPosition, targetLookAt;

    const regionCenter = this.rotationController 
      ? this.rotationController.getRegionCenter(regionName)
      : new THREE.Vector3(0, 0, 0);

    switch (regionName) {
      case 'knob':
        const knobMesh = this.modelManager.getRegionMesh('knob');
        let knobDistance = maxDim * 0.8; 
        
        if (knobMesh) {
          const knobBox = new THREE.Box3().setFromObject(knobMesh);
          const knobSize = knobBox.getSize(new THREE.Vector3());
          const knobMaxDim = Math.max(knobSize.x, knobSize.y, knobSize.z);
          knobDistance = knobMaxDim * 4; 
        }
        
        targetPosition = new THREE.Vector3(
          regionCenter.x,
          regionCenter.y,
          regionCenter.z + knobDistance
        );
        targetLookAt = regionCenter.clone();
        this._applyConstraints({
          enableRotate: true,
          enablePan: false,
          minDistance: knobDistance * 0.5,
          maxDistance: knobDistance * 2,
          maxPolarAngle: Math.PI / 2.02, 
          minPolarAngle: Math.PI / 2.02
        });

        break;

      case 'barrel':
        targetPosition = new THREE.Vector3(
          regionCenter.x,
          regionCenter.y,
          regionCenter.z + maxDim * 1.2
        );

        targetLookAt = regionCenter.clone();
        this._applyConstraints({
          enableRotate: true,
          enablePan: false,
          minDistance: maxDim * 0.8,
          maxDistance: maxDim * 1.5,
          maxPolarAngle: Math.PI / 1.8,
          minPolarAngle: Math.PI / 4
        });
        break;

      case 'handle':
        targetPosition = new THREE.Vector3(
          regionCenter.x,
          regionCenter.y + maxDim * 0.6,
          regionCenter.z + maxDim * 1.0
        );

        targetLookAt = regionCenter.clone();
        this._applyConstraints({
          enableRotate: true,
          enablePan: false,
          minDistance: maxDim * 0.7,
          maxDistance: maxDim * 1.4,
          maxPolarAngle: Math.PI / 2.2,
          minPolarAngle: Math.PI / 3
        });
        break;

      default: 
        targetPosition = new THREE.Vector3(maxDim * 2, maxDim * 1.5, maxDim * 2);
        targetLookAt = new THREE.Vector3(0, 0, 0);
        this._resetConstraints();
        break;
    }

    this._animateTo(targetPosition, targetLookAt);
  }

  _applyConstraints(constraints) {
    if (constraints.enableRotate !== undefined) {
      this.controls.enableRotate = constraints.enableRotate;
    }

    if (constraints.enablePan !== undefined) {
      this.controls.enablePan = constraints.enablePan;
    }

    if (constraints.minDistance !== undefined) {
      this.controls.minDistance = constraints.minDistance;
    }

    if (constraints.maxDistance !== undefined) {
      this.controls.maxDistance = constraints.maxDistance;
    }

    if (constraints.maxPolarAngle !== undefined) {
      this.controls.maxPolarAngle = constraints.maxPolarAngle;
    }

    if (constraints.minPolarAngle !== undefined) {
      this.controls.minPolarAngle = constraints.minPolarAngle;
    }
  }

  _resetConstraints() {
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.minPolarAngle = 0;
  }

  updateBounds(bounds) {
    this.bounds = bounds;
  }

  _animateTo(targetPosition, targetLookAt) {
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1000; // ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
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
    this.rotationController = null;
    this.animationId = null;
  }

  async init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Position camera for horizontal bat view
    this.camera.position.set(0, 8, 35);

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
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    document.getElementById('canvas-container').appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 25;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minPolarAngle = Math.PI / 2.05;
    this.controls.enablePan = false;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this._setupLighting();

    this.modelManager = new BatModelManager(this.scene);
    this.materialController = new MaterialController(this.scene, this.renderer);
    
    try {
      await this.modelManager.loadModel('baseball.obj');
      
      const batGroup = this.modelManager.getBatGroup();
      this.rotationController = new ModelRotationController(batGroup);
      
      this.cameraController = new CameraController(
        this.camera, 
        this.controls, 
        this.modelManager,
        this.rotationController
      );

      const bounds = this.modelManager.getBounds();
      if (bounds && this.cameraController) {
        this.cameraController.updateBounds(bounds);
      }
      
      this.modelManager.getRegionMesh('barrel');
      this.modelManager.getRegionMesh('handle');
      this.modelManager.getRegionMesh('knob');
      if (this.modelManager.regions.knobFace) {
        this.modelManager.getRegionMesh('knobFace');
      }
      
      this._initializeMaterials();
      
      this.uiController = new UIStateController(this.modelManager, this.materialController);
      
      document.getElementById('loading-overlay').style.display = 'none';
      document.getElementById('ui-panel').style.display = 'block';
      
      this.animate();
    } catch (error) {
      console.error('Error loading model:', error);
      const loadingText = document.getElementById('loading-overlay').querySelector('.loading-text');
      if (loadingText) {
        loadingText.textContent = 'Error loading model: ' + error.message;
      }
    }

    window.addEventListener('resize', () => this._onWindowResize());

    window.batConfigurator = this;
  }

  _setupLighting() {
    // Studio lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Key light from top-left
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(30, 40, 30);
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

    // Fill light to reduce harsh shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-25, 15, -25);
    this.scene.add(fillLight);

    // Rim light to define edges
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 20, -40);
    this.scene.add(rimLight);
  }

  _initializeMaterials() {
    const defaultState = {
      barrel: { color: 0x1e3a5f, finish: 'glossy' }, // Navy blue
      handle: { color: 0xD4A574, finish: 'matte', gripStyle: 'smooth', useWoodTexture: true }, // Natural wood
      knob: { color: 0x1a1a1a }
    };

    this.materialController.updateColor('barrel', defaultState.barrel.color);
    this.materialController.updateFinish('barrel', defaultState.barrel.finish);
    
    // Initialize handle with wood texture
    const handleMesh = this.modelManager.getRegionMesh('handle');
    if (handleMesh) {
      const handleOptions = {
        color: defaultState.handle.color,
        roughness: 0.8,
        metalness: 0.0,
        useWoodTexture: true
      };
      this.materialController.updateRegionMaterial('handle', handleOptions);
    }
    
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
  }
}

// Initialize application
const app = new BatConfigurator();
app.init();

