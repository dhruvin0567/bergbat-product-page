import * as THREE from "three"

export function createBarrelTexture({
  text = "Victus",
  logoUrl = null,
  width = 2048,
  height = 512,
}) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  ctx.clearRect(0, 0, width, height)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"

  if (logoUrl) {
    const img = new Image()
    img.src = logoUrl
    img.onload = () => {
      const logoW = 300
      const logoH = 140

      ctx.drawImage(
        img,
        width / 2 - logoW / 2,
        height / 2 - logoH - 20,
        logoW,
        logoH
      )
    }
  }

  ctx.fillStyle = "#111"
  ctx.font = "bold 90px Arial"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  ctx.fillText(text, width / 2, height / 2 + 50)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(0.28, 1)
  texture.offset.set(0.02, 0)
  texture.flipY = false
  texture.needsUpdate = true

  return texture
}
