import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A selectable chip, styled as a passport stamp.
 *
 * The one component here with no shadcn equivalent. `badge` looks right but is
 * display-only — a `<span>` with no pressed state — and the suggestions dialog
 * needs chips the user toggles. So this is a real `<button>` carrying
 * `aria-pressed`, which is what makes the selection audible to a screen reader
 * rather than only visible.
 *
 * The stamp treatment (dashed border, slight rotation, letterspaced caps) is
 * this surface's one travel motif. Per DESIGN.md, a surface that uses chips
 * does not also get a perforated edge.
 */
const chipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border-2 border-dashed px-2.5 py-1 text-xs font-semibold tracking-wider uppercase transition-all select-none " +
    "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none " +
    "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3",
  {
    variants: {
      pressed: {
        // Unpressed reads as an empty stamp outline; pressed as one that has
        // been inked. Rotation only on the pressed state, so a wall of chips
        // stays a tidy grid until the user starts choosing.
        false: "border-border text-muted-foreground hover:border-stamp/60 hover:text-foreground",
        true: "-rotate-2 border-stamp bg-stamp/10 text-stamp",
      },
    },
    defaultVariants: { pressed: false },
  },
);

interface ChipProps
  extends Omit<React.ComponentProps<"button">, "aria-pressed">,
    Omit<VariantProps<typeof chipVariants>, "pressed"> {
  /** Selected state. Rendered as `aria-pressed`, not just as a colour. */
  pressed?: boolean;
}

export function Chip({ className, pressed = false, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      data-slot="chip"
      aria-pressed={pressed}
      className={cn(chipVariants({ pressed }), className)}
      {...props}
    />
  );
}
