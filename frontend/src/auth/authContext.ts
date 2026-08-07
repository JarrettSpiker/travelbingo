import { createContext, use } from "react";
import type { ApiClient } from "../lib/apiClient";
import type { Profile } from "../lib/profileApi";

// Context and hook only, deliberately no components: frontend/.oxlintrc.json
// enables react/only-export-components, and mixing the two here would trip it.
// AuthProvider lives in its own file.

export type AuthStatus = "loading" | "anonymous" | "authenticated";

export interface AuthContextValue {
  /**
   * "loading" is the initial value and is never blocking — the provider renders
   * its children immediately. Signed-out visitors settle on "anonymous" without
   * a single network call.
   */
  status: AuthStatus;
  /** Display only, read from an unverified ID token. Never an authorization input. */
  email: string | null;
  /**
   * The display name on the caller's own profile, fetched once after auth
   * resolves. `null` until that fetch completes or if none is set; the menu then
   * falls back to {@link email}. Display only — never an authorization input.
   */
  displayName: string | null;
  /**
   * Updates the cached profile after a settings-page save, so the account menu
   * reflects a new display name without a reload.
   */
  setProfile: (profile: Profile) => void;
  /** False when the build has no Cognito configuration; account UI is hidden. */
  accountsEnabled: boolean;
  signIn: (returnTo?: string) => void;
  signOut: () => void;
  /**
   * Redeems an authorization code. Called only by the callback route, which
   * has already matched the returned `state` against the pending flow.
   */
  completeSignIn: (code: string, codeVerifier: string) => Promise<boolean>;
  api: ApiClient;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}
