import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyColorMode,
  nextColorMode,
  readStoredColorMode,
  storeColorMode,
  watchPrefersDark,
  type ColorMode,
} from "@/lib/colorMode";
import { cn } from "@/lib/utils";

const LABELS: Record<ColorMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const ICONS: Record<ColorMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/**
 * Cycles the colour mode: light → dark → system.
 *
 * Before this existed, dark mode followed the OS and nothing else, which meant
 * it could not be exercised in the review loop without changing a system
 * setting — so it was never actually reviewed. All the logic worth testing
 * lives in `lib/colorMode.ts`; this is the three lines that touch the DOM.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ColorMode>(readStoredColorMode);

  // `system` keeps deferring, so the OS flipping mid-session has to re-resolve.
  // An explicit choice ignores it — `applyColorMode` handles that — but the
  // subscription is unconditional so the mode can change back to `system`
  // without needing to re-subscribe.
  useEffect(() => watchPrefersDark(() => applyColorMode(mode)), [mode]);

  function handleClick() {
    const next = nextColorMode(mode);
    setMode(next);
    storeColorMode(next);
    applyColorMode(next);
  }

  const Icon = ICONS[mode];

  return (
    <button
      type="button"
      onClick={handleClick}
      // The label carries the state as well as the action, because the icon
      // alone cannot distinguish "dark" from "system, which is currently dark".
      aria-label={`Theme: ${LABELS[mode]}. Switch to ${LABELS[nextColorMode(mode)].toLowerCase()}.`}
      title={`Theme: ${LABELS[mode]}`}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground",
        "transition-colors hover:bg-secondary hover:text-foreground",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
