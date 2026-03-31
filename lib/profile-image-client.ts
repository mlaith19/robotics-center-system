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

    // Create a square crop so profile avatars always look consistent.
    const scale = Math.max(size / img.width, size / img.height)
    const drawW = img.width * scale
    const drawH = img.height * scale
    const offsetX = (size - drawW) / 2
    const offsetY = (size - drawH) / 2

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, size, size)
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH)

    return canvas.toDataURL("image/jpeg", 0.9)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

