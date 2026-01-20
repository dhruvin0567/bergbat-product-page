import { useRef, useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import * as THREE from 'three'
import baseballBatModel from '../assets/model/baseball.obj?url'
import { createTextTexture } from '../utils/canvasTextTexture'

function BaseballBatModel({ handleColor, barrelColor, barrelText }) {
  const baseObj = useLoader(OBJLoader, baseballBatModel)

  const scene = useMemo(() => baseObj.clone(true), [baseObj])

  const groupRef = useRef()
  const handleMeshesRef = useRef([])
  const barrelMeshesRef = useRef([])
  const textMeshesRef = useRef([])
  const logoTextureRef = useRef(null)

  useEffect(() => {
    if (!scene || !groupRef.current) return
    handleMeshesRef.current = []
    barrelMeshesRef.current = []
    textMeshesRef.current = []

    const box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    scene.position.sub(center)
    scene.rotation.x = -Math.PI / 2

    const rotatedBox = new THREE.Box3().setFromObject(scene)
    const size = rotatedBox.getSize(new THREE.Vector3())
    const maxSide = Math.max(size.x, size.y, size.z)
    const desiredLength = 4.8
    const scale = desiredLength / maxSide
    groupRef.current.scale.set(scale, scale, scale)

    const findGroupName = (mesh) => {
      let current = mesh
      while (current) {
        if (current.name === 'Handle' || current.name === 'Barrel') {
          return current.name
        }
        current = current.parent
      }
      return null;
    }

    scene.traverse((child) => {
      if (child.isMesh) {
        const groupName = findGroupName(child)
        const isHandle = groupName === 'Handle'

        child.material = new THREE.MeshStandardMaterial({
          color: isHandle ? (handleColor || '#D6C1AD') : (barrelColor || '#D6C1AD'),
          metalness: 0.1,
          roughness: 0.6,
          side: THREE.FrontSide,
        })

        child.castShadow = true
        child.receiveShadow = true

        if (isHandle) {
          handleMeshesRef.current.push(child)
        } else {
          barrelMeshesRef.current.push(child)

          const textMaterial = new THREE.MeshStandardMaterial({
            color: '#FFFFFF',
            transparent: true,
            opacity: 1,
            metalness: 0.0,
            roughness: 0.8,
            map: null,
            side: THREE.FrontSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
          })

          const textMesh = new THREE.Mesh(child.geometry, textMaterial)
          textMesh.name = "BarrelTextOverlay"
          textMesh.position.copy(child.position)
          textMesh.rotation.copy(child.rotation)
          textMesh.scale.copy(child.scale)

          child.parent.add(textMesh)
          textMeshesRef.current.push(textMesh)
        }
      }
    })
  }, [scene])

  useEffect(() => {
    const color = new THREE.Color(handleColor || '#D6C1AD')
    handleMeshesRef.current.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.color.copy(color)
      }
    })
  }, [handleColor])

  useEffect(() => {
    const color = new THREE.Color(barrelColor || '#D6C1AD')
    barrelMeshesRef.current.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.color.copy(color)
      }
    })
  }, [barrelColor])

  useEffect(() => {
    const textLines = barrelText ? [barrelText] : []

    if (!logoTextureRef.current) {
      logoTextureRef.current = createTextTexture(textLines, {
        width: 2048,
        height: 512,
        fontSize: [35, 80, 25],
        fontWeight: '900',
        fontFamily: 'Arial, sans-serif',
        textColor: '#000000ff',
        backgroundColor: 'transparent',
        textAlign: 'center'
      })
    } else {
      logoTextureRef.current.dispose()
      logoTextureRef.current = createTextTexture(textLines, {
        width: 2048,
        height: 512,
        fontSize: [35, 80, 25],
        fontWeight: '900',
        textColor: '#000000ff',
        backgroundColor: 'transparent',
        textAlign: 'center'
      })
    }

    const texture = logoTextureRef.current
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping

    texture.repeat.set(1, 1)
    texture.offset.set(1, 0.1);

    textMeshesRef.current.forEach((mesh) => {
      if (!mesh.material) return
      mesh.material.map = texture
      mesh.material.needsUpdate = true
    })

  }, [barrelText])

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group >
  )
}

export default function BaseballBat({ handleColor, barrelColor, barrelText }) {
  return (
    <>
      <ambientLight intensity={1.2} />

      <directionalLight
        position={[10, 10, 10]}
        intensity={0.8}
        castShadow
      />

      <directionalLight
        position={[-10, 10, -10]}
        intensity={0.6}
      />

      <directionalLight
        position={[0, -10, 0]}
        intensity={0.4}
      />

      <hemisphereLight
        skyColor={0xffffff}
        groundColor={0xcccccc}
        intensity={0.6}
      />

      <pointLight position={[5, 5, 5]} intensity={0.5} />
      <pointLight position={[-5, 5, -5]} intensity={0.5} />
      <pointLight position={[0, 0, 10]} intensity={0.3} />

      <BaseballBatModel
        handleColor={handleColor}
        barrelColor={barrelColor}
        barrelText={barrelText}
      />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableRotate={true}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
        enableDamping={true}
        dampingFactor={0.1}
        rotateSpeed={0.3}
      />
    </>
  )
}
