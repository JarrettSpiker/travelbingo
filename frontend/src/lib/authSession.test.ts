import { describe, expect, it } from "vitest";
import {
  clearSession,
  loadPending,
  loadSession,
  parsePending,
  parseSession,
  savePending,
  saveSession,
} from "./authSession";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

/** Stands in for private mode or a full quota. */
class BrokenStorage extends MemoryStorage {
  override setItem(): never {
    throw new Error("quota exceeded");
  }
  override getItem(): never {
    throw new Error("access denied");
  }
}

describe("parseSession", () => {
  it("accepts a well-formed session", () => {
    expect(parseSession({ refreshToken: "rt", email: "a@example.com" })).toEqual({
      refreshToken: "rt",
      email: "a@example.com",
    });
  });

  it("yields null — never a crash — for anything malformed", () => {
    // A corrupted or hand-edited value must read as "signed out". The
    // logged-out experience is the thing that must not regress.
    expect(parseSession(null)).toBeNull();
    expect(parseSession("rt")).toBeNull();
    expect(parseSession({})).toBeNull();
    expect(parseSession({ refreshToken: "" })).toBeNull();
    expect(parseSession({ refreshToken: 42 })).toBeNull();
  });

  it("drops a non-string email rather than rejecting the session", () => {
    expect(parseSession({ refreshToken: "rt", email: 42 })).toEqual({ refreshToken: "rt", email: null });
  });
});

describe("parsePending", () => {
  it("requires both the verifier and the state", () => {
    expect(parsePending({ codeVerifier: "v", state: "s", returnTo: "/cards" })).toEqual({
      codeVerifier: "v",
      state: "s",
      returnTo: "/cards",
    });
    expect(parsePending({ codeVerifier: "v" })).toBeNull();
    expect(parsePending({ state: "s" })).toBeNull();
  });

  it("defaults returnTo to the root", () => {
    expect(parsePending({ codeVerifier: "v", state: "s" })?.returnTo).toBe("/");
  });
});

describe("storage round-trips", () => {
  it("saves, loads, and clears a session", () => {
    const storage = new MemoryStorage();

    saveSession({ refreshToken: "rt", email: "a@example.com" }, storage);
    expect(loadSession(storage)?.refreshToken).toBe("rt");

    clearSession(storage);
    expect(loadSession(storage)).toBeNull();
  });

  it("reads corrupted JSON as signed out", () => {
    const storage = new MemoryStorage();
    storage.setItem("travelbingo.session", "{not json");

    expect(loadSession(storage)).toBeNull();
  });

  it("survives storage being unavailable", () => {
    // Private mode, disabled cookies, exhausted quota. The app stays usable.
    const storage = new BrokenStorage();

    expect(() => saveSession({ refreshToken: "rt", email: null }, storage)).not.toThrow();
    expect(loadSession(storage)).toBeNull();
  });

  it("keeps the pending flow separate from the session", () => {
    const storage = new MemoryStorage();

    savePending({ codeVerifier: "v", state: "s", returnTo: "/cards" }, storage);
    expect(loadPending(storage)?.state).toBe("s");
    expect(loadSession(storage)).toBeNull();
  });
});
