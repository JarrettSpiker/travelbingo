import { useEffect, useState } from "react";
import type { ResolvedColorMode } from "@/lib/colorMode";

function read(): ResolvedColorMode {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * The presentation currently on screen, as a value a component can branch on.
 *
 * Almost nothing needs this — CSS handles the theme, and a component that
 * branches on the mode in JavaScript is usually a component that should have
 * used a token. It exists for third-party widgets that take the mode as a prop
 * and cannot be styled from CSS alone; `emoji-picker-react` is the one.
 *
 * It watches the attribute rather than the media query, because the attribute
 * is the source of truth: it also reflects an explicit light/dark choice, which
 * `prefers-color-scheme` does not.
 */
export function useResolvedColorMode(): ResolvedColorMode {
  const [mode, setMode] = useState<ResolvedColorMode>(read);

  useEffect(() => {
    // Re-read on mount as well as on change: the attribute is written before
    // React mounts, and a state initialiser that ran during SSR or a replayed
    // render could be stale.
    setMode(read());
    const observer = new MutationObserver(() => setMode(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return mode;
}
