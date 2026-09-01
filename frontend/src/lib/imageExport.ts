import { brand } from "../brand";

const DEFAULT_IMAGE_FILENAME = brand.copy.exportFile.defaultPngName;
const MAX_BASE_LENGTH = 60;
const RESERVED_CHARS = /[\\/:*?"<>|]/;
/** Unicode bidi/override controls that can visually reverse or mislead a filename. */
const BIDI_CONTROLS = /[\u2028-\u202e\u2066-\u2069]/;

/**
 * Builds a sanitized `.png` filename from a card title.
 *
 * Falls back to a default name when the title is empty or collapses to
 * nothing after sanitizing. Whitespace runs are collapsed, and unsafe
 * filename characters (path separators, OS-reserved chars, control
 * characters, and Unicode bidi/override controls) are stripped.
 */
export function buildImageFilename(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return DEFAULT_IMAGE_FILENAME;
  }

  const collapsed = trimmed.replace(/\s+/g, " ");
  const sanitized = [...collapsed]
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return (
        code !== undefined &&
        code > 0x1f &&
        !RESERVED_CHARS.test(ch) &&
        !BIDI_CONTROLS.test(ch)
      );
    })
    .join("")
    .trim();
  if (!sanitized) {
    return DEFAULT_IMAGE_FILENAME;
  }

  const base =
    sanitized.length > MAX_BASE_LENGTH ? sanitized.slice(0, MAX_BASE_LENGTH).trim() : sanitized;
  if (!base) {
    return DEFAULT_IMAGE_FILENAME;
  }

  return `${base}.png`;
}
