import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PMREMGenerator } from "three";

class BatModelManager {
  constructor(scene) {
    this.scene = scene;
    this.batModel = null;
    this.batGroup = null;
    this.regions = {
      barrel: null,
      handle: null,
      knob: null,
      knobFace: null,
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
          console.log("Model loaded successfully:", object);
          this.batModel = object;
          this._processModel();
          console.log("Model processed, batGroup:", this.batGroup);
          resolve(object);
        },
        (progress) => {
          console.log("Loading progress:", progress);
        },
        (error) => {
          console.error("Error loading model:", error);
          reject(error);
        }
      );
    });
  }

  _processModel() {
    if (!this.batModel) return;

    this.batGroup = new THREE.Group();
    this.batGroup.name = "batGroup";
    this.batGroup.position.set(0, 0, 0);
    this.scene.add(this.batGroup);

    const box = new THREE.Box3().setFromObject(this.batModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.originalBounds = {
      min: box.min.clone(),
      max: box.max.clone(),
      center: center.clone(),
      size: size.clone(),
    };

    this.batModel.position.sub(center);
    this.batModel.position.set(0, 0, 0);

    this.batModel.rotation.set(0, Math.PI / 2, 0);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.0;
    this.batModel.scale.set(scale, scale, scale);

    this.batGroup.add(this.batModel);

    const scaledBox = new THREE.Box3().setFromObject(this.batModel);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    if (
      Math.abs(scaledCenter.x) > 0.001 ||
      Math.abs(scaledCenter.y) > 0.001 ||
      Math.abs(scaledCenter.z) > 0.001
    ) {
      this.batModel.position.sub(scaledCenter);
      const recenteredBox = new THREE.Box3().setFromObject(this.batModel);
      this.originalBounds.min = recenteredBox.min;
      this.originalBounds.max = recenteredBox.max;
      this.originalBounds.size = recenteredBox.getSize(new THREE.Vector3());
      this.originalBounds.center = new THREE.Vector3(0, 0, 0);
    } else {
      this.originalBounds.min = scaledBox.min;
      this.originalBounds.max = scaledBox.max;
      this.originalBounds.size = scaledBox.getSize(new THREE.Vector3());
      this.originalBounds.center = new THREE.Vector3(0, 0, 0);
    }

    this._splitIntoRegions();
  }

  _splitIntoRegions() {
    const allMeshes = [];
    const allGroups = [];

    this.batModel.traverse((child) => {
      if (child.isMesh) {
        allMeshes.push(child);
      }
      if (
        child.type === "Group" ||
        (child.children && child.children.length > 0 && !child.isMesh)
      ) {
        allGroups.push(child);
      }
    });

    console.log("Found meshes:", allMeshes.length, "groups:", allGroups.length);

    let handleMesh = null;
    let barrelMesh = null;
    let handleGroup = null;
    let barrelGroup = null;

    for (const mesh of allMeshes) {
      const name = mesh.name ? mesh.name.toLowerCase() : "";
      if (name.includes("handle")) {
        handleMesh = mesh;
      }
      if (name.includes("barrel")) {
        barrelMesh = mesh;
      }
    }

    for (const group of allGroups) {
      const name = group.name ? group.name.toLowerCase() : "";
      if (name.includes("handle")) {
        handleGroup = group;
      }
      if (name.includes("barrel")) {
        barrelGroup = group;
      }
    }

    if (!handleMesh && !barrelMesh && allMeshes.length === 2) {
      console.log("Found 2 meshes, assuming first is Handle, second is Barrel");
      handleMesh = allMeshes[0];
      barrelMesh = allMeshes[1];
    }

    let handleGeometry = null;
    let barrelGeometry = null;

    if (handleGroup) {
      const handleMeshes = [];
      handleGroup.traverse((child) => {
        if (child.isMesh) {
          handleMeshes.push(child);
        }
      });

      if (handleMeshes.length === 1) {
        handleGeometry = handleMeshes[0].geometry.clone();
      } else if (handleMeshes.length > 1) {
        handleGeometry = this._mergeGeometries(
          handleMeshes.map((m) => m.geometry)
        );
      }
    } else if (handleMesh) {
      handleGeometry = handleMesh.geometry.clone();
    }

    if (barrelGroup) {
      const barrelMeshes = [];
      barrelGroup.traverse((child) => {
        if (child.isMesh) {
          barrelMeshes.push(child);
        }
      });

      if (barrelMeshes.length === 1) {
        barrelGeometry = barrelMeshes[0].geometry.clone();
      } else if (barrelMeshes.length > 1) {
        barrelGeometry = this._mergeGeometries(
          barrelMeshes.map((m) => m.geometry)
        );
      }
    } else if (barrelMesh) {
      barrelGeometry = barrelMesh.geometry.clone();
    }

    if (handleGeometry && barrelGeometry) {
      console.log(
        "Successfully extracted Handle and Barrel geometries from OBJ groups"
      );

      console.log("Handle vertices:", handleGeometry.attributes.position.count);
      console.log("Barrel vertices:", barrelGeometry.attributes.position.count);

      if (handleMesh) {
        handleGeometry.applyMatrix4(handleMesh.matrixWorld);
      }

      if (barrelMesh) {
        barrelGeometry.applyMatrix4(barrelMesh.matrixWorld);
      }

      this.regions.handle = handleGeometry;
      this.regions.barrel = barrelGeometry;

      if (this.regions.handle) {
        this._extractKnobFromHandle();
      }

      const combinedGeometry = this._mergeGeometries([
        handleGeometry.clone(),
        barrelGeometry.clone(),
      ]);

      this.geometryMap.set("original", combinedGeometry);

      if (handleGroup && handleGroup.parent) {
        handleGroup.parent.remove(handleGroup);
      }

      if (barrelGroup && barrelGroup.parent) {
        barrelGroup.parent.remove(barrelGroup);
      }

      if (handleMesh && handleMesh.parent) {
        handleMesh.parent.remove(handleMesh);
      }

      if (barrelMesh && barrelMesh.parent) {
        barrelMesh.parent.remove(barrelMesh);
      }

      return;
    }

    console.log("Groups not found, using coordinate-based splitting");
    const meshes = [];

    this.batModel.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
      }
    });

    if (meshes.length === 0) {
      console.warn("No meshes found in model");
      return;
    }

    let sourceGeometry = null;

    if (meshes.length === 1) {
      sourceGeometry = meshes[0].geometry.clone();
    } else {
      sourceGeometry = meshes[0].geometry.clone();
      console.log(
        `Multiple meshes found (${meshes.length}), using first mesh geometry`
      );
    }

    if (!sourceGeometry || !sourceGeometry.attributes.position) {
      console.error("Invalid geometry - no position attribute");
      return;
    }

    const positions = sourceGeometry.attributes.position.array;

    const bounds = this.originalBounds;

    const xRange = bounds.max.x - bounds.min.x;
    const yRange = bounds.max.y - bounds.min.y;
    const zRange = bounds.max.z - bounds.min.z;

    let useAxis = "y";
    let axisIndex = 1;
    let minVal, maxVal, range;

    if (xRange >= yRange && xRange >= zRange) {
      useAxis = "x";
      axisIndex = 0;
      minVal = bounds.min.x;
      maxVal = bounds.max.x;
      range = xRange;
    } else if (zRange >= yRange && zRange >= xRange) {
      useAxis = "z";
      axisIndex = 2;
      minVal = bounds.min.z;
      maxVal = bounds.max.z;
      range = zRange;
    } else {
      useAxis = "y";
      axisIndex = 1;
      minVal = bounds.min.y;
      maxVal = bounds.max.y;
      range = yRange;
    }

    console.log("Splitting axis:", useAxis, "range:", range);

    const knobEnd = minVal + range * 0.15;
    const handleEnd = minVal + range * 0.4;

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

        const coord1 = positions[i1 * 3 + axisIndex];
        const coord2 = positions[i2 * 3 + axisIndex];
        const coord3 = positions[i3 * 3 + axisIndex];
        const avgCoord = (coord1 + coord2 + coord3) / 3;

        if (avgCoord <= knobEnd) {
          knobIndices.push(i1, i2, i3);
        } else if (avgCoord <= handleEnd) {
          handleIndices.push(i1, i2, i3);
        } else {
          barrelIndices.push(i1, i2, i3);
        }
      }
    } else {
      for (let i = 0; i < positions.length; i += 9) {
        const coord1 = positions[i + axisIndex];
        const coord2 = positions[i + 3 + axisIndex];
        const coord3 = positions[i + 6 + axisIndex];
        const avgCoord = (coord1 + coord2 + coord3) / 3;
        const baseIndex = i / 3;

        if (avgCoord <= knobEnd) {
          knobIndices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        } else if (avgCoord <= handleEnd) {
          handleIndices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        } else {
          barrelIndices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        }
      }
    }

    console.log("Region indices:", {
      knob: knobIndices.length,
      handle: handleIndices.length,
      barrel: barrelIndices.length,
    });

    this.regions.knob = this._createRegionGeometry(sourceGeometry, knobIndices);

    this.regions.handle = this._createRegionGeometry(
      sourceGeometry,
      handleIndices
    );

    this.regions.barrel = this._createRegionGeometry(
      sourceGeometry,
      barrelIndices
    );

    if (!this.regions.barrel && !this.regions.handle && !this.regions.knob) {
      console.warn(
        "All regions failed to create, using full geometry as fallback"
      );
      this.regions.barrel = sourceGeometry.clone();
    }

    if (this.regions.knob) {
      this._splitKnobIntoFaceAndBody();
    }

    meshes.forEach((mesh) => {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
    });

    if (this.batModel && this.batModel.parent) {
      this.batModel.parent.remove(this.batModel);
    }

    this.geometryMap.set("original", sourceGeometry);
  }

  _mergeGeometries(geometries) {
    if (geometries.length === 0) return null;
    if (geometries.length === 1) return geometries[0].clone();

    const merged = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let indexOffset = 0;

    for (const geometry of geometries) {
      const pos = geometry.attributes.position;
      const norm = geometry.attributes.normal;
      const uv = geometry.attributes.uv;
      const index = geometry.index;

      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          positions.push(
            pos.array[i * 3],
            pos.array[i * 3 + 1],
            pos.array[i * 3 + 2]
          );

          if (norm) {
            normals.push(
              norm.array[i * 3],
              norm.array[i * 3 + 1],
              norm.array[i * 3 + 2]
            );
          }

          if (uv) {
            uvs.push(uv.array[i * 2], uv.array[i * 2 + 1]);
          }
        }
      }

      if (index) {
        for (let i = 0; i < index.count; i++) {
          indices.push(index.array[i] + indexOffset);
        }
        indexOffset += pos ? pos.count : 0;
      }
    }

    merged.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    if (normals.length > 0) {
      merged.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(normals, 3)
      );
    } else {
      merged.computeVertexNormals();
    }

    if (uvs.length > 0) {
      merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    }

    if (indices.length > 0) {
      merged.setIndex(indices);
    }

    merged.computeBoundingSphere();
    return merged;
  }

  _extractKnobFromHandle() {
    if (!this.regions.handle) return;

    const handleGeometry = this.regions.handle;
    const positions = handleGeometry.attributes.position.array;
    const bounds = new THREE.Box3();

    for (let i = 0; i < positions.length; i += 3) {
      bounds.expandByPoint(
        new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2])
      );
    }

    const size = bounds.getSize(new THREE.Vector3());
    const min = bounds.min;

    let axisIndex = 0;
    let maxRange = size.x;
    if (size.y > maxRange) {
      axisIndex = 1;
      maxRange = size.y;
    }
    if (size.z > maxRange) {
      axisIndex = 2;
      maxRange = size.z;
    }

    const knobEnd = min.getComponent(axisIndex) + maxRange * 0.15;

    const knobIndices = [];
    const handleIndices = [];

    const index = handleGeometry.index;
    if (index) {
      const indexArray = index.array;
      for (let i = 0; i < indexArray.length; i += 3) {
        const i1 = indexArray[i];
        const i2 = indexArray[i + 1];
        const i3 = indexArray[i + 2];

        const coord1 = positions[i1 * 3 + axisIndex];
        const coord2 = positions[i2 * 3 + axisIndex];
        const coord3 = positions[i3 * 3 + axisIndex];
        const avgCoord = (coord1 + coord2 + coord3) / 3;

        if (avgCoord <= knobEnd) {
          knobIndices.push(i1, i2, i3);
        } else {
          handleIndices.push(i1, i2, i3);
        }
      }
    }

    if (knobIndices.length > 0) {
      this.regions.knob = this._createRegionGeometry(
        handleGeometry,
        knobIndices
      );
      this.regions.handle = this._createRegionGeometry(
        handleGeometry,
        handleIndices
      );
      this._splitKnobIntoFaceAndBody();
    }
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
          newUVs.push(sourceUVs.array[uvIdx], sourceUVs.array[uvIdx + 1]);
        }

        newIndex++;
      }

      newIndices.push(indexMap.get(oldIndex));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(newPositions, 3)
    );

    if (newNormals.length > 0) {
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(newNormals, 3)
      );
    } else {
      geometry.computeVertexNormals();
    }

    if (newUVs.length > 0) {
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(newUVs, 2));
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
      console.warn(
        "Knob geometry has no index, cannot split into face and body"
      );
      return;
    }

    if (!normals) {
      knobGeometry.computeVertexNormals();
      normals = knobGeometry.attributes.normal;
      if (!normals) return;
    }

    const knobBox = new THREE.Box3();
    for (let i = 0; i < positions.length; i += 3) {
      knobBox.expandByPoint(
        new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2])
      );
    }
    const knobSize = knobBox.getSize(new THREE.Vector3());
    const knobMin = knobBox.min;
    const knobMax = knobBox.max;

    const maxDim = Math.max(knobSize.x, knobSize.y, knobSize.z);
    let faceAxis = "x";
    let faceEnd = knobMin.x;
    let faceThreshold = 0;

    if (knobSize.x === maxDim) {
      faceAxis = "x";
      const xRange = knobMax.x - knobMin.x;
      faceThreshold = xRange * 0.15;
    } else if (knobSize.y === maxDim) {
      faceAxis = "y";
      const yRange = knobMax.y - knobMin.y;
      faceThreshold = yRange * 0.15;
    } else {
      faceAxis = "z";
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
      if (faceAxis === "x") {
        avgPos = (x1 + x2 + x3) / 3;
        avgNormal = (nx1 + nx2 + nx3) / 3;
        const isAtMinEnd = avgPos <= knobMin.x + faceThreshold;
        const isAtMaxEnd = avgPos >= knobMax.x - faceThreshold;
        const normalPointsOut =
          (isAtMinEnd && avgNormal < -0.5) || (isAtMaxEnd && avgNormal > 0.5);
        const isFace = (isAtMinEnd || isAtMaxEnd) && normalPointsOut;

        if (isFace) {
          faceIndices.push(i1, i2, i3);
        } else {
          bodyIndices.push(i1, i2, i3);
        }
      } else if (faceAxis === "y") {
        avgPos = (y1 + y2 + y3) / 3;
        avgNormal = (ny1 + ny2 + ny3) / 3;
        const isAtMinEnd = avgPos <= knobMin.y + faceThreshold;
        const isAtMaxEnd = avgPos >= knobMax.y - faceThreshold;
        const normalPointsOut =
          (isAtMinEnd && avgNormal < -0.5) || (isAtMaxEnd && avgNormal > 0.5);
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
        const normalPointsOut =
          (isAtMinEnd && avgNormal < -0.5) || (isAtMaxEnd && avgNormal > 0.5);
        const isFace = (isAtMinEnd || isAtMaxEnd) && normalPointsOut;

        if (isFace) {
          faceIndices.push(i1, i2, i3);
        } else {
          bodyIndices.push(i1, i2, i3);
        }
      }
    }

    if (faceIndices.length > 0) {
      this.regions.knobFace = this._createRegionGeometry(
        knobGeometry,
        faceIndices
      );

      if (bodyIndices.length > 0) {
        this.regions.knob = this._createRegionGeometry(
          knobGeometry,
          bodyIndices
        );
      }
    }
  }

  getRegionMesh(regionName) {
    const actualRegionName =
      regionName === "knobFace" ? "knobFace" : regionName;

    if (!this.regions[actualRegionName]) {
      console.warn(`No geometry found for region: ${actualRegionName}`);
      return null;
    }

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

      if (!geometry || !geometry.attributes || !geometry.attributes.position) {
        console.error(`Invalid geometry for region: ${actualRegionName}`);
        return null;
      }

      const positionCount = geometry.attributes.position.count;
      if (positionCount === 0) {
        console.warn(`Empty geometry for region: ${actualRegionName}`);
        return null;
      }

      let defaultColor = 0x1e3a5f;
      if (actualRegionName === "handle") {
        defaultColor = 0xd4a574;
      } else if (
        actualRegionName === "knob" ||
        actualRegionName === "knobFace"
      ) {
        defaultColor = 0x1a1a1a; //
      }

      const material = new THREE.MeshStandardMaterial({
        color: defaultColor,
        metalness: 0.2,
        roughness: 0.6,
        envMapIntensity: 1.0,
      });

      mesh = new THREE.Mesh(geometry, material);
      mesh.userData.region = actualRegionName;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();

      if (this.batGroup) {
        this.batGroup.add(mesh);
        console.log(
          `Added ${actualRegionName} mesh to batGroup, vertices: ${positionCount}`
        );
      } else {
        this.scene.add(mesh);
        console.log(
          `Added ${actualRegionName} mesh to scene, vertices: ${positionCount}`
        );
      }

      const materialController = window.batConfigurator?.materialController;
      if (materialController?.pendingMaterials?.has(actualRegionName)) {
        const options =
          materialController.pendingMaterials.get(actualRegionName);
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
    const barrelMesh = this.getRegionMesh("barrel");
    if (!barrelMesh) return;

    barrelMesh.userData.cupStyle = style;
  }

  updateTorpedo(enabled) {
    const barrelMesh = this.getRegionMesh("barrel");
    if (!barrelMesh) return;

    if (enabled) {
      barrelMesh.userData.torpedoScale = 1.05;
    } else {
      barrelMesh.userData.torpedoScale = 1.0;
    }
  }

  updateKnobStyle(style) {
    const knobMesh = this.getRegionMesh("knob");
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
    this.pendingMaterials = new Map();
    this.presetColors = {
      barrel: [
        { name: "Blue", color: 0x169ad1 },
        { name: "Black", color: 0x000000 },
        { name: "Dark Red", color: 0x4a0c00 },
        { name: "Red", color: 0x8f1b02 },
        { name: "Dark Gray", color: 0x32333d },
        { name: "Crimson", color: 0x910c0c },
        { name: "Purple", color: 0x5e2440 },
        { name: "Tan", color: 0xd79462 },
        { name: "Dark Green", color: 0x06170b },
        { name: "Gray", color: 0x80766d },
        { name: "Cream", color: 0xe6e1d4 },
        { name: "Navy Blue", color: 0x132041 },
        { name: "Orange", color: 0xe64016 },
        { name: "Pink", color: 0xee1c65 },
        { name: "Violet", color: 0x8451b8 },
        { name: "Bright Red", color: 0xc90000 },
        { name: "Sky Blue", color: 0x0f56b1 },
        { name: "Yellow", color: 0xe2d14d },
      ],
      handle: [
        { name: "Natural Wood", color: 0xd4a574 },
        { name: "Black", color: 0x1a1a1a },
        { name: "Brown", color: 0x8b4513 },
        { name: "Blue", color: 0x2563eb },
        { name: "Red", color: 0xdc2626 },
        { name: "Grey", color: 0x6b7280 },
      ],
      knob: [
        { name: "Black", color: 0x1a1a1a },
        { name: "Blue", color: 0x2563eb },
        { name: "Red", color: 0xdc2626 },
        { name: "White", color: 0xf5f5f5 },
      ],
    };

    this.engravingText = null;
    this.engravingCanvas = null;
    this._initEnvironment().catch((err) =>
      console.error("Error initializing environment:", err)
    );
  }

  async _initEnvironment() {
    const pmremGenerator = new PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();

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
      color: options.color !== undefined ? options.color : 0xffffff,
      metalness: options.metalness !== undefined ? options.metalness : 0.2,
      roughness: options.roughness !== undefined ? options.roughness : 0.6,
      envMap: this.envMap,
      envMapIntensity:
        options.envMapIntensity !== undefined ? options.envMapIntensity : 1.2,
    });

    material.needsUpdate = true;

    if (regionName === "handle" && options.useWoodTexture) {
      const woodTexture = this._createWoodTexture();
      material.map = woodTexture;
    }

    return material;
  }

  _createWoodTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    const baseColor = "#D4A574";
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#B8956A";
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
    if (!batManager) {
      console.error("BatManager not found!");
      return;
    }

    const mesh = batManager.getRegionMesh(regionName);
    if (!mesh) {
      console.warn(
        `Mesh not found for region: ${regionName}, storing for later`
      );
      if (!this.pendingMaterials) this.pendingMaterials = new Map();
      this.pendingMaterials.set(regionName, options);
      return;
    }

    if (mesh.userData.region !== regionName) {
      console.error(
        `Mesh region mismatch! Expected: ${regionName}, Got: ${mesh.userData.region}`
      );
      return;
    }

    const material = this.getMaterial(regionName, options);

    if (mesh.material) {
      if (mesh.material.map) {
        mesh.material.map.dispose();
      }
      if (mesh.material.dispose) {
        mesh.material.dispose();
      }
    }

    mesh.material = material;

    material.needsUpdate = true;

    console.log(`✅ Updated material for region: ${regionName}`, {
      color: options.color ? `#${options.color.toString(16)}` : "unchanged",
      meshRegion: mesh.userData.region,
      materialColor: `#${material.color.getHex().toString(16)}`,
    });
  }

  updateColor(regionName, color) {
    const colorValue =
      typeof color === "string" ? parseInt(color.replace("#", ""), 16) : color;

    console.log(
      `Updating color for region: ${regionName}`,
      `Color: #${colorValue.toString(16)}`
    );

    if (regionName === "knob") {
      const batManager = window.batConfigurator?.modelManager;
      const targetRegion =
        batManager && batManager.regions.knobFace ? "knobFace" : "knob";
      const options = this._getRegionOptions(targetRegion);
      options.color = colorValue;
      this.updateRegionMaterial(targetRegion, options);
    } else if (regionName === "barrel") {
      const batManager = window.batConfigurator?.modelManager;
      const barrelMesh = batManager?.getRegionMesh("barrel");

      if (!barrelMesh) {
        console.error("Barrel mesh not found!");
        return;
      }

      const options = this._getRegionOptions("barrel");
      options.color = colorValue;

      console.log("Updating barrel color:", {
        meshRegion: barrelMesh.userData.region,
        newColor: `#${colorValue.toString(16)}`,
        meshExists: !!barrelMesh,
      });

      this.updateRegionMaterial("barrel", options);
    } else if (regionName === "handle") {
      const options = this._getRegionOptions("handle");
      options.color = colorValue;
      options.useWoodTexture = true; // Preserve wood texture
      this.updateRegionMaterial("handle", options);
    } else {
      const options = this._getRegionOptions(regionName);
      options.color = colorValue;
      this.updateRegionMaterial(regionName, options);
    }
  }

  updateFinish(regionName, finish) {
    const options = this._getRegionOptions(regionName);

    if (finish === "glossy") {
      options.roughness = 0.1;
      options.metalness = 0.1;
      options.envMapIntensity = 1.5;
    } else if (finish === "matte") {
      options.roughness = 0.9;
      options.metalness = 0.0;
      options.envMapIntensity = 0.8;
    }

    if (regionName === "handle") {
      options.useWoodTexture = true;
    }

    this.updateRegionMaterial(regionName, options);
  }

  updateGripStyle(style) {
    const options = this._getRegionOptions("handle");
    options.useWoodTexture = true;

    switch (style) {
      case "smooth":
        options.roughness = 0.3;
        break;
      case "wrapped":
        options.roughness = 0.7;
        break;
      case "taper":
        options.roughness = 0.5;
        break;
    }

    this.updateRegionMaterial("handle", options);
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
      envMapIntensity: mat.envMapIntensity || 1.0,
    };
  }

  getPresetColors(regionName) {
    return this.presetColors[regionName] || [];
  }

  addEngraving(text) {
    const batManager = window.batConfigurator?.modelManager;
    if (!batManager) return;

    const barrelMesh = batManager.getRegionMesh("barrel");
    if (!barrelMesh) return;

    if (this.engravingText) {
      const batGroup = batManager?.getBatGroup();
      if (batGroup && this.engravingText.parent === batGroup) {
        batGroup.remove(this.engravingText);
      } else if (this.engravingText.parent) {
        this.engravingText.parent.remove(this.engravingText);
      }

      if (this.engravingText.material) {
        if (this.engravingText.material.map)
          this.engravingText.material.map.dispose();
        this.engravingText.material.dispose();
      }
      if (this.engravingText.geometry) {
        this.engravingText.geometry.dispose();
      }

      this.engravingText = null;
    }

    if (!text || text.trim() === "") return;

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 120px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const box = new THREE.Box3().setFromObject(barrelMesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const textWidth = Math.min(text.length * 0.6, size.x * 0.5);
    const textHeight = size.z * 0.2;
    const geometry = new THREE.PlaneGeometry(textWidth, textHeight);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      emissive: 0xffffff,
      emissiveIntensity: 0.6,
    });

    const textMesh = new THREE.Mesh(geometry, material);
    textMesh.position.set(center.x, center.y + size.y * 0.5 + 0.1, center.z);
    textMesh.rotation.x = -Math.PI / 2;

    const batGroup =
      batManager?.getBatGroup() || barrelMesh.parent || this.scene;
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
        color: 0x132041,
        finish: "glossy",
        cupStyle: "full",
        torpedo: false,
        engraving: "",
      },

      handle: {
        color: 0xd4a574,
        gripStyle: "smooth",
        finish: "matte",
      },

      knob: {
        sticker: null,
        style: "round",
      },
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
    const tabs = document.querySelectorAll(".tab");
    const tabContents = document.querySelectorAll(".tab-content");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetTab = tab.dataset.tab;

        tabs.forEach((t) => t.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));

        tab.classList.add("active");
        document.getElementById(`${targetTab}-tab`).classList.add("active");

        if (targetTab !== "specs") {
          const configurator = window.batConfigurator;
          if (configurator?.cameraController) {
            configurator.cameraController.setView(targetTab);
          }
        }
      });
    });
  }

  _initColorPickers() {
    this._createColorPicker(
      "barrel",
      this.materialController.getPresetColors("barrel")
    );

    this._createColorPicker(
      "handle",
      this.materialController.getPresetColors("handle")
    );

    this._createKnobStickerPicker();
  }

  _createColorPicker(regionName, presetColors) {
    const container = document.getElementById(`${regionName}-color-picker`);
    if (!container) return;

    container.innerHTML = "";

    presetColors.forEach((preset) => {
      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      const hexColor = `#${preset.color.toString(16).padStart(6, "0")}`;
      swatch.style.backgroundColor = hexColor;
      swatch.title = preset.name;

      if (this.state[regionName].color === preset.color) {
        swatch.classList.add("active");
      }

      swatch.addEventListener("click", () => {
        this._selectColor(regionName, preset.color);
        container
          .querySelectorAll(".color-swatch")
          .forEach((s) => s.classList.remove("active"));
        swatch.classList.add("active");

        if (regionName === "barrel") {
          const label = container
            .closest(".control-group")
            .querySelector(".control-label");
          if (label) {
            label.textContent = `Barrel Color - ${preset.name}`;
          }
        }
      });

      container.appendChild(swatch);
    });

    const customBtn = document.createElement("div");
    customBtn.className = "custom-color-btn";
    customBtn.innerHTML = "+";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = `#${this.state[regionName].color
      .toString(16)
      .padStart(6, "0")}`;

    customBtn.addEventListener("click", () => colorInput.click());
    colorInput.addEventListener("change", (e) => {
      const color = parseInt(e.target.value.replace("#", ""), 16);
      this._selectColor(regionName, color);
    });

    customBtn.appendChild(colorInput);
    container.appendChild(customBtn);
  }

  _createKnobStickerPicker() {
    const container = document.getElementById("knob-sticker-picker");
    if (!container) return;

    container.innerHTML = "";

    // Create "None" option first
    const noneOption = document.createElement("div");
    noneOption.className = "knob-sticker active";
    noneOption.dataset.sticker = "none";
    noneOption.innerHTML = '<div style="width: 100%; height: 100%; border-radius: 50%; background: #f5f5f5; border: 2px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #666;">None</div>';
    noneOption.title = "None";

    noneOption.addEventListener("click", () => {
      this._selectKnobSticker(null);
      container
        .querySelectorAll(".knob-sticker")
        .forEach((s) => s.classList.remove("active"));
      noneOption.classList.add("active");
      this._updateKnobStickerLabel("None");
    });

    container.appendChild(noneOption);

    // Create sticker options for knob1.png through knob15.png
    for (let i = 1; i <= 15; i++) {
      const sticker = document.createElement("div");
      sticker.className = "knob-sticker";
      sticker.dataset.sticker = `knob${i}`;
      
      const img = document.createElement("img");
      img.src = `assests/img/knob${i}.png`;
      img.alt = `Knob Sticker ${i}`;
      img.onerror = function() {
        this.style.display = "none";
        sticker.innerHTML = `<div style="width: 100%; height: 100%; border-radius: 50%; background: #f5f5f5; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #666;">${i}</div>`;
      };
      
      sticker.appendChild(img);
      sticker.title = `Knob Sticker ${i}`;

      sticker.addEventListener("click", () => {
        this._selectKnobSticker(`knob${i}`);
        container
          .querySelectorAll(".knob-sticker")
          .forEach((s) => s.classList.remove("active"));
        sticker.classList.add("active");
        this._updateKnobStickerLabel(`Knob Sticker ${i}`);
      });

      container.appendChild(sticker);
    }
  }

  _updateKnobStickerLabel(stickerName) {
    const label = document
      .getElementById("knob-sticker-picker")
      ?.closest(".control-group")
      ?.querySelector(".control-label");
    if (label) {
      label.textContent = `Knob Sticker - ${stickerName}`;
    }
  }

  _selectKnobSticker(stickerName) {
    this.state.knob.sticker = stickerName;
    console.log(`🎨 Selecting knob sticker: ${stickerName || "None"}`);
    
    // Apply sticker to knob face if available
    const batManager = window.batConfigurator?.modelManager;
    if (!batManager) return;

    const knobFaceMesh = batManager.getRegionMesh("knobFace");
    if (knobFaceMesh && stickerName) {
      // Load texture from sticker image
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        `assests/img/${stickerName}.png`,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          
          const material = knobFaceMesh.material;
          if (material) {
            if (material.map) {
              material.map.dispose();
            }
            material.map = texture;
            material.needsUpdate = true;
          }
        },
        undefined,
        (error) => {
          console.error("Error loading knob sticker texture:", error);
        }
      );
    } else if (knobFaceMesh && !stickerName) {
      // Remove texture if "None" is selected
      const material = knobFaceMesh.material;
      if (material && material.map) {
        material.map.dispose();
        material.map = null;
        material.needsUpdate = true;
      }
    }
  }

  _selectColor(regionName, color) {
    this.state[regionName].color = color;

    console.log(
      `🎨 Selecting color for ${regionName}:`,
      `#${color.toString(16)}`
    );
    this.materialController.updateColor(regionName, color);
  }

  _initControls() {
    document.querySelectorAll("#barrel-tab [data-finish]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const finish = btn.dataset.finish;
        this.state.barrel.finish = finish;
        this.materialController.updateFinish("barrel", finish);
        document
          .querySelectorAll("#barrel-tab [data-finish]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    document.querySelectorAll("#barrel-tab [data-cup]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cupStyle = btn.dataset.cup;
        this.state.barrel.cupStyle = cupStyle;
        this.modelManager.updateCupStyle(cupStyle);
        document
          .querySelectorAll("#barrel-tab [data-cup]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    const torpedoSwitch = document.getElementById("torpedo-switch");
    torpedoSwitch.addEventListener("click", () => {
      torpedoSwitch.classList.toggle("active");
      const enabled = torpedoSwitch.classList.contains("active");
      this.state.barrel.torpedo = enabled;
      this.modelManager.updateTorpedo(enabled);
    });

    const engravingInput1 = document.getElementById("engraving-text-1");
    const charCount1 = document.getElementById("char-count-1");
    if (engravingInput1 && charCount1) {
      engravingInput1.addEventListener("input", (e) => {
        const text = e.target.value;
        this.state.barrel.engraving = text;
        charCount1.textContent = `${text.length}/25`;
        this.materialController.addEngraving(text);
      });
    }

    const engravingInput2 = document.getElementById("engraving-text-2");
    const charCount2 = document.getElementById("char-count-2");
    if (engravingInput2 && charCount2) {
      engravingInput2.addEventListener("input", (e) => {
        const text = e.target.value;
        const text1 = engravingInput1 ? engravingInput1.value : "";
        const combinedText =
          text1 && text ? `${text1} / ${text}` : text || text1;
        this.state.barrel.engraving = combinedText;
        charCount2.textContent = `${text.length}/25`;
        this.materialController.addEngraving(combinedText);
      });
    }

    document.querySelectorAll("#handle-tab [data-grip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const gripStyle = btn.dataset.grip;
        this.state.handle.gripStyle = gripStyle;
        this.materialController.updateGripStyle(gripStyle);
        document
          .querySelectorAll("#handle-tab [data-grip]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    document.querySelectorAll("#handle-tab [data-finish]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const finish = btn.dataset.finish;
        this.state.handle.finish = finish;
        this.materialController.updateFinish("handle", finish);
        document
          .querySelectorAll("#handle-tab [data-finish]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    document.querySelectorAll("#knob-tab [data-knob]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const knobStyle = btn.dataset.knob;
        this.state.knob.style = knobStyle;
        this.modelManager.updateKnobStyle(knobStyle);
        document
          .querySelectorAll("#knob-tab [data-knob]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });
  }

  _initCameraControls() {
    const zoomOutBtn = document.getElementById("zoom-out");
    const zoomInBtn = document.getElementById("zoom-in");

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => {
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
      zoomInBtn.addEventListener("click", () => {
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
      knob: { x: Math.PI, y: 0, z: 0 },
      barrel: { x: 0, y: Math.PI / 2, z: 0 },
      handle: { x: 0, y: Math.PI / 2, z: 0 },
      full: { x: 0, y: Math.PI / 4, z: 0 },
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

      const eased =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.currentRotation.x =
        startRotation.x + (this.targetRotation.x - startRotation.x) * eased;
      this.currentRotation.y =
        startRotation.y + (this.targetRotation.y - startRotation.y) * eased;
      this.currentRotation.z =
        startRotation.z + (this.targetRotation.z - startRotation.z) * eased;

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
    this.currentView = "full";
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

    const delay = viewName === "knob" ? 600 : 200;
    setTimeout(() => {
      this._updateCameraForRegion(viewName);
    }, delay);
  }

  _updateCameraForRegion(regionName) {
    if (!this.bounds) return;

    const maxDim = Math.max(
      this.bounds.size.x,
      this.bounds.size.y,
      this.bounds.size.z
    );

    let targetPosition, targetLookAt;

    const regionCenter = this.rotationController
      ? this.rotationController.getRegionCenter(regionName)
      : new THREE.Vector3(0, 0, 0);

    console.log("Setting camera view for region:", regionName);
    switch (regionName) {
      case "knob":
        targetPosition = new THREE.Vector3(
          regionCenter.x,
          regionCenter.y - maxDim * 0.8,
          regionCenter.z - maxDim * 0.5
        );

        targetLookAt = regionCenter.clone();
        this._applyConstraints({
          enableRotate: true,
          enablePan: false,
          minDistance: maxDim * 0.6,
          maxDistance: maxDim * 1.2,
          maxPolarAngle: Math.PI / 1.5,
          minPolarAngle: Math.PI / 6,
        });

        break;

      case "barrel":
        const barrelMesh = this.modelManager.getRegionMesh("barrel");
        let barrelDistance = maxDim * 0.8;

        if (barrelMesh) {
          const barrelBox = new THREE.Box3().setFromObject(barrelMesh);
          const barrelSize = barrelBox.getSize(new THREE.Vector3());
          const barrelMaxDim = Math.max(
            barrelSize.x,
            barrelSize.y,
            barrelSize.z
          );
          barrelDistance = barrelMaxDim * 4;
        }

        targetPosition = new THREE.Vector3(
          regionCenter.x,
          regionCenter.y,
          regionCenter.z + barrelDistance
        );

        targetLookAt = regionCenter.clone();
        this._applyConstraints({
          enableRotate: true,
          enablePan: false,
          minDistance: barrelDistance * 0.5,
          maxDistance: barrelDistance * 2,
          maxPolarAngle: Math.PI / 2.02,
          minPolarAngle: Math.PI / 2.02,
        });
        break;

      case "handle":
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
          minPolarAngle: Math.PI / 3,
        });

        break;

      default:
        targetPosition = new THREE.Vector3(
          maxDim * 2,
          maxDim * 1.5,
          maxDim * 2
        );

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
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minPolarAngle = 0;
  }

  updateBounds(bounds) {
    this.bounds = bounds;
  }

  _animateTo(targetPosition, targetLookAt) {
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth ease for target (keeps knob perfectly centered)
      const easedTarget =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Ease-out with a slight overshoot for camera position (premium feel)
      const easeOutBack = (t) => {
        const s = 1.1; // low overshoot for subtle motion
        t -= 1;
        return 1 + t * t * ((s + 1) * t + s);
      };

      const easedPosition = easeOutBack(progress);

      // Base position along the path with overshoot
      const basePosition = new THREE.Vector3().lerpVectors(
        startPosition,
        targetPosition,
        easedPosition
      );

      // Subtle dolly-in toward the end of the animation (last 15%)
      let finalPosition = basePosition;
      if (progress > 0.85) {
        const local = (progress - 0.85) / 0.15; // 0 → 1 over last 15%
        const dollyEase = local * local; // ease-in
        const maxDolly = 0.08; // 8% closer at peak

        const toTarget = new THREE.Vector3().subVectors(
          targetLookAt,
          basePosition
        );
        const currentDist = toTarget.length();
        if (currentDist > 0.0001) {
          toTarget.normalize();
          const dollyAmount = currentDist * maxDolly * dollyEase;
          finalPosition = basePosition.clone().add(
            toTarget.multiplyScalar(dollyAmount)
          );
        }
      }

      this.camera.position.copy(finalPosition);

      // Target moves with smooth, non-overshooting ease so knob stays centered
      this.controls.target.lerpVectors(startTarget, targetLookAt, easedTarget);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Hard-set final camera/target to avoid drift and keep knob perfectly centered
        this.camera.position.copy(targetPosition);
        this.controls.target.copy(targetLookAt);
        this.controls.update();

        // After knob animation completes, lock controls tightly around knob
        if (this.currentView === "knob") {
          const knobCenter = targetLookAt.clone();
          const distance = this.camera.position.distanceTo(knobCenter);

          this.controls.enablePan = false;
          this.controls.minDistance = distance * 0.9;
          this.controls.maxDistance = distance * 1.1;
          this.controls.minPolarAngle = Math.PI / 3;
          this.controls.maxPolarAngle = Math.PI / 2.2;

          this.camera.lookAt(knobCenter);
          this.controls.target.copy(knobCenter);
          this.controls.update();
        }
      }
    };

    animate();
  }
}

class ClickHandler {
  constructor(camera, scene, modelManager, uiController) {
    this.camera = camera;
    this.scene = scene;
    this.modelManager = modelManager;
    this.uiController = uiController;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectedRegion = null;
    this.hoveredRegion = null;
    this.mouseDownPos = null;
    this.isDragging = false;

    this._initEventListeners();
  }

  _initEventListeners() {
    const rendererDom = document.querySelector("canvas");

    if (rendererDom) {
      rendererDom.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
          this.mouseDownPos = { x: e.clientX, y: e.clientY };
          this.isDragging = false;
        }
      });

      rendererDom.addEventListener("mousemove", (e) => {
        this._onMouseMove(e);

        if (this.mouseDownPos) {
          const dx = Math.abs(e.clientX - this.mouseDownPos.x);
          const dy = Math.abs(e.clientY - this.mouseDownPos.y);
          if (dx > 5 || dy > 5) {
            this.isDragging = true;
          }
        }
      });

      rendererDom.addEventListener("mouseup", (e) => {
        if (e.button === 0 && !this.isDragging && this.mouseDownPos) {
          this._onClick(e);
        }

        this.mouseDownPos = null;
        this.isDragging = false;
      });

      rendererDom.style.cursor = "default";
    }
  }

  _getMousePosition(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();

    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _onClick(event) {
    this._getMousePosition(event);

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const batGroup = this.modelManager.getBatGroup();
    if (!batGroup) return;

    const meshes = [];
    batGroup.traverse((child) => {
      if (child.isMesh && child.userData.region) {
        meshes.push(child);
      }
    });

    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const regionName = clickedMesh.userData.region;

      if (regionName) {
        event.stopPropagation();
        this._selectRegion(regionName);
      }
    }
  }

  _onMouseMove(event) {
    this._getMousePosition(event);

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const batGroup = this.modelManager.getBatGroup();
    if (!batGroup) return;

    const meshes = [];

    batGroup.traverse((child) => {
      if (child.isMesh && child.userData.region) {
        meshes.push(child);
      }
    });

    const intersects = this.raycaster.intersectObjects(meshes, true);

    const canvas = event.target;
    if (intersects.length > 0) {
      canvas.style.cursor = "pointer";
      this._highlightRegion(intersects[0].object.userData.region, true);
    } else {
      canvas.style.cursor = "default";
      this._highlightRegion(null, false);
    }
  }

  _selectRegion(regionName) {
    const regionToTab = {
      barrel: "barrel",
      handle: "handle",
      knob: "knob",
      knobFace: "knob",
    };

    const tabName = regionToTab[regionName] || "barrel";

    const tabs = document.querySelectorAll(".tab");
    const tabContents = document.querySelectorAll(".tab-content");

    tabs.forEach((tab) => {
      if (tab.dataset.tab === tabName) {
        tabs.forEach((t) => t.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));

        tab.classList.add("active");
        document.getElementById(`${tabName}-tab`).classList.add("active");

        const configurator = window.batConfigurator;
        if (configurator?.cameraController) {
          configurator.cameraController.setView(tabName);
        }
      }
    });

    this.selectedRegion = regionName;

    this._highlightRegion(regionName, true);

    setTimeout(() => {
      this._highlightRegion(regionName, false);
    }, 500);
  }

  _highlightRegion(regionName, highlight) {
    const batGroup = this.modelManager.getBatGroup();
    if (!batGroup) return;

    batGroup.traverse((child) => {
      if (child.isMesh && child.userData.region) {
        if (highlight && child.userData.region === regionName) {
          if (child.material) {
            child.userData.originalEmissive =
              child.material.emissive?.getHex() || 0x000000;
            child.material.emissive.setHex(0x444444);
            child.material.emissiveIntensity = 0.3;
          }
          this.hoveredRegion = regionName;
        } else if (!highlight) {
          if (child.material && child.userData.originalEmissive !== undefined) {
            child.material.emissive.setHex(child.userData.originalEmissive);
            child.material.emissiveIntensity = 0;
            delete child.userData.originalEmissive;
          }
          if (child.userData.region === this.hoveredRegion) {
            this.hoveredRegion = null;
          }
        }
      }
    });
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
    this.clickHandler = null;
    this.animationId = null;
  }

  async init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    this.camera = new THREE.PerspectiveCamera(
      35,

      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    const container = document.getElementById("canvas-container");
    const containerWidth = container
      ? container.clientWidth
      : window.innerWidth;
    const containerHeight = container
      ? container.clientHeight
      : window.innerHeight * 0.6;

    this.renderer.setSize(containerWidth, containerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    document
      .getElementById("canvas-container")
      .appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.autoRotate = false;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this._setupLighting();

    this.modelManager = new BatModelManager(this.scene);
    this.materialController = new MaterialController(this.scene, this.renderer);

    try {
      await this.modelManager.loadModel("baseball.obj");

      const bounds = this.modelManager.getBounds();
      if (bounds) {
        const size = bounds.size;
        const maxDim = Math.max(size.x, size.y, size.z);

        if (maxDim > 0) {
          const batLength = maxDim;
          const batHeight = Math.min(size.x, size.y, size.z);

          const distance = batLength * 1.8;
          this.camera.position.set(
            distance * 0.5,
            distance * 0.4,
            distance * 0.7
          );
          this.camera.lookAt(0, 0, 0);
          this.controls.target.set(0, 0, 0);
          this.controls.minDistance = Math.max(distance * 0.4, 0.1);
          this.controls.maxDistance = Math.max(distance * 3.0, 100);
          this.controls.update();
        } else {
          console.warn("Invalid model bounds, using default camera position");
          this.camera.position.set(40, 25, 35);
          this.camera.lookAt(0, 0, 0);
          this.controls.target.set(0, 0, 0);
          this.controls.update();
        }
      }

      const batGroup = this.modelManager.getBatGroup();
      this.rotationController = new ModelRotationController(batGroup);

      this.cameraController = new CameraController(
        this.camera,
        this.controls,
        this.modelManager,
        this.rotationController
      );

      if (bounds && this.cameraController) {
        this.cameraController.updateBounds(bounds);
      }

      const barrelMesh = this.modelManager.getRegionMesh("barrel");
      const handleMesh = this.modelManager.getRegionMesh("handle");
      const knobMesh = this.modelManager.getRegionMesh("knob");

      if (this.modelManager.regions.knobFace) {
        this.modelManager.getRegionMesh("knobFace");
      }

      const meshesCreated = {
        barrel: !!barrelMesh,
        handle: !!handleMesh,
        knob: !!knobMesh,
        batGroup: !!batGroup,
        sceneChildren: this.scene.children.length,
        batGroupChildren: batGroup ? batGroup.children.length : 0,
      };

      console.log("Region meshes created:", meshesCreated);

      if (!barrelMesh && !handleMesh && !knobMesh) {
        console.warn("All region meshes failed to create, attempting fallback");
        const originalGeometry = this.modelManager.geometryMap.get("original");
        if (originalGeometry && batGroup) {
          const fallbackMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e3a5f,
          });

          const fallbackMesh = new THREE.Mesh(
            originalGeometry,
            fallbackMaterial
          );

          fallbackMesh.userData.region = "barrel";
          batGroup.add(fallbackMesh);
          console.log("Added fallback mesh with full geometry");
        }
      }

      if (batGroup) {
        batGroup.updateMatrixWorld(true);
        const updatedBox = new THREE.Box3().setFromObject(batGroup);
        const updatedSize = updatedBox.getSize(new THREE.Vector3());
        const updatedMaxDim = Math.max(
          updatedSize.x,
          updatedSize.y,
          updatedSize.z
        );

        console.log("Updated bounds:", {
          size: updatedSize,
          maxDim: updatedMaxDim,
          center: updatedBox.getCenter(new THREE.Vector3()),
        });

        if (updatedMaxDim > 0) {
          const batLength = updatedMaxDim;
          const batHeight = Math.min(
            updatedSize.x,
            updatedSize.y,
            updatedSize.z
          );

          const distance = batLength * 1.8;
          this.camera.position.set(
            distance * 0.5,
            distance * 0.4,
            distance * 0.7
          );
          this.camera.lookAt(0, 0, 0);
          this.controls.target.set(0, 0, 0);
          this.controls.minDistance = Math.max(distance * 0.4, 0.1);
          this.controls.maxDistance = Math.max(distance * 3.0, 100);
          this.controls.minPolarAngle = 0;
          this.controls.maxPolarAngle = Math.PI;
          this.controls.enableRotate = true;
          this.controls.enablePan = true;
          this.controls.update();
          console.log(
            "Camera positioned at:",
            this.camera.position,
            "Distance:",
            distance
          );
        } else {
          console.warn(
            "Invalid bounds after mesh creation, using default camera"
          );
          this.camera.position.set(40, 25, 35);
          this.camera.lookAt(0, 0, 0);
          this.controls.target.set(0, 0, 0);
          this.controls.minPolarAngle = 0;
          this.controls.maxPolarAngle = Math.PI;
          this.controls.enableRotate = true;
          this.controls.enablePan = true;
          this.controls.update();
        }
      }

      this._initializeMaterials();

      this.uiController = new UIStateController(
        this.modelManager,
        this.materialController
      );

      this.clickHandler = new ClickHandler(
        this.camera,
        this.scene,
        this.modelManager,
        this.uiController
      );

      const loadingOverlay = document.getElementById("loading-overlay");
      const uiPanel = document.getElementById("ui-panel");

      if (loadingOverlay) {
        loadingOverlay.style.display = "none";
      }

      if (uiPanel) {
        uiPanel.style.display = "block";
      }

      this.animate();
    } catch (error) {
      console.error("Error loading model:", error);
      const loadingText = document
        .getElementById("loading-overlay")
        .querySelector(".loading-text");
      if (loadingText) {
        loadingText.textContent = "Error loading model: " + error.message;
      }
    }

    window.addEventListener("resize", () => this._onWindowResize());

    window.batConfigurator = this;
  }

  _setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-5, 3, -5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(0, 0, -8);
    this.scene.add(rimLight);
  }

  _initializeMaterials() {
    const defaultState = {
      barrel: { color: 0x132041, finish: "glossy" },
      handle: {
        color: 0xd4a574,
        finish: "matte",
        gripStyle: "smooth",
        useWoodTexture: true,
      },
      knob: { color: 0x1a1a1a },
    };

    this.materialController.updateColor("barrel", defaultState.barrel.color);
    this.materialController.updateFinish("barrel", defaultState.barrel.finish);

    const handleMesh = this.modelManager.getRegionMesh("handle");
    if (handleMesh) {
      const handleOptions = {
        color: defaultState.handle.color,
        roughness: 0.7,
        metalness: 0.0,
        envMapIntensity: 1.3,
        useWoodTexture: true,
      };
      this.materialController.updateRegionMaterial("handle", handleOptions);
    }

    const knobMesh = this.modelManager.getRegionMesh("knob");
    if (knobMesh) {
      const knobOptions = {
        color: defaultState.knob.color,
        roughness: 0.5,
        metalness: 0.1,
        envMapIntensity: 1.2,
      };
      this.materialController.updateRegionMaterial("knob", knobOptions);
    }

    if (this.modelManager.regions.knobFace) {
      const knobFaceMesh = this.modelManager.getRegionMesh("knobFace");
      if (knobFaceMesh) {
        const knobFaceOptions = {
          color: defaultState.knob.color,
          roughness: 0.5,
          metalness: 0.1,
          envMapIntensity: 1.2,
        };

        this.materialController.updateRegionMaterial(
          "knobFace",
          knobFaceOptions
        );
      }
    }
  }

  _onWindowResize() {
    const container = document.getElementById("canvas-container");
    const containerWidth = container
      ? container.clientWidth
      : window.innerWidth;
    const containerHeight = container
      ? container.clientHeight
      : window.innerHeight * 0.6;

    this.camera.aspect = containerWidth / containerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(containerWidth, containerHeight);

    if (this.modelManager) {
      const bounds = this.modelManager.getBounds();
      if (bounds) {
        const size = bounds.size;
        const maxDim = Math.max(size.x, size.y, size.z);
        const batLength = maxDim;
        const distance = batLength * 1.8;

        const currentDistance = this.camera.position.length();
        if (Math.abs(currentDistance - distance) > 0.1) {
          const direction = this.camera.position.clone().normalize();
          this.camera.position.copy(direction.multiplyScalar(distance));
          this.camera.position.set(
            distance * 0.5,
            distance * 0.4,
            distance * 0.7
          );
          this.camera.lookAt(0, 0, 0);
          this.controls.target.set(0, 0, 0);
          this.controls.update();
        }
      }
    }
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

const app = new BatConfigurator();
app.init();
