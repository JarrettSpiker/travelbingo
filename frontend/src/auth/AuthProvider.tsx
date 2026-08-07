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
import { getProfile } from "../lib/profileApi";
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
  // The display name arrives from a one-shot profile fetch once authentication
  // resolves (see the effect below). null means "not set or not loaded yet";
  // the account menu falls back to the email in that case.
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Bumped whenever the cached profile is updated directly (a settings-page
  // save), so a still-in-flight one-shot GET cannot land afterwards and
  // overwrite the newer value with a stale one.
  const profileEpochRef = useRef(0);

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
    setDisplayName(null);
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

  /**
   * Called by the settings page after a successful save, so the account menu
   * reflects the new display name without a reload — the scenario the spec
   * pins. Only the cached field is touched; no network call. Bumps the epoch so
   * a still-in-flight one-shot GET cannot overwrite this newer value.
   */
  const setProfile = useCallback((profile: { displayName: string | null }) => {
    profileEpochRef.current += 1;
    setDisplayName(profile.displayName);
  }, []);

  // The profile is fetched once per signed-in session, after authentication
  // resolves — never when signed out or when the build has no Cognito config.
  // It is non-blocking and non-fatal: until it resolves, or if it fails
  // transiently, displayName stays null and the menu falls back to the email.
  // On a token-refresh-driven re-auth within the same session status does not
  // change (it stays "authenticated") and `api` is memoized, so this does not
  // refetch on every 401 refresh. The epoch guard drops a response that lost a
  // race against a settings-page save.
  useEffect(() => {
    if (status !== "authenticated") return;
    const epoch = profileEpochRef.current;
    let cancelled = false;
    void (async () => {
      try {
        const profile = await getProfile(api);
        if (cancelled || profileEpochRef.current !== epoch) return;
        setDisplayName(profile.displayName);
      } catch {
        // Non-fatal: leave displayName at null; the email fallback still shows.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, api]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      email,
      displayName,
      accountsEnabled: authConfig !== null,
      setProfile,
      signIn,
      signOut,
      completeSignIn,
      api,
    }),
    [status, email, displayName, setProfile, signIn, signOut, completeSignIn, api],
  );

  // Children render on the first pass, whatever the status.
  return <AuthContext value={value}>{children}</AuthContext>;
}
