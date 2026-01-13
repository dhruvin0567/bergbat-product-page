import { useRef, useEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import * as THREE from 'three'
import baseballBatModel from '../assets/model/baseball.obj?url'
import { createTextTexture, updateTextTexture } from '../utils/canvasTextTexture'

function BaseballBatModel({ handleColor, barrelColor, barrelText }) {
  const obj = useLoader(OBJLoader, baseballBatModel)
  const groupRef = useRef()
  const handleMeshesRef = useRef([])
  const barrelMeshesRef = useRef([])
  const textTextureRef = useRef(null)

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
        const defaultColor = '#D6C1AD' 
        
        if (groupName === 'Handle') {
          color = new THREE.Color(handleColor || defaultColor)
        } else if (groupName === 'Barrel') {
          color = new THREE.Color(barrelColor || defaultColor)
        } else {
          color = new THREE.Color(barrelColor || defaultColor)
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
    if (handleMeshesRef.current.length > 0) {
      const defaultColor = '#D6C1AD'
      const color = new THREE.Color(handleColor || defaultColor)
      handleMeshesRef.current.forEach((mesh) => {
        if (mesh.material) {
          mesh.material.color.copy(color)
        }
      })
    }
  }, [handleColor])

  // Create or update text texture
  useEffect(() => {
    if (!barrelText || barrelMeshesRef.current.length === 0) {
      // Remove text texture if no text provided
      barrelMeshesRef.current.forEach((mesh) => {
        if (mesh.material && mesh.material.map) {
          mesh.material.map = null
          mesh.material.needsUpdate = true
        }
      })
      if (textTextureRef.current) {
        textTextureRef.current.dispose()
        textTextureRef.current = null
      }
      return
    }

    // Normalize text to array format
    const textLines = Array.isArray(barrelText) ? barrelText : [barrelText]

    // Create or update texture
    if (!textTextureRef.current) {
      textTextureRef.current = createTextTexture(textLines, {
        width: 2048,
        height: 512,
        fontSize: 100,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        textColor: '#1a1a1a', // Dark gray/black for printed effect
        lineHeight: 1.3,
      })
      
      // Configure texture wrapping for cylindrical barrel
      // Use ClampToEdge to prevent wrapping artifacts
      textTextureRef.current.wrapS = THREE.ClampToEdgeWrapping
      textTextureRef.current.wrapT = THREE.ClampToEdgeWrapping
      textTextureRef.current.repeat.set(1, 1)
      textTextureRef.current.offset.set(0, 0)
    } else {
      updateTextTexture(textTextureRef.current, textLines, {
        width: 2048,
        height: 512,
        fontSize: 100,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        textColor: '#1a1a1a',
        lineHeight: 1.3,
      })
    }

    // Apply texture to barrel meshes with proper blending for printed effect
    barrelMeshesRef.current.forEach((mesh) => {
      if (mesh.material) {
        const baseColor = new THREE.Color(barrelColor || '#D6C1AD')
        
        // Keep base color
        mesh.material.color.copy(baseColor)
        
        // Apply text texture as map
        // In MeshStandardMaterial, the map multiplies with the base color
        // White background (1,1,1) * baseColor = baseColor (shows through)
        // Dark text (low values) * baseColor = darker color (printed effect)
        mesh.material.map = textTextureRef.current
        mesh.material.transparent = false // No transparency needed with white background
        
        // Ensure proper texture filtering for crisp text
        if (textTextureRef.current) {
          textTextureRef.current.minFilter = THREE.LinearFilter
          textTextureRef.current.magFilter = THREE.LinearFilter
          textTextureRef.current.generateMipmaps = false
        }
        
        // Maintain realistic material properties
        mesh.material.metalness = 0.1
        mesh.material.roughness = 0.6
        
        mesh.material.needsUpdate = true
      }
    })
  }, [barrelText, barrelColor])

  useEffect(() => {
    if (barrelMeshesRef.current.length > 0) {
      const defaultColor = '#D6C1AD'
      const color = new THREE.Color(barrelColor || defaultColor)
      barrelMeshesRef.current.forEach((mesh) => {
        if (mesh.material) {
          mesh.material.color.copy(color)
          mesh.material.needsUpdate = true
        }
      })
    }
  }, [barrelColor])

  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      if (textTextureRef.current) {
        textTextureRef.current.dispose()
        textTextureRef.current = null
      }
    }
  }, [])

  return (
    <group ref={groupRef}>
      <primitive object={obj} />
    </group>
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