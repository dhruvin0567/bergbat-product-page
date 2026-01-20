import * as THREE from "three";

/**
 * Creates a high-quality canvas texture for the text logo.
 * @param {string} text - The text to display (e.g. "BERGBAT").
 * @param {Object} options - Configuration options for the texture.
 * @returns {THREE.CanvasTexture} - The generated texture.
 */

export function createLogoTexture(text, options = {}) {
  const {
    width = 1024,
    height = 512,
    fontSize = 120,
    fontFamily = "Arial, sans-serif",
    fontWeight = "900",
    color = "#000000",
    letterSpacing = 10,
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  const x = width / 2;
  const y = height / 2;

  if (ctx.letterSpacing) {
    ctx.letterSpacing = `${letterSpacing}px`;
  }

  ctx.fillText(text.toUpperCase(), x, y);

  const texture = new THREE.CanvasTexture(canvas);

  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMenuItemFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}
