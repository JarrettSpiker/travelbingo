import { DEFAULT_COLOR_SCHEME, type ColorScheme } from "./colorScheme";
import { DEFAULT_FONT_SCHEME, type FontScheme } from "./fontScheme";

export interface CardUrlData {
  slots: (string | null)[];
  title: string;
  hasFreeSpace: boolean;
  freeSpaceText: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
}

const URL_PARAM = "card";
const SCHEMA_VERSION = 3;

interface EncodedPayload {
  v: number;
  s: string[];
  t: string;
  hf: boolean;
  f: string;
  c: [string, string, string, string];
  ft: [string, string];
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
  };

  const url = new URL(baseUrl);
  url.search = "";
  url.searchParams.set(URL_PARAM, toBase64Url(JSON.stringify(payload)));
  return url.toString();
}

export function decodeCardFromUrl(search: string = window.location.search): CardUrlData | null {
  const encoded = new URLSearchParams(search).get(URL_PARAM);
  if (!encoded) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as Partial<EncodedPayload>;
    if (!Array.isArray(payload.s) || !Array.isArray(payload.c) || payload.c.length < 3) return null;

    return {
      slots: payload.s.map((slot) => (typeof slot === "string" && slot !== "" ? slot : null)),
      title: typeof payload.t === "string" ? payload.t : "",
      hasFreeSpace: typeof payload.hf === "boolean" ? payload.hf : true,
      freeSpaceText: typeof payload.f === "string" ? payload.f : "",
      colorScheme: {
        backgroundColor: payload.c[0],
        cellColor: payload.c[1],
        textColor: payload.c[2],
        titleColor: payload.c[3] ?? DEFAULT_COLOR_SCHEME.titleColor,
      },
      fontScheme: {
        titleFont: payload.ft?.[0] ?? DEFAULT_FONT_SCHEME.titleFont,
        cellFont: payload.ft?.[1] ?? DEFAULT_FONT_SCHEME.cellFont,
      },
    };
  } catch {
    return null;
  }
}
