import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface PanelProps {
  title: string;
  icon: LucideIcon;
  /** Buttons for the panel's header, right-aligned beside the title. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * One group of controls, as a collapsible surface.
 *
 * The editor's sections used to be bare stacks separated by whitespace alone,
 * which is most of why the app read as unfinished — nothing looked grouped
 * because nothing was. A panel is the smallest thing that fixes that: a card
 * surface, a hairline, and a named header.
 *
 * Depth is the border plus `shadow-raised`, never a shadow alone. Shadows all
 * but vanish against the dark background and the hairline is what carries
 * structure there.
 *
 * The panel owns the section heading, so the form components inside render none
 * of their own — otherwise every section would show its title twice.
 *
 * Every panel opens expanded. Collapsing is for getting a long section out of
 * the way once you are done with it, not a state anyone should have to undo on
 * arrival.
 */
export function Panel({ title, icon: Icon, actions, children, className }: PanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <section
        className={cn(
          "rounded-xl border border-border bg-card p-4 shadow-raised sm:p-6",
          className,
        )}
      >
        <div className={cn("flex items-center justify-between gap-2", open && "mb-4")}>
          {/*
            The trigger is the heading, not the whole header row: `actions` holds
            buttons, and a button inside a button is invalid markup that browsers
            resolve by dropping one of them.
          */}
          <h2 className="font-display text-lg font-semibold">
            <CollapsibleTrigger className="group -m-1 flex items-center gap-2 rounded-md p-1 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="whitespace-nowrap">{title}</span>
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90"
              />
            </CollapsibleTrigger>
          </h2>
          {/* Hidden while collapsed: an action for a section you cannot see is
              at best confusing and at worst acts on something off screen. */}
          {open && actions}
        </div>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
