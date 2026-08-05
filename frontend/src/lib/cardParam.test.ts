import { describe, expect, it } from "vitest";
import { editorPathWithCard, readCardParam } from "./cardParam";

describe("readCardParam", () => {
  it("reads the card id when present", () => {
    expect(readCardParam("?card=abc123")).toBe("abc123");
  });

  it("reads from a URLSearchParams instance", () => {
    expect(readCardParam(new URLSearchParams("?card=xyz"))).toBe("xyz");
  });

  it("returns null when the param is absent", () => {
    expect(readCardParam("")).toBeNull();
    expect(readCardParam("?other=1")).toBeNull();
  });

  it("returns null when the param is present but empty", () => {
    expect(readCardParam("?card=")).toBeNull();
  });

  it("decodes URL-encoded ids", () => {
    expect(readCardParam(`?card=${encodeURIComponent("a/b c")}`)).toBe("a/b c");
  });
});

describe("editorPathWithCard", () => {
  it("builds the editor path with the card query param", () => {
    expect(editorPathWithCard("abc")).toBe("/?card=abc");
  });

  it("encodes characters that are special in a URL", () => {
    expect(editorPathWithCard("a/b c")).toBe(`/?card=${encodeURIComponent("a/b c")}`);
  });
});
