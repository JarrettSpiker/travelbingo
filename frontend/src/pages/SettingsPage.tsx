import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Check, Info, TriangleAlert, User } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthMenu } from "@/components/AuthMenu";
import { Panel } from "@/components/Panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/auth/authContext";
import { MAX_DISPLAY_NAME_LENGTH, updateProfile } from "@/lib/profileApi";

/**
 * The account settings page.
 *
 * Strictly additive: signed-out visitors are redirected away and make zero
 * profile requests, so the account-free capabilities are untouched. The page is
 * built as a stack of {@link Panel} sections so future settings (notification
 * preferences, etc.) extend it as new sections without restructuring.
 */
export function SettingsPage() {
  const { api, status, accountsEnabled, displayName, setProfile } = useAuth();
  const navigate = useNavigate();

  // Seeded from the cached display name. `fieldSettledRef` becomes true once
  // the field has adopted the loaded value OR the user has typed — either way
  // the one-shot profile fetch must not overwrite the field afterwards, so a
  // user who reaches /settings while that fetch is in flight and starts typing
  // does not have their input clobbered when it resolves.
  const [value, setValue] = useState(displayName ?? "");
  const fieldSettledRef = useRef(displayName !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (fieldSettledRef.current || displayName === null) return;
    setValue(displayName);
    fieldSettledRef.current = true;
  }, [displayName]);

  if (!accountsEnabled) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <Alert variant="info">
            <Info />
            <AlertDescription>Accounts are not enabled in this build.</AlertDescription>
          </Alert>
          <Button onClick={() => void navigate("/")}>Back to the card editor</Button>
        </div>
      </AppShell>
    );
  }

  if (status === "loading") {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="flex justify-center py-12">
          <Spinner label="Loading settings" />
        </div>
      </AppShell>
    );
  }

  // A signed-out visitor cannot reach the settings page and must make zero
  // profile requests: redirect before rendering any settings surface.
  if (status === "anonymous") {
    return <Navigate to="/" replace />;
  }

  const overLength = value.length > MAX_DISPLAY_NAME_LENGTH;
  const dirty = value.trim() !== (displayName ?? "");

  async function submit(nextValue: string, successMessage: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const profile = await updateProfile(api, nextValue);
      setProfile(profile);
      setValue(profile.displayName ?? "");
      fieldSettledRef.current = true;
      setMessage(successMessage);
    } catch {
      setError("Could not save your display name. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell headerActions={<AuthMenu />}>
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold">Settings</h1>
          <Button variant="ghost" onClick={() => void navigate("/")}>
            Back to the editor
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert variant="info">
            <Check />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/*
          Each setting is its own Panel, so a future setting (notification
          preferences, etc.) is a new section here rather than a restructure.
        */}
        <Panel title="Display name" icon={User}>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Shown in place of your email wherever your identity appears to you. Leave it blank to use
              your email instead.
            </p>
            <div className="grid gap-1.5">
              <label htmlFor="display-name" className="text-sm font-medium">
                Display name
              </label>
              <Input
                id="display-name"
                value={value}
                onChange={(event) => {
                  fieldSettledRef.current = true;
                  setValue(event.target.value);
                }}
                // Mirrors the backend bound so the client cannot let a value
                // through that the server would reject.
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                aria-invalid={overLength}
                aria-describedby="display-name-help"
              />
              <p id="display-name-help" className="text-xs text-muted-foreground">
                Up to {MAX_DISPLAY_NAME_LENGTH} characters.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void submit(value, "Display name saved.")}
                disabled={saving || overLength || !dirty}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void submit("", "Display name cleared.")}
                disabled={saving || (displayName ?? "") === ""}
              >
                Clear
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
