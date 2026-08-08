import { badRequest } from "../http.ts";
import {
  ALLOWED_FONTS,
  HEX_COLOR,
  MAX_EMOJIS,
  MAX_EMOJI_LENGTH,
  MAX_FREE_SPACE_LENGTH,
  MAX_SLOTS,
  MAX_SLOT_LENGTH,
  MAX_TITLE_LENGTH,
} from "./cardPayload.ts";

// Trip payloads are validated here, mirroring cardPayload.ts's reject-don't-
// correct philosophy. The render-only rules reuse the exported constants from
// cardPayload.ts (MAX_SLOT_LENGTH, ALLOWED_FONTS, the hex pattern, emoji/slot
// caps) so the two validators can never drift apart; only the private per-field
// checkers are re-applied here, because those are frozen in cardPayload.ts.

export type TripMode = "cooperative" | "competitive";

const TRIP_MODES: ReadonlySet<TripMode> = new Set(["cooperative", "competitive"]);

/** Bounds a client-supplied display email (RFC 5321's practical max). */
export const MAX_EMAIL_LENGTH = 320;

/**
 * A frozen, render-only snapshot of a card. This is a strict subset of
 * {@link CardPayload} — it carries everything the renderer, the print/PNG
 * exporters, and (future) marking need, and deliberately omits the editable
 * `entries` pool, because a trip card is never re-opened in the editor and is
 * never re-randomized. Mirrored by hand into frontend/src/lib/tripTypes.ts.
 */
export interface TripCardSnapshot {
  slots: (string | null)[];
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

/** A well-formed calendar date in ISO order, so dates compare lexicographically. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses an optional display email supplied by the client on join. The backend
 * cannot read email from the (access) JWT, so the caller self-reports it for
 * display only — exactly like a display name. It is never an authorization
 * input (identity still comes solely from the verified `sub`). Bounded, never
 * silently corrected: a non-string is rejected.
 */
export function parseOptionalEmail(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw badRequest("email must be a string");
  }
  if (value.length > MAX_EMAIL_LENGTH) {
    throw badRequest(`email must be at most ${MAX_EMAIL_LENGTH} characters`);
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export interface TripInput {
  title: string;
  mode: TripMode;
  startDate?: string;
  endDate?: string;
}

export interface TripUpdateInput {
  title: string;
  startDate?: string;
  endDate?: string;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw badRequest(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw badRequest("title must be a string");
  }
  // The spec requires a non-empty title; whitespace-only is treated as empty.
  if (value.trim() === "") {
    throw badRequest("title must not be empty");
  }
  if (value.length > MAX_TITLE_LENGTH) {
    throw badRequest(`title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  return value;
}

/**
 * A bounded title that may be empty, mirroring the card title rule. The snapshot
 * is projected from an already-validated card (whose title may be empty), so it
 * re-applies the card's bound rather than the trip's non-empty rule.
 */
function requireBoundedTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw badRequest("title must be a string");
  }
  if (value.length > MAX_TITLE_LENGTH) {
    throw badRequest(`title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  return value;
}

function requireDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !DATE.test(value)) {
    throw badRequest(`${field} must be a calendar date (YYYY-MM-DD)`);
  }
  // Reject a syntactically valid but non-existent date (e.g. 2026-13-40).
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${field} must be a calendar date (YYYY-MM-DD)`);
  }
  return value;
}

function parseDates(raw: Record<string, unknown>): { startDate?: string; endDate?: string } {
  const hasStart = raw.startDate !== undefined && raw.startDate !== null;
  const hasEnd = raw.endDate !== undefined && raw.endDate !== null;

  const startDate = hasStart ? requireDate(raw.startDate, "startDate") : undefined;
  const endDate = hasEnd ? requireDate(raw.endDate, "endDate") : undefined;

  // Lexicographic comparison equals chronological comparison for ISO dates.
  if (startDate && endDate && endDate < startDate) {
    throw badRequest("endDate must not precede startDate");
  }

  return { startDate, endDate };
}

/**
 * Validates a create-trip payload: a non-empty bounded title, a supported play
 * mode, and optional start/end calendar dates where the end does not precede the
 * start. Throws HttpError(400) on any violation; never repairs, never partially
 * accepts.
 */
export function parseTripInput(input: unknown): TripInput {
  const raw = asRecord(input, "trip");

  const mode = raw.mode;
  if (typeof mode !== "string" || !TRIP_MODES.has(mode as TripMode)) {
    throw badRequest("mode must be one of: cooperative, competitive");
  }

  return {
    title: requireTitle(raw.title),
    mode: mode as TripMode,
    ...parseDates(raw),
  };
}

/**
 * Validates an update-trip payload: title and optional dates. The play mode is
 * fixed at creation and is not editable, so it is not accepted here.
 */
export function parseTripUpdate(input: unknown): TripUpdateInput {
  const raw = asRecord(input, "trip");
  return {
    title: requireTitle(raw.title),
    ...parseDates(raw),
  };
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
 * Validates a client-supplied trip-card snapshot as a strict render-only subset
 * of {@link CardPayload}. The editable `entries` pool is intentionally ignored:
 * a trip card is never re-opened in the editor, so it is not part of the
 * snapshot. Throws HttpError(400) on any violation.
 */
export function parseTripCardSnapshot(input: unknown): TripCardSnapshot {
  const raw = asRecord(input, "snapshot");

  if (!Array.isArray(raw.slots)) {
    throw badRequest("slots must be an array");
  }
  if (raw.slots.length > MAX_SLOTS) {
    throw badRequest(`slots must contain at most ${MAX_SLOTS} entries`);
  }

  const slots = raw.slots.map((slot, index) => {
    if (slot === null) return null;
    const text = typeof slot === "string" ? slot : undefined;
    if (text === undefined) {
      throw badRequest(`slots[${index}] must be a string or null`);
    }
    if (text.length > MAX_SLOT_LENGTH) {
      throw badRequest(`slots[${index}] must be at most ${MAX_SLOT_LENGTH} characters`);
    }
    return text === "" ? null : text;
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

  const freeSpaceText = (() => {
    if (typeof raw.freeSpaceText !== "string") {
      throw badRequest("freeSpaceText must be a string");
    }
    if (raw.freeSpaceText.length > MAX_FREE_SPACE_LENGTH) {
      throw badRequest(`freeSpaceText must be at most ${MAX_FREE_SPACE_LENGTH} characters`);
    }
    return raw.freeSpaceText;
  })();

  return {
    slots,
    title: requireBoundedTitle(raw.title),
    hasFreeSpace: requireBoolean(raw.hasFreeSpace, "hasFreeSpace"),
    freeSpaceText,
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
      emojis: emojiScheme.emojis.map((emoji, index) => {
        if (typeof emoji !== "string") {
          throw badRequest(`emojiScheme.emojis[${index}] must be a string`);
        }
        if (emoji.length > MAX_EMOJI_LENGTH) {
          throw badRequest(`emojiScheme.emojis[${index}] must be at most ${MAX_EMOJI_LENGTH} characters`);
        }
        return emoji;
      }),
    },
  };
}
