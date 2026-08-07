import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Label + control + helper/error text, composed.
 *
 * MUI's `TextField` bundled all of this into one component with `label`,
 * `helperText`, and `error` props. shadcn deliberately does not, so this is the
 * local stand-in — small enough to read in one sitting, and it keeps the three
 * pieces wired together correctly: the label points at the control, and the
 * helper text is announced with it via `aria-describedby`.
 *
 * Deliberately NOT react-hook-form. shadcn's `form` requires it; every input in
 * this app is a simple controlled value, and adding a form library to hold two
 * strings would be the tail wagging the dog.
 */
interface FieldProps extends Omit<React.ComponentProps<"div">, "children"> {
  /** Must match the control's `id`. */
  htmlFor: string;
  label: React.ReactNode;
  /** Shown under the control. Replaced by `error` when there is one. */
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** The control. Give it `id={htmlFor}` and `aria-describedby={describedBy}`. */
  children: (props: { id: string; describedBy: string | undefined }) => React.ReactNode;
}

export function Field({
  htmlFor,
  label,
  hint,
  error,
  className,
  children,
  ...props
}: FieldProps) {
  const message = error ?? hint;
  // Only claim a describedby when there is something to describe — pointing at
  // an element that does not exist is worse than pointing at nothing.
  const describedBy = message ? `${htmlFor}-description` : undefined;

  return (
    <div className={cn("grid gap-2", className)} {...props}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children({ id: htmlFor, describedBy })}
      {message && (
        <p
          id={describedBy}
          className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {message}
        </p>
      )}
    </div>
  );
}
