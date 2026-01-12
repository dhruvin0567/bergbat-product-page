import { useRef, useEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import * as THREE from 'three'
import baseballBatModel from '../assets/model/baseball.obj?url'

function BaseballBatModel({ handleColor, barrelColor }) {
  const obj = useLoader(OBJLoader, baseballBatModel)
  const groupRef = useRef()
  const handleMeshesRef = useRef([])
  const barrelMeshesRef = useRef([])

  useEffect(() => {
    if (!obj || !groupRef.current) return

    const box = new THREE.Box3().setFromObject(obj)
    const center = box.getCenter(new THREE.Vector3())
    obj.position.sub(center)
    obj.rotation.x = -Math.PI / 2

    const rotatedBox = new THREE.Box3().setFromObject(obj)
    const size = rotatedBox.getSize(new THREE.Vector3())
    const maxSide = Math.max(size.x, size.y, size.z)
    const desiredLength = 4.8
    const scale = desiredLength / maxSide
    groupRef.current.scale.set(scale, scale, scale)

    handleMeshesRef.current = []
    barrelMeshesRef.current = []

    const findGroupName = (mesh) => {
      let current = mesh
      while (current) {
        if (current.name === 'Handle' || current.name === 'Barrel') {
          return current.name
        }
        current = current.parent
      }
      return null
    }

    obj.traverse((child) => {
      if (child.isMesh) {
        const groupName = findGroupName(child)
        
        let color
        const defaultHandleColor = '#8B4513' 
        const defaultBarrelColor = '#4169E1' 
        
        if (groupName === 'Handle') {
          color = new THREE.Color(handleColor || defaultHandleColor)
        } else if (groupName === 'Barrel') {
          color = new THREE.Color(barrelColor || defaultBarrelColor)
        } else {
          color = new THREE.Color(barrelColor || defaultBarrelColor)
        }

        child.material = new THREE.MeshStandardMaterial({
          color: color,
          metalness: 0.1,
          roughness: 0.6,
          emissive: 0x000000,
          emissiveIntensity: 0,
          toneMapped: true,
        })

        child.castShadow = true
        child.receiveShadow = true

        if (groupName === 'Handle') {
          handleMeshesRef.current.push(child)
        } else if (groupName === 'Barrel') {
          barrelMeshesRef.current.push(child)
        } else {
          barrelMeshesRef.current.push(child)
        }
      }
    })
  }, [obj])

  useEffect(() => {
    if (handleColor && handleMeshesRef.current.length > 0) {
      const color = new THREE.Color(handleColor)
      handleMeshesRef.current.forEach((mesh) => {
        if (mesh.material) {
          mesh.material.color.copy(color)
        }
      })
    }
  }, [handleColor])

  useEffect(() => {
    if (barrelColor && barrelMeshesRef.current.length > 0) {
      const color = new THREE.Color(barrelColor)
      barrelMeshesRef.current.forEach((mesh) => {
        if (mesh.material) {
          mesh.material.color.copy(color)
        }
      })
    }
  }, [barrelColor])

  return (
    <group ref={groupRef}>
      <primitive object={obj} />
    </group>
  )
}

export default function BaseballBat({ handleColor, barrelColor }) {
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
      
      <BaseballBatModel handleColor={handleColor} barrelColor={barrelColor} />
      
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