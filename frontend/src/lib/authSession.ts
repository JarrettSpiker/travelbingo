import { brand } from "../brand";

// Persistence for the sign-in session.
//
// Only the refresh token is stored. Access and ID tokens stay in memory, so an
// XSS that reads localStorage gets a token that can be revoked, not one that is
// immediately usable against the API for an hour. This is a knowingly accepted
// trade-off: the stronger design (an HttpOnly cookie set by a
// backend-for-frontend) conflicts with API Gateway's native JWT authorizer,
// which reads only the Authorization header. See design.md.
//
// Every read is shape-validated, because a corrupted or hand-edited value must
// yield "signed out" rather than a crash — the logged-out experience is the
// thing that must never regress.

/*
  Namespaced by brand. Not strictly required — the brands are different
  origins, so their localStorage is already isolated — but it removes a
  hardcoded product name from code that is otherwise brand-agnostic.
*/
const SESSION_KEY = `${brand.storagePrefix}.session`;
const PENDING_KEY = `${brand.storagePrefix}.auth.pending`;

export interface StoredSession {
  refreshToken: string;
  /** Display only. Never used for authorization. */
  email: string | null;
}

/** The PKCE verifier and state, held only between the redirect and the callback. */
export interface PendingAuth {
  codeVerifier: string;
  state: string;
  /** Where to return the user after the callback completes. */
  returnTo: string;
}

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, disabled cookies, quota). The
    // app stays usable signed out, which is the requirement.
  }
}

function remove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // See above.
  }
}

export function parseSession(value: unknown): StoredSession | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.refreshToken !== "string" || record.refreshToken === "") return null;

  return {
    refreshToken: record.refreshToken,
    email: typeof record.email === "string" ? record.email : null,
  };
}

export function parsePending(value: unknown): PendingAuth | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  if (typeof record.codeVerifier !== "string" || record.codeVerifier === "") return null;
  if (typeof record.state !== "string" || record.state === "") return null;

  return {
    codeVerifier: record.codeVerifier,
    state: record.state,
    returnTo: typeof record.returnTo === "string" ? record.returnTo : "/",
  };
}

export function loadSession(storage: Storage = localStorage): StoredSession | null {
  return parseSession(readJson(storage, SESSION_KEY));
}

export function saveSession(session: StoredSession, storage: Storage = localStorage): void {
  writeJson(storage, SESSION_KEY, session);
}

export function clearSession(storage: Storage = localStorage): void {
  remove(storage, SESSION_KEY);
}

// Session storage, not local: an interrupted sign-in should not outlive the tab.
export function loadPending(storage: Storage = sessionStorage): PendingAuth | null {
  return parsePending(readJson(storage, PENDING_KEY));
}

export function savePending(pending: PendingAuth, storage: Storage = sessionStorage): void {
  writeJson(storage, PENDING_KEY, pending);
}

export function clearPending(storage: Storage = sessionStorage): void {
  remove(storage, PENDING_KEY);
}
