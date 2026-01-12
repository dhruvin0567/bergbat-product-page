import React, { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import BaseballBat from './components/BaseballBat'
import ColorCustomizer from './components/ColorCustomizer'
import './App.css'

const App = () => {
  const [handleColor, setHandleColor] = useState('#8B4513')
  const [barrelColor, setBarrelColor] = useState('#4169E1')

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
