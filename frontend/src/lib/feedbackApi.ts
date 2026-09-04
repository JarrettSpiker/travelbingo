import { brand } from "@/brand";
import { buildSha } from "@/config";
import type { ApiClient } from "./apiClient";

// Thin, typed wrapper over the feedback route, matching the shape of cardsApi.
//
// The context is assembled here rather than in the dialog so there is one
// answer to "what does a submission carry", and so the dialog cannot quietly
// widen it. The backend drops anything outside its own allowlist regardless —
// this is the near half of the same fence.

export interface FeedbackContext {
  brand: string;
  environment: string;
  route: string;
  viewport: string;
  userAgent: string;
  buildSha: string;
}

/**
 * Which deployment this is, inferred from the host.
 *
 * Inferred rather than configured: the value only has to be good enough to tell
 * a maintainer which environment a report came from, and adding a build-time
 * variable for it would mean another value to set per environment — the cost
 * VITE_COMMIT_SHA was deliberately designed to avoid.
 */
function environmentFromHost(host: string): string {
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return "local";
  if (host.startsWith("dev.")) return "dev";
  return "prod";
}

/**
 * Everything attached to a submission without the submitter typing it.
 *
 * Contains no card content, by construction — nothing here reads the editor's
 * state, and `route` is a path, which never carries card text (a card lives in
 * the URL *fragment* when it is unsaved, and this deliberately reads
 * `pathname` rather than `href` for exactly that reason).
 */
export function collectContext(): FeedbackContext {
  return {
    brand: brand.id,
    environment: environmentFromHost(window.location.hostname),
    route: window.location.pathname,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    userAgent: navigator.userAgent,
    buildSha,
  };
}

export async function submitFeedback(
  api: ApiClient,
  message: string,
  contact: string,
): Promise<void> {
  await api.request<{ ok: boolean }>("/api/feedback", {
    method: "POST",
    body: {
      message,
      // Absent rather than empty: the stored record must carry no contact at
      // all for someone who did not ask for a reply.
      ...(contact.trim() ? { contact: contact.trim() } : {}),
      context: collectContext(),
    },
  });
}
