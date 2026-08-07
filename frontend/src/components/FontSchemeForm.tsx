import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GOOGLE_FONT_OPTIONS, SYSTEM_FONT_OPTIONS, type FontScheme } from "@/lib/fontScheme";

interface FontSchemeFormProps {
  fontScheme: FontScheme;
  onChange: (fontScheme: FontScheme) => void;
}

/**
 * Each option previews itself in its own typeface — the only way to choose a
 * font is to see it. `style` rather than a class, because the values are font
 * stacks from `lib/fontScheme.ts`, not design tokens.
 */
function FontOptions() {
  return (
    <>
      <SelectGroup>
        <SelectLabel>System fonts</SelectLabel>
        {SYSTEM_FONT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value} style={{ fontFamily: option.value }}>
            {option.label}
          </SelectItem>
        ))}
      </SelectGroup>
      <SelectGroup>
        <SelectLabel>Google fonts</SelectLabel>
        {GOOGLE_FONT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value} style={{ fontFamily: option.value }}>
            {option.label}
          </SelectItem>
        ))}
      </SelectGroup>
    </>
  );
}

export function FontSchemeForm({ fontScheme, onChange }: FontSchemeFormProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field htmlFor="title-font" label="Title font">
          {({ id }) => (
            <Select
              value={fontScheme.titleFont}
              onValueChange={(value) => onChange({ ...fontScheme, titleFont: value })}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <FontOptions />
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field htmlFor="cell-font" label="Cell font">
          {({ id }) => (
            <Select
              value={fontScheme.cellFont}
              onValueChange={(value) => onChange({ ...fontScheme, cellFont: value })}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <FontOptions />
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
    </div>
  );
}
