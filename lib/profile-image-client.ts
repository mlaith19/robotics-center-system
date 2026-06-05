export async function fileToProfileImageDataUrl(file: File, size = 512): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Failed to load image"))
      el.src = objectUrl
    })

    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas is not supported")

    // Trim transparent margins first (common in logo PNGs), then create square cover crop.
    const sourceCanvas = document.createElement("canvas")
    sourceCanvas.width = img.width
    sourceCanvas.height = img.height
    const sourceCtx = sourceCanvas.getContext("2d")
    if (!sourceCtx) throw new Error("Canvas is not supported")
    sourceCtx.drawImage(img, 0, 0)

    const imageData = sourceCtx.getImageData(0, 0, img.width, img.height)
    const data = imageData.data

    const idx = (x: number, y: number) => (y * img.width + x) * 4
    const corners = [
      [0, 0],
      [Math.max(0, img.width - 1), 0],
      [0, Math.max(0, img.height - 1)],
      [Math.max(0, img.width - 1), Math.max(0, img.height - 1)],
    ] as const
    const samples = corners.map(([x, y]) => {
      const i = idx(x, y)
      return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }
    })
    const avg = samples.reduce(
      (acc, s) => ({ r: acc.r + s.r, g: acc.g + s.g, b: acc.b + s.b, a: acc.a + s.a }),
      { r: 0, g: 0, b: 0, a: 0 }
    )
    const bg = {
      r: avg.r / samples.length,
      g: avg.g / samples.length,
      b: avg.b / samples.length,
      a: avg.a / samples.length,
    }
    const sameCornerBg = samples.every(
      (s) =>
        Math.abs(s.r - bg.r) < 16 &&
        Math.abs(s.g - bg.g) < 16 &&
        Math.abs(s.b - bg.b) < 16 &&
        Math.abs(s.a - bg.a) < 24
    )
    const bgTolerance = 22
    let minX = img.width
    let minY = img.height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]
        const isTransparentBg = a <= 10
        const isSolidCornerBg =
          sameCornerBg &&
          a > 10 &&
          Math.abs(r - bg.r) <= bgTolerance &&
          Math.abs(g - bg.g) <= bgTolerance &&
          Math.abs(b - bg.b) <= bgTolerance
        if (!isTransparentBg && !isSolidCornerBg) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }

    let srcX = 0
    let srcY = 0
    let srcW = img.width
    let srcH = img.height
    if (maxX >= minX && maxY >= minY) {
      srcX = minX
      srcY = minY
      srcW = maxX - minX + 1
      srcH = maxY - minY + 1
    }

    const scale = Math.max(size / srcW, size / srcH)
    const drawW = srcW * scale
    const drawH = srcH * scale
    const offsetX = (size - drawW) / 2
    const offsetY = (size - drawH) / 2

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(sourceCanvas, srcX, srcY, srcW, srcH, offsetX, offsetY, drawW, drawH)

    return canvas.toDataURL("image/jpeg", 0.9)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

