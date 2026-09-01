import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { brand } from "@/brand";
import { useAuth } from "@/auth/authContext";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

/*
  Capitalized so JSX treats it as a component rather than an HTML tag. Bound at
  module scope because the brand is a build-time constant — there is nothing to
  re-read per render.
*/
const MarkIcon = brand.MarkIcon;

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  cn(
    // Tighter below `sm`: three links plus the editor's save action have to
    // share a 390px row, and the padding is the cheapest thing to give back.
    "rounded-md px-2 py-1.5 text-sm font-medium transition-colors sm:px-2.5",
    "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
  );

interface SiteHeaderProps {
  /**
   * The auth affordance, passed in rather than rendered here.
   *
   * It differs by page — only the editor has a card to save — and it is still an
   * MUI component, which this file must not import: no file mixes the two
   * styling systems. A slot keeps that rule intact without waiting for the
   * component to migrate.
   */
  actions?: ReactNode;
}

/**
 * The app's one header. Sticky and translucent, so the page texture and the card
 * scroll visibly underneath it rather than the page feeling like four
 * separately hand-rolled screens.
 */
export function SiteHeader({ actions }: SiteHeaderProps) {
  const { accountsEnabled, status } = useAuth();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/70",
        // The blur is what lets the header stay legible over the background
        // without an opaque bar cutting the page in half.
        "bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60",
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <NavLink
          to={ROUTES.editor}
          className="mr-1 flex shrink-0 items-center gap-2 rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* The wordmark's mark is this surface's one motif slot. The header
              gets a mark; it does not also get a perforated edge or a stamp.
              Which mark it is belongs to the brand — see brand/<id>/BRAND.md. */}
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MarkIcon className="size-4" aria-hidden />
          </span>
          {/* Below `sm` the mark carries the brand on its own — the words wrap
              onto two lines and shove the nav off the row. */}
          <span className="hidden font-display text-lg font-semibold tracking-tight sm:inline">
            {brand.name}
          </span>
        </NavLink>

        {/*
          The nav is the row's only flexible part, and it scrolls rather than
          pushes: three links plus the account affordances exceed 390px, and a
          row that grows past the viewport takes the theme toggle off-screen
          and drags the page's background wash — which only paints to viewport
          width — into view beside every panel. `min-w-0` is what lets it
          shrink at all; without it the nav's content width is a floor the
          whole header inherits. The negative margin gives focus rings room to
          draw outside the scroll box.
        */}
        <nav
          className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 whitespace-nowrap"
          aria-label="Main"
        >
          <NavLink to={ROUTES.editor} end className={linkClasses}>
            Editor
          </NavLink>
          {/* Without accounts configured there is no library to link to, and
              the route would only ever offer a sign-in that cannot complete. */}
          {accountsEnabled && (
            <NavLink to={ROUTES.cards} className={linkClasses}>
              My cards
            </NavLink>
          )}
          {/* Trips are account-only and gated to signed-in visitors, so the
              entry point never appears for a signed-out first paint. */}
          {accountsEnabled && status === "authenticated" && (
            <NavLink to={ROUTES.trips} className={linkClasses}>
              {brand.copy.nav.trips}
            </NavLink>
          )}
        </nav>

        {/* `shrink-0`: the account menu and theme toggle are the row's fixed
            anchor. Whatever else has to give, these stay on screen. */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions}
          {/* Notifications are account-only: no bell, and no request, for a
              signed-out visitor. */}
          {accountsEnabled && status === "authenticated" && <NotificationBell />}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
