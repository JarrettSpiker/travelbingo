import { describe, expect, it } from "vitest";
import { decodeCardFromUrl, encodeCardToUrl } from "./cardUrl";

const SAMPLE_COLOR_SCHEME = {
  backgroundColor: "#112233",
  cellColor: "#445566",
  textColor: "#ff00ff",
  titleColor: "#00ff00",
};
const SAMPLE_FONT_SCHEME = { titleFont: "Georgia, serif", cellFont: "'Courier New', monospace" };

describe("encodeCardToUrl / decodeCardFromUrl", () => {
  it("round-trips slots (including blanks), title, free space text, colors, and fonts", () => {
    const slots = ["Alpha", null, "Charlie", null, "Echo"];
    const url = encodeCardToUrl(
      { slots, title: "My Card", freeSpaceText: "Wild", colorScheme: SAMPLE_COLOR_SCHEME, fontScheme: SAMPLE_FONT_SCHEME },
      "https://example.com/",
    );

    const decoded = decodeCardFromUrl(new URL(url).search);
    expect(decoded).toEqual({
      slots,
      title: "My Card",
      freeSpaceText: "Wild",
      colorScheme: SAMPLE_COLOR_SCHEME,
      fontScheme: SAMPLE_FONT_SCHEME,
    });
  });

  it("round-trips an empty title and free space text", () => {
    const url = encodeCardToUrl(
      { slots: [], title: "", freeSpaceText: "", colorScheme: SAMPLE_COLOR_SCHEME, fontScheme: SAMPLE_FONT_SCHEME },
      "https://example.com/",
    );
    const decoded = decodeCardFromUrl(new URL(url).search);
    expect(decoded?.title).toBe("");
    expect(decoded?.freeSpaceText).toBe("");
  });

  it("produces a URL based on the given base URL with only the card param in the query", () => {
    const url = encodeCardToUrl(
      { slots: ["A"], title: "T", freeSpaceText: "F", colorScheme: SAMPLE_COLOR_SCHEME, fontScheme: SAMPLE_FONT_SCHEME },
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

  it("fills in default title color and fonts when decoding a pre-existing (v1) URL", () => {
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
  });
});
