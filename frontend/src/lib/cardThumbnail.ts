import { toPng } from "html-to-image";

// Bounds the thumbnail payload the frontend will send, mirroring the backend's
// MAX_THUMBNAIL_BYTES in backend/src/lib/cardPayload.ts. Pinned together in both
// contract tests so divergence fails CI rather than silently dropping every
// thumbnail a wider side generates.
export const MAX_THUMBNAIL_BYTES = 100_000;

/**
 * Estimates the decoded byte length of a `data:image/png;base64,...` URL from
 * its base64 segment. Used to keep generation under the shared cap without
 * paying for a real decode. Exposed for unit testing.
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // Base64 encodes 3 bytes per 4 characters; trailing '=' pads to a multiple.
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/**
 * Renders a downscaled PNG thumbnail of the already-styled card DOM, reusing the
 * same html-to-image path the editor's PNG export uses.
 *
 * Best-effort by design: a failure (rendering error, or a thumbnail that cannot
 * be kept under the cap) returns null, and the save proceeds without a
 * thumbnail — the library shows a placeholder until the card is next saved.
 */
export async function generateCardThumbnail(node: HTMLElement): Promise<string | null> {
  try {
    await document.fonts.ready;
    // Try full resolution first for quality, then step down to stay under the
    // shared cap. Even the smaller ratio is preferable to no thumbnail.
    for (const pixelRatio of [1, 0.5]) {
      const dataUrl = await toPng(node, { pixelRatio });
      if (estimateDataUrlBytes(dataUrl) <= MAX_THUMBNAIL_BYTES) {
        return dataUrl;
      }
    }
    return null;
  } catch {
    return null;
  }
}
