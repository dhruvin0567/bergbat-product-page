import React, { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import BaseballBat from './components/BaseballBat'
import ColorCustomizer from './components/ColorCustomizer'
import './App.css'

const App = () => {
  const getInitialColors = () => {
    const defaultColor = '#D6C1AD'
    
    const oldDefaults = ['#8B4513', '#4169E1', '#d3bfaa']
    
    let savedHandleColor = localStorage.getItem('handleColor')
    let savedBarrelColor = localStorage.getItem('barrelColor')
    
    if (savedHandleColor && oldDefaults.includes(savedHandleColor)) {
      savedHandleColor = null
      localStorage.removeItem('handleColor')
    }
    if (savedBarrelColor && oldDefaults.includes(savedBarrelColor)) {
      savedBarrelColor = null
      localStorage.removeItem('barrelColor')
    }
    
    const handleColor = savedHandleColor && savedHandleColor !== 'null' ? savedHandleColor : defaultColor
    const barrelColor = savedBarrelColor && savedBarrelColor !== 'null' ? savedBarrelColor : defaultColor
    
    return {
      handleColor,
      barrelColor
    }
  }

  const initialColors = getInitialColors()
  const [handleColor, setHandleColor] = useState(initialColors.handleColor)
  const [barrelColor, setBarrelColor] = useState(initialColors.barrelColor)

  useEffect(() => {
    if (handleColor) {
      localStorage.setItem('handleColor', handleColor)
    } else {
      localStorage.removeItem('handleColor')
    }
  }, [handleColor])

  useEffect(() => {
    localStorage.setItem('barrelColor', barrelColor)
  }, [barrelColor])

  return (
    <div className="app-container">
      <div className="canvas-wrapper">
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
        >
          <PerspectiveCamera
            makeDefault
            position={[0, 0, 9]}
            fov={15}    
          />
          <BaseballBat handleColor={handleColor} barrelColor={barrelColor} />
        </Canvas>
      </div>
      <ColorCustomizer
        handleColor={handleColor}
        barrelColor={barrelColor}
        onHandleColorChange={setHandleColor}
        onBarrelColorChange={setBarrelColor}
      />
    </div>
  )
}

export default App
