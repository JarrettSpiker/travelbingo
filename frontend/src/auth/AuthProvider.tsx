import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authConfig } from "../config";
import {
  buildAuthorizeUrl,
  buildLogoutUrl,
  createCodeChallenge,
  createCodeVerifier,
  createState,
  decodeIdToken,
  isExpired,
} from "../lib/auth";
import { clearSession, loadSession, savePending, saveSession } from "../lib/authSession";
import { exchangeCodeForTokens, refreshTokens, type TokenSet } from "../lib/authTokens";
import { createApiClient } from "../lib/apiClient";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./authContext";

/**
 * The only new effect in the app, and the only place auth state changes.
 *
 * Two rules it must never break:
 *  - It renders children immediately, at status "loading". Authentication never
 *    gates first paint.
 *  - A visitor with no stored session makes zero network calls on load.
 *
 * Everything it decides — is this token expired, is this stored value a valid
 * session, what URL should we redirect to — lives in pure functions in
 * src/lib/, so this component holds the wiring and nothing else.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(authConfig ? "loading" : "anonymous");
  const [email, setEmail] = useState<string | null>(null);

  // Access and ID tokens are held in memory only; just the refresh token is
  // persisted. See authSession.ts for the trade-off.
  const tokensRef = useRef<TokenSet | null>(null);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const applyTokens = useCallback((set: TokenSet, previousRefreshToken: string | null) => {
    // A refresh response carries no new refresh token; keep the existing one.
    const refreshToken = set.refreshToken ?? previousRefreshToken;
    tokensRef.current = { ...set, refreshToken };

    const claims = set.idToken ? decodeIdToken(set.idToken) : null;
    if (claims) setEmail(claims.email);

    if (refreshToken) {
      saveSession({ refreshToken, email: claims?.email ?? null });
    }
    setStatus("authenticated");
  }, []);

  const signOutLocally = useCallback(() => {
    tokensRef.current = null;
    clearSession();
    setEmail(null);
    setStatus("anonymous");
  }, []);

  /** Exchanges the stored refresh token for a new access token, once at a time. */
  const doRefresh = useCallback(async (): Promise<string | null> => {
    if (!authConfig) return null;

    const stored = tokensRef.current?.refreshToken ?? loadSession()?.refreshToken ?? null;
    if (!stored) {
      signOutLocally();
      return null;
    }

    // Concurrent 401s must not each start their own refresh.
    refreshInFlight.current ??= (async () => {
      try {
        const set = await refreshTokens(authConfig, stored);
        if (!set) {
          signOutLocally();
          return null;
        }
        applyTokens(set, stored);
        return set.accessToken;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    return refreshInFlight.current;
  }, [applyTokens, signOutLocally]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = tokensRef.current;
    if (current && !isExpired(current.expiresAt)) {
      return current.accessToken;
    }
    return doRefresh();
  }, [doRefresh]);

  useEffect(() => {
    if (!authConfig) return;

    const session = loadSession();
    if (!session) {
      // The zero-network-call path, and by far the common one.
      setStatus("anonymous");
      return;
    }

    // Show the remembered email immediately, before the refresh resolves.
    setEmail(session.email);

    // Route through doRefresh rather than calling refreshTokens directly, so
    // this initial refresh shares the same in-flight guard as a 401-triggered
    // refresh. Without that, a refresh started here races any refresh started
    // by getAccessToken in the same window: two concurrent refreshes against
    // one Cognito refresh token can have one fail transiently and call
    // signOutLocally, clobbering a valid session the other just established.
    void doRefresh();
  }, [doRefresh]);

  const signIn = useCallback((returnTo?: string) => {
    if (!authConfig) return;

    void (async () => {
      const codeVerifier = createCodeVerifier();
      const state = createState();

      savePending({
        codeVerifier,
        state,
        returnTo: returnTo ?? `${window.location.pathname}${window.location.search}`,
      });

      window.location.assign(
        buildAuthorizeUrl(authConfig, {
          state,
          codeChallenge: await createCodeChallenge(codeVerifier),
        }),
      );
    })();
  }, []);

  const signOut = useCallback(() => {
    signOutLocally();
    if (authConfig) {
      // Cognito's logout endpoint revokes the refresh token; clearing it
      // locally alone would leave it usable.
      window.location.assign(buildLogoutUrl(authConfig));
    }
  }, [signOutLocally]);

  const completeSignIn = useCallback(
    async (code: string, codeVerifier: string): Promise<boolean> => {
      if (!authConfig) return false;

      const set = await exchangeCodeForTokens(authConfig, code, codeVerifier);
      if (!set) {
        signOutLocally();
        return false;
      }

      applyTokens(set, null);
      return true;
    },
    [applyTokens, signOutLocally],
  );

  const api = useMemo(
    () => createApiClient({ getAccessToken, refreshAccessToken: doRefresh, fetch: window.fetch.bind(window) }),
    [getAccessToken, doRefresh],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, email, accountsEnabled: authConfig !== null, signIn, signOut, completeSignIn, api }),
    [status, email, signIn, signOut, completeSignIn, api],
  );

  // Children render on the first pass, whatever the status.
  return <AuthContext value={value}>{children}</AuthContext>;
}
