import { badRequest } from "../http.ts";

// Validates a feedback submission. Same failure mode as cardPayload.ts —
// reject, never silently correct — but for a much smaller shape.
//
// Two things here are load-bearing and easy to mistake for paranoia:
//
//   1. The *context* is validated too. It is collected by our own code, so it
//      looks trustworthy, but it arrives over the wire from a browser and a
//      caller can send whatever they like in its place. Unknown keys are
//      dropped rather than rejected, because a client one version ahead
//      sending a field this build has never heard of should not lose the whole
//      submission — the prose is the part that matters.
//   2. The contact address gets a length and shape check and nothing more.
//      Fully validating an email address is a tar pit, and the consequence of a
//      malformed one is a reply that bounces, not a corrupted store.

/** Long enough for a real bug report; three orders of magnitude under MAX_BODY_BYTES. */
export const MAX_MESSAGE_LENGTH = 2_000;
/** RFC 5321's maximum address length. */
export const MAX_CONTACT_LENGTH = 254;
/** Each context value is a short machine-generated string, not prose. */
export const MAX_CONTEXT_VALUE_LENGTH = 400;

/**
 * The context fields the client may supply. Anything outside this list is
 * dropped, so a future client cannot quietly widen what we store — and so this
 * list stays the single readable answer to "what does a submission contain?".
 *
 * Card content is absent by construction. That is the point, and it is
 * asserted in feedbackPayload.test.ts so a later addition has to argue with a
 * failing test rather than slip through review.
 */
export const CONTEXT_KEYS = [
  "brand",
  "environment",
  "route",
  "viewport",
  "userAgent",
  "buildSha",
] as const;

export type ContextKey = (typeof CONTEXT_KEYS)[number];

export interface FeedbackContext {
  brand?: string;
  environment?: string;
  route?: string;
  viewport?: string;
  userAgent?: string;
  buildSha?: string;
}

export interface FeedbackPayload {
  message: string;
  /** Absent when the submitter did not ask for a reply. Never taken from the session. */
  contact?: string;
  context: FeedbackContext;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw badRequest(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

/**
 * The message is the submission. An empty one is rejected rather than stored,
 * because a blank record is indistinguishable from a bug in the client and
 * would be read as one.
 */
function parseMessage(value: unknown): string {
  if (typeof value !== "string") {
    throw badRequest("message must be a string");
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    throw badRequest("message must not be empty");
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw badRequest(`message must be at most ${MAX_MESSAGE_LENGTH} characters`);
  }
  return trimmed;
}

/**
 * Absent, null, and empty all mean the same thing — the submitter did not ask
 * for a reply — and all produce no stored address. Only a non-empty value is
 * checked, so leaving the field alone can never fail a submission.
 */
function parseContact(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw badRequest("contact must be a string");
  }
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.length > MAX_CONTACT_LENGTH) {
    throw badRequest(`contact must be at most ${MAX_CONTACT_LENGTH} characters`);
  }
  // Shape only: one @, with something either side and no whitespace.
  if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) {
    throw badRequest("contact must be an email address");
  }
  return trimmed;
}

/**
 * Unknown keys are dropped, not rejected; known keys must be strings within
 * bounds if present. A context that is absent entirely is valid — it degrades
 * the report, it does not invalidate it.
 */
function parseContext(value: unknown): FeedbackContext {
  if (value === undefined || value === null) return {};
  const raw = asRecord(value, "context");
  const context: FeedbackContext = {};

  for (const key of CONTEXT_KEYS) {
    const entry = raw[key];
    if (entry === undefined || entry === null) continue;
    if (typeof entry !== "string") {
      throw badRequest(`context.${key} must be a string`);
    }
    const trimmed = entry.trim();
    if (trimmed === "") continue;
    if (trimmed.length > MAX_CONTEXT_VALUE_LENGTH) {
      throw badRequest(`context.${key} must be at most ${MAX_CONTEXT_VALUE_LENGTH} characters`);
    }
    context[key] = trimmed;
  }

  return context;
}

export function parseFeedbackPayload(input: unknown): FeedbackPayload {
  const raw = asRecord(input, "feedback");

  const payload: FeedbackPayload = {
    message: parseMessage(raw.message),
    context: parseContext(raw.context),
  };

  const contact = parseContact(raw.contact);
  if (contact !== undefined) {
    payload.contact = contact;
  }

  return payload;
}
