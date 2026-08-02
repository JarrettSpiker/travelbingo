import { DEFAULT_COLOR_SCHEME, type ColorScheme } from "./colorScheme";
import { MAX_EMOJIS, type EmojiScheme } from "./emojiScheme";
import { DEFAULT_FONT_SCHEME, FONT_OPTIONS, type FontScheme } from "./fontScheme";

export interface CardUrlData {
  slots: (string | null)[];
  title: string;
  hasFreeSpace: boolean;
  freeSpaceText: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
}

const URL_PARAM = "card";
const SCHEMA_VERSION = 4;

/** Guard against oversized crafted payloads: bounds the synchronous atob/JSON.parse cost. */
const MAX_ENCODED_LENGTH = 50_000;
/** The grid is a fixed 5×5 (25 cells); allow headroom, cap far below DoS territory. */
const MAX_SLOTS = 64;

/** Accept only well-formed hex colors so untrusted URL values can't reach CSS. */
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
/** Fonts are constrained to the editor's known options. */
const ALLOWED_FONTS = new Set(FONT_OPTIONS.map((option) => option.value));

function decodeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function decodeFont(value: unknown, fallback: string): string {
  return typeof value === "string" && ALLOWED_FONTS.has(value) ? value : fallback;
}

interface EncodedPayload {
  v: number;
  s: string[];
  t: string;
  hf: boolean;
  f: string;
  c: [string, string, string, string];
  ft: [string, string];
  e: string[];
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeCardToUrl(data: CardUrlData, baseUrl: string = window.location.href): string {
  const payload: EncodedPayload = {
    v: SCHEMA_VERSION,
    s: data.slots.map((slot) => slot ?? ""),
    t: data.title,
    hf: data.hasFreeSpace,
    f: data.freeSpaceText,
    c: [data.colorScheme.backgroundColor, data.colorScheme.cellColor, data.colorScheme.textColor, data.colorScheme.titleColor],
    ft: [data.fontScheme.titleFont, data.fontScheme.cellFont],
    e: data.emojiScheme.emojis,
  };

  const url = new URL(baseUrl);
  url.search = "";
  url.searchParams.set(URL_PARAM, toBase64Url(JSON.stringify(payload)));
  return url.toString();
}

export function decodeCardFromUrl(search: string = window.location.search): CardUrlData | null {
  const encoded = new URLSearchParams(search).get(URL_PARAM);
  if (!encoded) return null;
  if (encoded.length > MAX_ENCODED_LENGTH) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as Partial<EncodedPayload>;
    if (!Array.isArray(payload.s) || !Array.isArray(payload.c) || payload.c.length < 3) return null;

    return {
      slots: payload.s
        .slice(0, MAX_SLOTS)
        .map((slot) => (typeof slot === "string" && slot !== "" ? slot : null)),
      title: typeof payload.t === "string" ? payload.t : "",
      hasFreeSpace: typeof payload.hf === "boolean" ? payload.hf : true,
      freeSpaceText: typeof payload.f === "string" ? payload.f : "",
      colorScheme: {
        backgroundColor: decodeColor(payload.c[0], DEFAULT_COLOR_SCHEME.backgroundColor),
        cellColor: decodeColor(payload.c[1], DEFAULT_COLOR_SCHEME.cellColor),
        textColor: decodeColor(payload.c[2], DEFAULT_COLOR_SCHEME.textColor),
        titleColor: decodeColor(payload.c[3], DEFAULT_COLOR_SCHEME.titleColor),
      },
      fontScheme: {
        titleFont: decodeFont(payload.ft?.[0], DEFAULT_FONT_SCHEME.titleFont),
        cellFont: decodeFont(payload.ft?.[1], DEFAULT_FONT_SCHEME.cellFont),
      },
      emojiScheme: {
        emojis: Array.isArray(payload.e)
          ? payload.e.filter((item): item is string => typeof item === "string").slice(0, MAX_EMOJIS)
          : [],
      },
    };
  } catch {
    return null;
  }
}
