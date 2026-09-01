import { useState } from "react";
import { Check, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  curatedColorsFor,
  randomColorScheme,
  type ColorRole,
  type ColorScheme,
} from "@/lib/colorScheme";
import { SUGGESTED_THEMES, type SuggestedTheme } from "@/lib/suggestions";
import { cn } from "@/lib/utils";

interface ColorSchemeFormProps {
  colorScheme: ColorScheme;
  onChange: (colorScheme: ColorScheme) => void;
  /**
   * Applies a whole suggested theme — colours, fonts, and emojis. Optional so
   * the form still works where themes are not offered (the gallery, and any
   * caller that only owns colours).
   */
  onApplyTheme?: (theme: SuggestedTheme) => void;
  /** Opens the suggestions dialog, which lists every theme. */
  onSeeMoreThemes?: () => void;
}

/**
 * How many theme chips to show inline.
 *
 * Enough to fill one row in the editor's control column, and few enough that a
 * palette of ten does not become the tallest thing in the panel. The rest live
 * in the suggestions dialog, which is where someone browsing themes wants to be
 * anyway. They wrap to a second row below `sm`, which is the honest trade for
 * not measuring the container.
 */
const INLINE_THEME_COUNT = 4;

const ROLES: { role: ColorRole; label: string }[] = [
  { role: "backgroundColor", label: "Background" },
  { role: "cellColor", label: "Cell" },
  { role: "textColor", label: "Text" },
  { role: "titleColor", label: "Title" },
];

const THEME_SCHEMES = SUGGESTED_THEMES.map((theme) => theme.colorScheme);

/**
 * One colour of the card, as a large swatch that opens a picker.
 *
 * This replaces a bare `<input type="color">`. Those were the most conspicuous
 * thing wrong with the old UI — an unstyled native control sitting beside
 * styled ones — and they offered no guidance at all: every choice was equally
 * available and equally likely to look bad.
 *
 * The native input is still here, at the bottom of the popover. It is the
 * escape hatch, not the primary control: a curated grid answers "what looks
 * good" and the input answers "I know exactly what I want".
 */
function ColorSwatchField({
  role,
  label,
  value,
  onChange,
}: {
  role: ColorRole;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const curated = curatedColorsFor(role, THEME_SCHEMES);
  const inputId = `${role}-input`;

  return (
    // Fixed width, not a stretched grid column: at a wide viewport an equal-
    // fractions grid turns each swatch into a 400px banner, which stops reading
    // as "a colour" and starts reading as "a section".
    <div className="grid w-28 gap-2">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            // The swatch is the card's colour, so it cannot come from a token —
            // and against a white card a white swatch needs the border to exist
            // at all, which is why the ring is on the wrapper, not the fill.
            className={cn(
              "h-10 w-full rounded-md border border-border shadow-raised transition-transform",
              "hover:-translate-y-0.5",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            )}
            style={{ backgroundColor: value }}
            aria-label={`${label} colour, currently ${value}`}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <div className="grid gap-3">
            <p className="text-xs font-medium">{label} colour</p>
            <div className="grid grid-cols-6 gap-1.5">
              {curated.map((color) => {
                const selected = color === value.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onChange(color);
                      setOpen(false);
                    }}
                    aria-label={color}
                    aria-pressed={selected}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md border border-border",
                      "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                      selected && "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {selected && (
                      // mix-blend-difference so the tick stays visible on both a
                      // white and a near-black swatch without picking a colour.
                      <Check className="size-3.5 text-white mix-blend-difference" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 border-t border-border pt-4">
              <Label htmlFor={inputId} className="text-xs text-muted-foreground">
                Or any colour
              </Label>
              <input
                id={inputId}
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-md border border-border bg-transparent"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ColorSchemeForm({
  colorScheme,
  onChange,
  onApplyTheme,
  onSeeMoreThemes,
}: ColorSchemeFormProps) {
  const inlineThemes = SUGGESTED_THEMES.slice(0, INLINE_THEME_COUNT);
  const hiddenCount = SUGGESTED_THEMES.length - inlineThemes.length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        {ROLES.map(({ role, label }) => (
          <ColorSwatchField
            key={role}
            role={role}
            label={label}
            value={colorScheme[role]}
            onChange={(value) => onChange({ ...colorScheme, [role]: value })}
          />
        ))}
      </div>

      {onApplyTheme && (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">
            Or start from a theme — sets colours, fonts, and emojis together.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {inlineThemes.map((theme) => (
              <Chip
                key={theme.id}
                onClick={() => onApplyTheme(theme)}
                // Not `pressed`: applying a theme sets three schemes and the
                // user is free to edit any of them afterwards, so there is no
                // honest way to say a theme is still "the" current one.
                aria-label={`Apply the ${theme.label} theme`}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: theme.colorScheme.titleColor }}
                />
                {theme.label}
              </Chip>
            ))}
            {onSeeMoreThemes && hiddenCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onSeeMoreThemes}
                className="text-muted-foreground"
              >
                See {hiddenCount} more
              </Button>
            )}
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange(randomColorScheme())}
        className="justify-self-start"
      >
        <Shuffle aria-hidden />
        Randomize colors
      </Button>
    </div>
  );
}
