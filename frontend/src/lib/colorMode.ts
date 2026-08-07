// The light/dark/system colour mode.
//
// Everything that can actually be wrong — what a stored value means, what
// `system` resolves to, what the cycle order is — is pure and tested at the top
// of this file. The browser-touching helpers are gathered at the bottom, behind
// the same try/catch discipline as authSession.ts: storage can be unavailable
// (private mode, disabled cookies, quota) and the app has to stay usable.
//
// The resolved value is written to `data-theme` on <html>. Both styling systems
// read that one attribute: Tailwind via `@custom-variant dark` in index.css,
// and MUI via `colorSchemeSelector` in theme.ts. While both are present that is
// what keeps a half-migrated screen from disagreeing with itself.

export const COLOR_MODE_KEY = "travelbingo.colorMode";

/** What the user chose. `system` defers to the OS, and keeps deferring. */
export type ColorMode = "system" | "light" | "dark";

/** What actually gets rendered. `data-theme` only ever holds one of these. */
export type ResolvedColorMode = "light" | "dark";

const MODES: readonly ColorMode[] = ["system", "light", "dark"];

/**
 * Narrows an arbitrary stored value to a ColorMode.
 *
 * Anything unrecognised — absent, corrupted, or written by an older build —
 * falls back to `system`, which is the behaviour the app had before a toggle
 * existed.
 */
export function parseColorMode(value: unknown): ColorMode {
  return MODES.includes(value as ColorMode) ? (value as ColorMode) : "system";
}

/**
 * Collapses a mode to the literal that gets written to `data-theme`.
 *
 * `system` needs the OS preference passed in rather than read here, so this
 * stays pure and the caller owns the one media query.
 */
export function resolveColorMode(mode: ColorMode, prefersDark: boolean): ResolvedColorMode {
  if (mode === "system") return prefersDark ? "dark" : "light";
  return mode;
}

/**
 * The order the toggle steps through.
 *
 * Light → dark → system, so the two concrete choices are one click apart and
 * `system` is the one you come back round to rather than the one you have to
 * pass through.
 */
export function nextColorMode(mode: ColorMode): ColorMode {
  if (mode === "light") return "dark";
  if (mode === "dark") return "system";
  return "light";
}

// ---------------------------------------------------------------------------
// Browser boundary
// ---------------------------------------------------------------------------

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The stored choice, or `system` if there isn't one or storage is unreadable. */
export function readStoredColorMode(): ColorMode {
  try {
    return parseColorMode(localStorage.getItem(COLOR_MODE_KEY));
  } catch {
    return "system";
  }
}

/** Persists the choice. A failure here costs persistence, not the session. */
export function storeColorMode(mode: ColorMode): void {
  try {
    localStorage.setItem(COLOR_MODE_KEY, mode);
  } catch {
    // Same trade as authSession.ts: the app keeps working, the choice just
    // doesn't survive a reload.
  }
}

/** The OS preference, as the boolean `resolveColorMode` wants. */
export function prefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches;
}

/** Subscribes to OS preference changes. Returns an unsubscribe function. */
export function watchPrefersDark(onChange: (dark: boolean) => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const query = matchMedia(DARK_QUERY);
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}

/**
 * Writes the resolved mode to `data-theme` on <html>, and returns it.
 *
 * Note what this deliberately does NOT do: run before first paint from an
 * inline script in index.html. The production CSP is `script-src 'self'` with
 * no `'unsafe-inline'` and no hash, so an inline script is blocked outright —
 * and blocked only in production, where the CSP is applied by CloudFront and
 * never in dev. Called from main.tsx before `createRoot`, this runs before the
 * app tree paints, which is sufficient while nothing outside the React tree is
 * painted from a token. See DESIGN.md for the options if that changes.
 */
export function applyColorMode(mode: ColorMode): ResolvedColorMode {
  const resolved = resolveColorMode(mode, prefersDark());
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}
