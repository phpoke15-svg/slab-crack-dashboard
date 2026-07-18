/** Upscale + grayscale + contrast boost so Tesseract reads small card text more reliably. */
export async function preprocessOcrImage(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      try {
        const minEdge = 960
        const longest = Math.max(img.width, img.height)
        const scale = longest < minEdge ? minEdge / longest : 1
        const outW = Math.max(1, Math.round(img.width * scale))
        const outH = Math.max(1, Math.round(img.height * scale))

        const canvas = document.createElement("canvas")
        canvas.width = outW
        canvas.height = outH
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) {
          resolve(imageDataUrl)
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"
        ctx.drawImage(img, 0, 0, outW, outH)

        const { data } = ctx.getImageData(0, 0, outW, outH)
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114
          const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128))
          const boosted = contrast
          data[i] = boosted
          data[i + 1] = boosted
          data[i + 2] = boosted
        }
        ctx.putImageData(new ImageData(data, outW, outH), 0, 0)
        resolve(canvas.toDataURL("image/jpeg", 0.95))
      } catch {
        resolve(imageDataUrl)
      }
    }
    img.onerror = () => reject(new Error("Could not preprocess scan image"))
    img.src = imageDataUrl
  })
}
