import { toPng } from "html-to-image";
import { buildImageFilename } from "./imageExport";

// The single PNG export implementation, shared by the editor's card and by each
// card on a trip. One code path so the image a member shares of their marked
// card cannot drift from the one the editor produces, and a fix to either is a
// fix to both.
//
// Entirely in-browser: no upload, no API call, nothing that needs an account.

/**
 * Renders a `.bingo-card` node to a PNG and hands it to the browser as a
 * download named after the card's title.
 *
 * Awaiting `document.fonts.ready` first is load-bearing: `toPng` snapshots
 * whatever is painted at the moment it runs, so exporting before the card's
 * webfonts have loaded produces an image in a fallback face. `pixelRatio: 2`
 * keeps the result legible when it is viewed at more than its CSS size, which
 * is what happens to anything posted in a chat.
 *
 * Throws if the node cannot be serialized; callers surface that themselves,
 * because the right way to report it differs between the editor and a trip.
 */
export async function downloadCardPng(node: HTMLElement, title: string): Promise<void> {
  await document.fonts.ready;
  const dataUrl = await toPng(node, { pixelRatio: 2 });

  const link = document.createElement("a");
  link.download = buildImageFilename(title);
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
