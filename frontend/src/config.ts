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
 * Null is a supported state, not an error: the editor, randomize, print, PNG,
 * and ?card= sharing must all work with no backend at all. A local checkout
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
