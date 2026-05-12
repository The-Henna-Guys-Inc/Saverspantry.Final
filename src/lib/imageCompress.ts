// Compress an image blob/file to max dimension and target jpeg quality.
// Returns a Blob (image/jpeg). Throws if input cannot be decoded.
export async function compressImage(
  file: File | Blob,
  { maxDim = 1280, quality = 0.82, maxBytes = 5 * 1024 * 1024 } = {},
): Promise<Blob> {
  if (file.size === 0) throw new Error("Empty file");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not decode image"));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    let q = quality;
    let blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
    while (blob && blob.size > maxBytes && q > 0.4) {
      q -= 0.1;
      blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
    }
    if (!blob) throw new Error("Compression failed");
    if (blob.size > maxBytes) throw new Error("Image too large after compression");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
