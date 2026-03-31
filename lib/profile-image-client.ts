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
    let minX = img.width
    let minY = img.height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const alpha = data[(y * img.width + x) * 4 + 3]
        if (alpha > 10) {
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

