import { describe, expect, it } from "vitest";
import { estimateDataUrlBytes, MAX_THUMBNAIL_BYTES } from "./cardThumbnail";

describe("estimateDataUrlBytes", () => {
  it("estimates the decoded byte length of a base64 data URL", () => {
    // "abc" base64-encodes to "YWJj" (4 chars -> 3 bytes), no padding.
    const url = `data:image/png;base64,${"YWJj"}`;
    expect(estimateDataUrlBytes(url)).toBe(3);
  });

  it("subtracts single padding characters", () => {
    // "ab" -> "YWI=" (one pad -> 2 bytes)
    expect(estimateDataUrlBytes(`data:image/png;base64,YWI=`)).toBe(2);
  });

  it("subtracts double padding characters", () => {
    // "a" -> "YQ==" (two pad -> 1 byte)
    expect(estimateDataUrlBytes(`data:image/png;base64,YQ==`)).toBe(1);
  });

  it("is non-negative for an empty payload", () => {
    expect(estimateDataUrlBytes("data:image/png;base64,")).toBe(0);
  });
});

describe("MAX_THUMBNAIL_BYTES", () => {
  it("matches the backend cap (pinned in savedCard.contract.test.ts)", () => {
    expect(MAX_THUMBNAIL_BYTES).toBe(100_000);
  });
});
