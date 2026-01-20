import * as THREE from "three";

export function createTextTexture(textLines, options = {}) {
  const {
    width = 2048,
    height = 512,
    fontSize = [24, 56, 24],
    fontFamily = "Arial, sans-serif",
    fontWeight = "bold",
    textColor = "#000000",
    lineHeight = 1.15,
    backgroundColor = "#ffffff",
  } = options;

  const lines = Array.isArray(textLines) ? textLines : [textLines];

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (backgroundColor === "transparent") {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "center";

  const fontSizes = Array.isArray(fontSize)
    ? fontSize
    : new Array(lines.length).fill(fontSize);

  let totalHeight = 0;
  const lineHeights = [];

  fontSizes.forEach((size) => {
    const h = size * lineHeight;
    lineHeights.push(h);
    totalHeight += h;
  });

  let y = (height - totalHeight) / 1 + fontSizes[0] / 2;

  lines.forEach((line, i) => {
    ctx.font = `${fontWeight} ${fontSizes[i]}px ${fontFamily}`;
    const xPos = width / 2;
    ctx.fillText(line, xPos, y);
    y += lineHeights[i];
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.needsUpdate = true;

  return texture;
}

export function updateTextTexture(texture, textLines, options = {}) {
  const {
    width = 100,
    height = 250,
    fontSize = 60,
    fontFamily = "Arial, sans-serif",
    fontWeight = "bold",
    textColor = "#000000",
    lineHeight = 1,
    backgroundColor = "#ffffff",
  } = options;

  const lines = Array.isArray(textLines) ? textLines : [textLines];
  const canvas = texture.image;
  const ctx = canvas.getContext("2d");

  if (backgroundColor === "transparent") {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = textColor;
  ctx.textAlign = "start";
  ctx.textBaseline = "middle";

  const fontSizes = Array.isArray(fontSize)
    ? fontSize
    : new Array(lines.length).fill(fontSize);

  let totalHeight = 0;
  const lineHeights = [];

  fontSizes.forEach((size) => {
    const h = size * lineHeight;
    lineHeights.push(h);
    totalHeight += h;
  });

  let y = (height - totalHeight) / 1 + fontSizes[0] / 2;

  lines.forEach((line, i) => {
    ctx.font = `${fontWeight} ${fontSizes[i]}px ${fontFamily}`;
    ctx.fillText(line, width / 2, y);
    y += lineHeights[i];
  });

  texture.needsUpdate = true;
}
