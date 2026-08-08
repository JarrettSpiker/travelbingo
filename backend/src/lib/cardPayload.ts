import { badRequest } from "../http.ts";

// This mirrors the bounds and allowlists in frontend/src/lib/cardUrl.ts, but
// with the opposite failure mode. That file decodes an untrusted URL and
// substitutes a default for anything malformed, because a half-broken card is
// better than a blank page. This file guards persisted state, where silently
// "correcting" a payload would store something the user never authored — so
// every violation is rejected.
//
// The duplication is deliberate and is the largest accepted debt in this
// change; see design.md. The contract test in cardPayload.contract.test.ts is
// mirrored in the frontend so divergence fails CI.

/** The grid is a fixed 5x5 (25 cells); allow headroom, cap far below DoS territory. */
export const MAX_SLOTS = 64;
/** Bounds the entry pool count. The pool can legitimately exceed the grid, so it has its own cap; the byte cap remains the backstop. Mirrored in frontend. */
export const MAX_ENTRIES = 256;
export const MAX_SLOT_LENGTH = 200;
export const MAX_TITLE_LENGTH = 200;
export const MAX_FREE_SPACE_LENGTH = 200;
export const MAX_EMOJIS = 5;
export const MAX_EMOJI_LENGTH = 16;
/** Bounds the synchronous JSON.stringify cost and the stored item size. */
export const MAX_PAYLOAD_BYTES = 40_000;

/**
 * Bounds a stored thumbnail's decoded size. The frontend targets far less than
 * this (a downscaled PNG); the cap is a validation limit, not a target, and
 * keeps an abusive payload from reaching S3. Pinned in both contract tests.
 */
export const MAX_THUMBNAIL_BYTES = 100_000;

/**
 * Accept only well-formed hex colors so untrusted values can't reach CSS.
 * Exported so the trip-card snapshot validator can re-apply the exact same rule
 * without duplicating the pattern (which would let the two drift).
 */
export const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

/** Kept byte-identical to FONT_OPTIONS in frontend/src/lib/fontScheme.ts. */
export const ALLOWED_FONTS: ReadonlySet<string> = new Set([
  "system-ui, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "'Courier New', Courier, monospace",
  "'Comic Sans MS', 'Comic Sans', cursive",
  "'Arial Narrow', Arial, sans-serif",
  "'Poppins', sans-serif",
  "'Playfair Display', serif",
  "'Anton', sans-serif",
  "'Pacifico', cursive",
  "'Fredoka', sans-serif",
]);

export const PAYLOAD_VERSION = 1;

/** The on-the-wire shape of a single entry. Mirrors frontend/src/lib/savedCard.ts StoredEntry. */
export interface StoredEntry {
  text: string;
  mandatory: boolean;
  enabled: boolean;
}

export interface CardPayload {
  slots: (string | null)[];
  /** The full entry pool at save time (text + mandatory + enabled), including entries beyond the grid's capacity. */
  entries: StoredEntry[];
  title: string;
  hasFreeSpace: boolean;
  freeSpaceText: string;
  colorScheme: {
    backgroundColor: string;
    cellColor: string;
    textColor: string;
    titleColor: string;
  };
  fontScheme: {
    titleFont: string;
    cellFont: string;
  };
  emojiScheme: {
    emojis: string[];
  };
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw badRequest(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw badRequest(`${field} must be a string`);
  }
  if (value.length > maxLength) {
    throw badRequest(`${field} must be at most ${maxLength} characters`);
  }
  return value;
}

function requireColor(value: unknown, field: string): string {
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw badRequest(`${field} must be a hex color`);
  }
  return value;
}

function requireFont(value: unknown, field: string): string {
  if (typeof value !== "string" || !ALLOWED_FONTS.has(value)) {
    throw badRequest(`${field} is not an allowed font`);
  }
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw badRequest(`${field} must be a boolean`);
  }
  return value;
}

/**
 * Validates a client-supplied card. Throws HttpError(400) on any violation;
 * never repairs, never partially accepts.
 */
export function parseCardPayload(input: unknown): CardPayload {
  const raw = asRecord(input, "card");

  if (!Array.isArray(raw.slots)) {
    throw badRequest("slots must be an array");
  }
  if (raw.slots.length > MAX_SLOTS) {
    throw badRequest(`slots must contain at most ${MAX_SLOTS} entries`);
  }

  const slots = raw.slots.map((slot, index) => {
    if (slot === null) return null;
    const text = requireString(slot, `slots[${index}]`, MAX_SLOT_LENGTH);
    return text === "" ? null : text;
  });

  if (!Array.isArray(raw.entries)) {
    throw badRequest("entries must be an array");
  }
  if (raw.entries.length > MAX_ENTRIES) {
    throw badRequest(`entries must contain at most ${MAX_ENTRIES} entries`);
  }
  const entries: StoredEntry[] = raw.entries.map((entry, index) => {
    const obj = asRecord(entry, `entries[${index}]`);
    return {
      text: requireString(obj.text, `entries[${index}].text`, MAX_SLOT_LENGTH),
      mandatory: requireBoolean(obj.mandatory, `entries[${index}].mandatory`),
      enabled: requireBoolean(obj.enabled, `entries[${index}].enabled`),
    };
  });

  const colorScheme = asRecord(raw.colorScheme, "colorScheme");
  const fontScheme = asRecord(raw.fontScheme, "fontScheme");
  const emojiScheme = asRecord(raw.emojiScheme, "emojiScheme");

  if (!Array.isArray(emojiScheme.emojis)) {
    throw badRequest("emojiScheme.emojis must be an array");
  }
  if (emojiScheme.emojis.length > MAX_EMOJIS) {
    throw badRequest(`emojiScheme.emojis must contain at most ${MAX_EMOJIS} entries`);
  }

  const payload: CardPayload = {
    slots,
    entries,
    title: requireString(raw.title, "title", MAX_TITLE_LENGTH),
    hasFreeSpace: requireBoolean(raw.hasFreeSpace, "hasFreeSpace"),
    freeSpaceText: requireString(raw.freeSpaceText, "freeSpaceText", MAX_FREE_SPACE_LENGTH),
    colorScheme: {
      backgroundColor: requireColor(colorScheme.backgroundColor, "colorScheme.backgroundColor"),
      cellColor: requireColor(colorScheme.cellColor, "colorScheme.cellColor"),
      textColor: requireColor(colorScheme.textColor, "colorScheme.textColor"),
      titleColor: requireColor(colorScheme.titleColor, "colorScheme.titleColor"),
    },
    fontScheme: {
      titleFont: requireFont(fontScheme.titleFont, "fontScheme.titleFont"),
      cellFont: requireFont(fontScheme.cellFont, "fontScheme.cellFont"),
    },
    emojiScheme: {
      emojis: emojiScheme.emojis.map((emoji, index) =>
        requireString(emoji, `emojiScheme.emojis[${index}]`, MAX_EMOJI_LENGTH),
      ),
    },
  };

  // Checked last, on the normalized payload, so the size limit reflects what
  // would actually be stored rather than how verbosely it was sent.
  const size = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (size > MAX_PAYLOAD_BYTES) {
    throw badRequest(`card must be at most ${MAX_PAYLOAD_BYTES} bytes`);
  }

  return payload;
}

/** Titles are validated on their own for the rename path. */
export function parseTitle(input: unknown): string {
  return requireString(input, "title", MAX_TITLE_LENGTH);
}

/**
 * The only image content type the editor renders thumbnails as. The data-URL
 * prefix is matched literally so a malformed value can't smuggle bytes past the
 * content-type check by exploiting a lax parser.
 */
const THUMBNAIL_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

/**
 * Validates an optional thumbnail supplied on a save request.
 *
 * Unlike {@link parseCardPayload}, an invalid thumbnail is *dropped* rather than
 * rejected: the thumbnail is non-essential, and the spec requires the card's
 * data to save intact when generation (or transport) produced something
 * malformed. Returns the decoded bytes when valid, or null when absent or
 * invalid. The route never logs the returned bytes.
 */
export function parseThumbnail(input: unknown): Buffer | null {
  if (input === undefined || input === null) return null;
  if (typeof input !== "string") return null;

  const match = THUMBNAIL_DATA_URL.exec(input);
  if (match?.[1] === undefined) return null;

  let bytes: Buffer;
  try {
    bytes = Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_THUMBNAIL_BYTES) return null;

  return bytes;
}
