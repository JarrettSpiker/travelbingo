import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  /** The auth affordance for the header. See SiteHeader's `actions`. */
  headerActions?: ReactNode;
  /**
   * `narrow` for a single message or prompt, `default` for a reading-width
   * screen, `wide` for the editor's two-column workspace.
   */
  size?: "narrow" | "default" | "wide";
  /** Extra classes for the <main> container. */
  className?: string;
}

/**
 * The page background, in three layers.
 *
 * Each is fine on its own and kitsch in combination with the others, so they
 * are deliberately quiet: a warm wash, a map graticule at 4%, and two soft
 * colour blots. The rule in DESIGN.md is at most one travel motif per surface —
 * this is the background's, which is why the header gets a mark and nothing
 * else, and why the perforated edge appears on exactly one panel.
 *
 * All of it is `aria-hidden` and `pointer-events-none`: it is decoration, it
 * must not be reachable by keyboard or screen reader, and it must not sit
 * between the user and a control.
 *
 * `absolute` rather than `fixed`, deliberately. Fixed looks marginally better
 * while scrolling, but it paints only the viewport, so every full-page
 * screenshot shows the background stopping partway down — and screenshots are
 * how this app is reviewed. Anchoring the blots to the document also keeps them
 * from sitting over the same part of the screen the whole way down a long page.
 *
 * The base page colour is NOT here — it is on <html> in index.css, so it paints
 * before React mounts rather than after a 260 kB bundle parses.
 */
function Background() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Wash: lifts the top of the page and lets the card sit on something. */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-ocean/[0.05]" />

      {/* Graticule. Masked, so it takes --foreground and reads in both modes —
          but a near-white line on ink navy carries much further than a dark one
          on cream, so dark needs less of it to land in the same place. */}
      <div className="bg-map-grid absolute inset-0 opacity-[0.045] dark:opacity-[0.028]" />

      {/* Two blots, far apart and far off-centre, so they read as light rather
          than as shapes. `blur-3xl` is doing most of the work.

          They are held back on narrow screens: a 32rem blot covers most of a
          390px viewport, which turns "a hint of warmth" into a coloured page. */}
      <div className="absolute -top-32 -left-24 size-64 rounded-full bg-primary/15 blur-3xl sm:-top-40 sm:-left-32 sm:size-[32rem] sm:bg-primary/20" />
      <div className="absolute -right-24 bottom-[-8rem] size-72 rounded-full bg-ocean/15 blur-3xl sm:-right-40 sm:bottom-[-12rem] sm:size-[36rem] sm:bg-ocean/20" />
    </div>
  );
}

/**
 * The frame every page sits in: background, header, and a centred main column.
 *
 * Before this, all four pages hand-rolled their own `Container`, which is why
 * they read as four separate screens rather than one app.
 */
export function AppShell({ children, headerActions, size = "default", className }: AppShellProps) {
  return (
    // `relative` so the background can be absolute against the whole document.
    // Deliberately NOT `overflow-hidden`: that would make this a scroll
    // container and the header would stop sticking. The blots are clipped by
    // the background's own wrapper instead.
    <div className="relative flex min-h-screen flex-col">
      <Background />
      <SiteHeader actions={headerActions} />
      <main
        className={cn(
          // `.app` is not a utility — it is the print hook in App.css that drops
          // this column's max-width and padding so the card can fill the page.
          // It lives here because this is the element that constrains the card;
          // callers should not have to know about it.
          "app",
          "mx-auto w-full flex-1 px-4 py-8 sm:px-6",
          size === "narrow" && "max-w-2xl",
          size === "default" && "max-w-4xl",
          size === "wide" && "max-w-6xl",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
