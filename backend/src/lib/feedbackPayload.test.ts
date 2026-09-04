import { describe, expect, it } from "vitest";
import {
  CONTEXT_KEYS,
  MAX_CONTACT_LENGTH,
  MAX_CONTEXT_VALUE_LENGTH,
  MAX_MESSAGE_LENGTH,
  parseFeedbackPayload,
} from "./feedbackPayload.ts";

const VALID = {
  message: "The print layout cuts off the last row on A4.",
  context: {
    brand: "office",
    environment: "dev",
    route: "/cards/abc",
    viewport: "1280x800",
    userAgent: "Mozilla/5.0",
    buildSha: "0123456789abcdef",
  },
};

describe("parseFeedbackPayload", () => {
  it("accepts a submission with no contact", () => {
    const result = parseFeedbackPayload(VALID);
    expect(result.message).toBe(VALID.message);
    expect(result.context).toEqual(VALID.context);
    // Absent, not empty-string: the stored item must carry no contact attribute
    // at all for someone who did not ask for a reply.
    expect("contact" in result).toBe(false);
  });

  it("accepts a submission with a contact", () => {
    const result = parseFeedbackPayload({ ...VALID, contact: "someone@example.com" });
    expect(result.contact).toBe("someone@example.com");
  });

  it.each([
    ["absent", undefined],
    ["null", null],
    ["empty", ""],
    ["whitespace", "   "],
  ])("treats a %s contact as no contact rather than an error", (_label, contact) => {
    const result = parseFeedbackPayload({ ...VALID, contact });
    expect("contact" in result).toBe(false);
  });

  it("rejects an empty message", () => {
    expect(() => parseFeedbackPayload({ ...VALID, message: "" })).toThrow(/message/);
  });

  it("rejects a whitespace-only message", () => {
    expect(() => parseFeedbackPayload({ ...VALID, message: "  \n\t " })).toThrow(/empty/);
  });

  it("rejects a message over the bound", () => {
    const message = "x".repeat(MAX_MESSAGE_LENGTH + 1);
    expect(() => parseFeedbackPayload({ ...VALID, message })).toThrow(/2000/);
  });

  it("accepts a message exactly at the bound", () => {
    const message = "x".repeat(MAX_MESSAGE_LENGTH);
    expect(parseFeedbackPayload({ ...VALID, message }).message).toBe(message);
  });

  it("rejects a contact over the bound", () => {
    const contact = `${"x".repeat(MAX_CONTACT_LENGTH)}@example.com`;
    expect(() => parseFeedbackPayload({ ...VALID, contact })).toThrow(/254/);
  });

  it.each(["not-an-address", "two@at@signs", "has space@example.com", "@example.com", "trailing@"])(
    "rejects a malformed contact: %s",
    (contact) => {
      expect(() => parseFeedbackPayload({ ...VALID, contact })).toThrow(/contact/);
    },
  );

  it("drops unknown context keys rather than failing the submission", () => {
    const result = parseFeedbackPayload({
      ...VALID,
      context: { ...VALID.context, somethingNew: "from a newer client" },
    });
    expect(result.context).toEqual(VALID.context);
    expect("somethingNew" in result.context).toBe(false);
  });

  it("accepts a submission with no context at all", () => {
    const result = parseFeedbackPayload({ message: VALID.message });
    expect(result.context).toEqual({});
  });

  it("rejects an over-long context value", () => {
    const context = { ...VALID.context, userAgent: "x".repeat(MAX_CONTEXT_VALUE_LENGTH + 1) };
    expect(() => parseFeedbackPayload({ ...VALID, context })).toThrow(/userAgent/);
  });

  it("rejects a non-string context value", () => {
    expect(() => parseFeedbackPayload({ ...VALID, context: { route: 42 } })).toThrow(/route/);
  });

  it.each([undefined, null, "a string", 42, ["an array"]])("rejects a non-object body: %s", (body) => {
    expect(() => parseFeedbackPayload(body)).toThrow(/feedback/);
  });

  // The privacy claim, pinned as a test rather than left to review. Adding a
  // card field to the context has to break this deliberately.
  it("has no context key that could carry card content", () => {
    expect(CONTEXT_KEYS).toEqual(["brand", "environment", "route", "viewport", "userAgent", "buildSha"]);
  });

  it("does not carry card content through even when it is sent", () => {
    const result = parseFeedbackPayload({
      ...VALID,
      context: { ...VALID.context, title: "My secret card", slots: "Airport, Dog" },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("Airport");
  });
});
