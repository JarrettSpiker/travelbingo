export interface AuthConfig {
  /** Cognito hosted UI host, e.g. travelbingo-dev.auth.us-east-1.amazoncognito.com */
  cognitoDomain: string;
  /** Public SPA client id. Not a secret — it appears in every sign-in redirect. */
  cognitoClientId: string;
  /** Origin the app is served from, used to build the redirect URI. */
  appOrigin: string;
}

function read(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Account configuration, or null when it is absent.
 *
 * Null is a supported state, not an error: the editor, randomize, print, and
 * PNG export must all work with no backend at all. A local checkout
 * with no frontend/.env.local simply has no account features. What null must
 * never do is break the app or trigger a network call.
 */
export const authConfig: AuthConfig | null = (() => {
  const cognitoDomain = read(import.meta.env.VITE_COGNITO_DOMAIN);
  const cognitoClientId = read(import.meta.env.VITE_COGNITO_CLIENT_ID);
  const appOrigin = read(import.meta.env.VITE_APP_ORIGIN) ?? window.location.origin;

  if (!cognitoDomain || !cognitoClientId) {
    return null;
  }

  return { cognitoDomain, cognitoClientId, appOrigin };
})();

export const accountsEnabled = authConfig !== null;

/**
 * The source revision this bundle was built from, or "unknown".
 *
 * Deliberately does NOT follow `VITE_BRAND`'s rule, and the difference is not
 * guessable from looking at them, so: `VITE_BRAND` is validated in
 * vite.config.ts and fails the build when unset, because shipping one brand's
 * assets to another brand's bucket is silent and unrecoverable. This value
 * fails nothing. A local `npm run build` has no commit to report, and breaking
 * the ordinary development loop would protect nothing — the worst case here is
 * a feedback report that says "unknown" where a SHA would have been.
 *
 * Read straight from the environment rather than through a `define`, because
 * there is no fail-loud behaviour to arrange.
 */
export const buildSha: string = read(import.meta.env.VITE_COMMIT_SHA) ?? "unknown";
