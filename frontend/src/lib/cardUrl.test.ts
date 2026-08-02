import { describe, expect, it } from "vitest";
import { decodeCardFromUrl, encodeCardToUrl } from "./cardUrl";

const SAMPLE_COLOR_SCHEME = {
  backgroundColor: "#112233",
  cellColor: "#445566",
  textColor: "#ff00ff",
  titleColor: "#00ff00",
};
const SAMPLE_FONT_SCHEME = { titleFont: "Georgia, 'Times New Roman', serif", cellFont: "'Courier New', Courier, monospace" };
const SAMPLE_EMOJI_SCHEME = { emojis: [] as string[] };

describe("encodeCardToUrl / decodeCardFromUrl", () => {
  it("round-trips slots (including blanks), title, free space settings, colors, and fonts", () => {
    const slots = ["Alpha", null, "Charlie", null, "Echo"];
    const url = encodeCardToUrl(
      {
        slots,
        title: "My Card",
        hasFreeSpace: true,
        freeSpaceText: "Wild",
        colorScheme: SAMPLE_COLOR_SCHEME,
        fontScheme: SAMPLE_FONT_SCHEME,
        emojiScheme: SAMPLE_EMOJI_SCHEME,
      },
      "https://example.com/",
    );

    const decoded = decodeCardFromUrl(new URL(url).search);
    expect(decoded).toEqual({
      slots,
      title: "My Card",
      hasFreeSpace: true,
      freeSpaceText: "Wild",
      colorScheme: SAMPLE_COLOR_SCHEME,
      fontScheme: SAMPLE_FONT_SCHEME,
      emojiScheme: SAMPLE_EMOJI_SCHEME,
    });
  });

  it("round-trips a non-empty emoji scheme exactly", () => {
    const emojis = ["🌟", "🎉", "🚀"];
    const url = encodeCardToUrl(
      {
        slots: ["A"],
        title: "T",
        hasFreeSpace: true,
        freeSpaceText: "F",
        colorScheme: SAMPLE_COLOR_SCHEME,
        fontScheme: SAMPLE_FONT_SCHEME,
        emojiScheme: { emojis },
      },
      "https://example.com/",
    );
    const decoded = decodeCardFromUrl(new URL(url).search);
    expect(decoded?.emojiScheme).toEqual({ emojis });
  });

  it("decodes an older payload without an emoji field to no emojis", () => {
    const v3Payload = {
      v: 3,
      s: ["A", ""],
      t: "T",
      hf: true,
      f: "F",
      c: ["#112233", "#445566", "#ff00ff", "#00ff00"],
      ft: ["Georgia, serif", "'Courier New', monospace"],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(v3Payload));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const decoded = decodeCardFromUrl(`?card=${encoded}`);
    expect(decoded?.emojiScheme).toEqual({ emojis: [] });
  });

  it("round-trips an empty emoji set", () => {
    const url = encodeCardToUrl(
      {
        slots: ["A"],
        title: "T",
        hasFreeSpace: true,
        freeSpaceText: "",
        colorScheme: SAMPLE_COLOR_SCHEME,
        fontScheme: SAMPLE_FONT_SCHEME,
        emojiScheme: { emojis: [] },
      },
      "https://example.com/",
    );
    const decoded = decodeCardFromUrl(new URL(url).search);
    expect(decoded?.emojiScheme).toEqual({ emojis: [] });
  });

  it("round-trips hasFreeSpace: false", () => {
    const url = encodeCardToUrl(
      {
        slots: ["A"],
        title: "T",
        hasFreeSpace: false,
        freeSpaceText: "",
        colorScheme: SAMPLE_COLOR_SCHEME,
        fontScheme: SAMPLE_FONT_SCHEME,
        emojiScheme: SAMPLE_EMOJI_SCHEME,
      },
      "https://example.com/",
    );
    const decoded = decodeCardFromUrl(new URL(url).search);
    expect(decoded?.hasFreeSpace).toBe(false);
  });

  it("round-trips an empty title and free space text", () => {
    const url = encodeCardToUrl(
      {
        slots: [],
        title: "",
        hasFreeSpace: true,
        freeSpaceText: "",
        colorScheme: SAMPLE_COLOR_SCHEME,
        fontScheme: SAMPLE_FONT_SCHEME,
        emojiScheme: SAMPLE_EMOJI_SCHEME,
      },
      "https://example.com/",
    );
    const decoded = decodeCardFromUrl(new URL(url).search);
    expect(decoded?.title).toBe("");
    expect(decoded?.freeSpaceText).toBe("");
  });

  it("produces a URL based on the given base URL with only the card param in the query", () => {
    const url = encodeCardToUrl(
      {
        slots: ["A"],
        title: "T",
        hasFreeSpace: true,
        freeSpaceText: "F",
        colorScheme: SAMPLE_COLOR_SCHEME,
        fontScheme: SAMPLE_FONT_SCHEME,
        emojiScheme: SAMPLE_EMOJI_SCHEME,
      },
      "https://example.com/app?stale=1",
    );
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://example.com/app");
    expect(parsed.searchParams.get("stale")).toBeNull();
    expect(parsed.searchParams.get("card")).not.toBeNull();
  });

  it("returns null when there is no card param", () => {
    expect(decodeCardFromUrl("")).toBeNull();
    expect(decodeCardFromUrl("?other=1")).toBeNull();
  });

  it("returns null for garbage card data instead of throwing", () => {
    expect(decodeCardFromUrl("?card=not-valid-base64!!!")).toBeNull();
  });

  it("fills in default title color, fonts, and hasFreeSpace when decoding a pre-existing (v1) URL", () => {
    const v1Payload = {
      v: 1,
      s: ["A", ""],
      t: "T",
      f: "F",
      c: ["#112233", "#445566", "#ff00ff"],
    };
    const bytes = new TextEncoder().encode(JSON.stringify(v1Payload));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const decoded = decodeCardFromUrl(`?card=${encoded}`);
    expect(decoded?.colorScheme).toEqual({
      backgroundColor: "#112233",
      cellColor: "#445566",
      textColor: "#ff00ff",
      titleColor: "#1a1a1a",
    });
    expect(decoded?.fontScheme).toEqual({
      titleFont: "system-ui, sans-serif",
      cellFont: "system-ui, sans-serif",
    });
    // Pre-existing URLs predate the free-space toggle and always had a free space.
    expect(decoded?.hasFreeSpace).toBe(true);
  });
});
