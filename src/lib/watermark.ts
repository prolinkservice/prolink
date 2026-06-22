/**
 * 在瀏覽器端對圖片加上浮水印文字，用於審核用途的上傳檔案（存摺影本、身分證影本等）。
 * 必須在 client component 中使用（依賴 Canvas / createImageBitmap 等瀏覽器 API）。
 */
export async function addWatermarkToImage(
  file: File,
  watermarkText: string = '僅供 ProLink 審核用'
): Promise<Blob> {
  const img = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('無法建立 canvas context')
  }

  ctx.drawImage(img, 0, 0)

  const fontSize = Math.max(20, Math.round(img.width / 18))
  ctx.font = `bold ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.lineWidth = Math.max(1, fontSize / 16)

  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(-Math.PI / 6)

  ctx.strokeText(watermarkText, 0, 0)
  ctx.fillText(watermarkText, 0, 0)

  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('產生浮水印圖片失敗'))
      },
      file.type || 'image/jpeg',
      0.92
    )
  })
}
