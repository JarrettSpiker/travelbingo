import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { MapPin } from "lucide-react";
import { useAuth } from "@/auth/authContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
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
 * The app's one header. Sticky and translucent, so the map grid and the card
 * scroll visibly underneath it rather than the page feeling like four
 * separately hand-rolled screens.
 */
export function SiteHeader({ actions }: SiteHeaderProps) {
  const { accountsEnabled } = useAuth();

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
          to="/"
          className="mr-1 flex items-center gap-2 rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* The luggage-tag pin is this surface's one travel motif. The header
              gets a mark; it does not also get a perforated edge or a stamp. */}
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <MapPin className="size-4" aria-hidden />
          </span>
          {/* Below `sm` the mark carries the brand on its own — the words wrap
              onto two lines and shove the nav off the row. */}
          <span className="hidden font-display text-lg font-semibold tracking-tight sm:inline">
            Travel Bingo
          </span>
        </NavLink>

        <nav className="flex items-center gap-1 whitespace-nowrap" aria-label="Main">
          <NavLink to="/" end className={linkClasses}>
            Editor
          </NavLink>
          {/* Without accounts configured there is no library to link to, and
              the route would only ever offer a sign-in that cannot complete. */}
          {accountsEnabled && (
            <NavLink to="/cards" className={linkClasses}>
              My cards
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
