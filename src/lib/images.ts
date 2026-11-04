import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { ImageUpload } from "@/api/types";

export const MAX_IMAGES = 4;
// Vision models downscale anyway, so a larger image only costs upload time and storage.
export const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;

export interface Attachment {
  id: string;
  // The re-encoded file, shown as the thumbnail.
  preview: string;
  upload: ImageUpload;
}

export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

let counter = 0;

// Re-encoding as JPEG keeps every upload small and gives the server a single well-known format. HEIC photos from the
// library come out as JPEG here too.
export async function prepareImage(asset: { uri: string; width: number; height: number }): Promise<Attachment> {
  const { width, height } = fitWithin(asset.width, asset.height);
  const rendered = await ImageManipulator.manipulate(asset.uri).resize({ width, height }).renderAsync();
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error("Could not read that image");
  return { id: `img-${Date.now()}-${counter++}`, preview: saved.uri, upload: { media_type: "image/jpeg", data: saved.base64 } };
}
