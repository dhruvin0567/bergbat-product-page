import * as THREE from 'three'

/**
 * Creates a canvas texture with printed text for baseball bat barrel
 * @param {string|string[]} textLines - Single line or array of text lines to render
 * @param {Object} options - Configuration options
 * @returns {THREE.CanvasTexture} Canvas texture with transparent background
 */
export function createTextTexture(textLines, options = {}) {
  const {
    width = 2048,
    height = 512,
    fontSize = 120,
    fontFamily = 'Arial, sans-serif',
    fontWeight = 'bold',
    textColor = '#000000',
    backgroundColor = 'transparent',
    padding = 40,
    lineHeight = 1.4,
    textAlign = 'center',
    textBaseline = 'middle',
  } = options

  // Normalize textLines to array
  const lines = Array.isArray(textLines) ? textLines : [textLines]

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Fill with white background (will show base color when multiplied with material)
  ctx.fillStyle = backgroundColor === 'transparent' ? '#ffffff' : backgroundColor
  ctx.fillRect(0, 0, width, height)

  // Configure text rendering with better quality
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.fillStyle = textColor
  ctx.textAlign = textAlign
  ctx.textBaseline = textBaseline
  
  // Enable better text rendering
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Calculate total text height
  const totalTextHeight = lines.length * fontSize * lineHeight
  const startY = (height - totalTextHeight) / 2 + fontSize / 2

  // Draw each line of text
  lines.forEach((line, index) => {
    const y = startY + index * fontSize * lineHeight
    ctx.fillText(line, width / 2, y)
  })

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false // Important for proper UV mapping
  texture.needsUpdate = true

  return texture
}

/**
 * Updates an existing canvas texture with new text
 * @param {THREE.CanvasTexture} texture - Existing texture to update
 * @param {string|string[]} textLines - New text to render
 * @param {Object} options - Configuration options (same as createTextTexture)
 */
export function updateTextTexture(texture, textLines, options = {}) {
  const {
    width = 2048,
    height = 512,
    fontSize = 120,
    fontFamily = 'Arial, sans-serif',
    fontWeight = 'bold',
    textColor = '#000000',
    textAlign = 'center',
    textBaseline = 'middle',
    lineHeight = 1.4,
  } = options

  const lines = Array.isArray(textLines) ? textLines : [textLines]
  const canvas = texture.image

  if (!canvas) return

  const ctx = canvas.getContext('2d')

  // Fill with white background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Configure text rendering
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.fillStyle = textColor
  ctx.textAlign = textAlign
  ctx.textBaseline = textBaseline

  // Calculate total text height
  const totalTextHeight = lines.length * fontSize * lineHeight
  const startY = (height - totalTextHeight) / 2 + fontSize / 2

  // Draw each line of text
  lines.forEach((line, index) => {
    const y = startY + index * fontSize * lineHeight
    ctx.fillText(line, width / 2, y)
  })

  // Mark texture for update
  texture.needsUpdate = true
}
