/** Condivide (foglio iOS) o scarica un blob PDF. Affidabile anche come PWA su iPhone. */
export async function sharePdf(blob: Blob, filename: string, titolo?: string): Promise<void> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titolo });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return; // annullato dall'utente
      // altrimenti prosegue col download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function imgSize(dataURL: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = dataURL;
  });
}

export interface ImgPronta {
  dataURL: string;
  w: number;
  h: number;
}

/**
 * Decodifica una foto rispettando l'orientamento EXIF (le foto verticali iPhone
 * altrimenti finiscono ruotate nel PDF) e la ridimensiona per contenere il peso.
 * Restituisce un JPEG già orientato correttamente.
 */
export async function blobToOrientedImage(blob: Blob, maxDim = 1400): Promise<ImgPronta> {
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return { dataURL: canvas.toDataURL('image/jpeg', 0.85), w, h };
  } catch {
    // fallback: nessun ri-orientamento (browser molto vecchi)
    const dataURL = await blobToDataURL(blob);
    const { w, h } = await imgSize(dataURL);
    return { dataURL, w, h };
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
