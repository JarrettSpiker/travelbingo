import { useEffect, useState } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { BingoEntry } from "@/lib/bingo";
import {
  appendCells,
  SUGGESTED_CATEGORIES,
  SUGGESTED_THEMES,
  type SuggestedTheme,
} from "@/lib/suggestions";

interface SuggestionsDialogProps {
  open: boolean;
  onClose: () => void;
  entries: BingoEntry[];
  onAddEntries: (entries: BingoEntry[]) => void;
  onApplyTheme: (theme: SuggestedTheme) => void;
}

interface AddReport {
  added: number;
  skipped: number;
}

export function SuggestionsDialog({
  open,
  onClose,
  entries,
  onAddEntries,
  onApplyTheme,
}: SuggestionsDialogProps) {
  const [categoryId, setCategoryId] = useState<string>(SUGGESTED_CATEGORIES[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<AddReport | null>(null);

  useEffect(() => {
    if (open) {
      setCategoryId(SUGGESTED_CATEGORIES[0]?.id ?? "");
      setSelected(new Set());
      setReport(null);
    }
  }, [open]);

  const category = SUGGESTED_CATEGORIES.find((c) => c.id === categoryId) ?? SUGGESTED_CATEGORIES[0];

  function toggleCell(cell: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cell)) {
        next.delete(cell);
      } else {
        next.add(cell);
      }
      return next;
    });
  }

  function handleAdd() {
    const result = appendCells(entries, [...selected]);
    onAddEntries(result.entries);
    setReport({ added: result.added.length, skipped: result.skipped.length });
    setSelected(new Set());
  }

  function handleApplyTheme(theme: SuggestedTheme) {
    onApplyTheme(theme);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Suggestions</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          {SUGGESTED_THEMES.length > 0 && (
            <div className="grid gap-2">
              <h3 className="font-display text-sm font-semibold">Themes</h3>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_THEMES.map((theme) => (
                  <Chip key={theme.id} onClick={() => handleApplyTheme(theme)}>
                    {theme.emojiScheme.emojis.length > 0 && (
                      <span aria-hidden className="text-sm">
                        {theme.emojiScheme.emojis.join(" ")}
                      </span>
                    )}
                    {theme.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {SUGGESTED_THEMES.length > 0 && <Separator />}

          <div className="grid gap-3">
            <h3 className="font-display text-sm font-semibold">Cells</h3>
            {SUGGESTED_CATEGORIES.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No suggested cells are available right now.
              </p>
            ) : (
              <>
                <Field htmlFor="suggestion-category" label="Category">
                  {({ id }) => (
                    <Select
                      value={category?.id ?? ""}
                      onValueChange={(value) => {
                        setCategoryId(value);
                        setSelected(new Set());
                      }}
                    >
                      <SelectTrigger id={id} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUGGESTED_CATEGORIES.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                {/*
                  These are the chips the component exists for: each one is a
                  toggle, so it carries `pressed` and reports `aria-pressed`.
                */}
                <div className="flex flex-wrap gap-2">
                  {category?.cells.map((cell) => (
                    <Chip
                      key={cell}
                      pressed={selected.has(cell)}
                      onClick={() => toggleCell(cell)}
                      className="normal-case tracking-normal"
                    >
                      {cell}
                    </Chip>
                  ))}
                </div>

                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={selected.size === 0}
                  className="justify-self-start"
                >
                  Add selected{selected.size > 0 ? ` (${selected.size})` : ""}
                </Button>

                {report && (
                  <Alert variant={report.skipped > 0 ? "warning" : "default"}>
                    {report.skipped > 0 ? (
                      <TriangleAlert />
                    ) : (
                      <CircleCheck className="text-ocean" />
                    )}
                    <AlertDescription>
                      Added {report.added} {report.added === 1 ? "cell" : "cells"}.
                      {report.skipped > 0 &&
                        ` ${report.skipped} ${report.skipped === 1 ? "was" : "were"} already in your list and skipped.`}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
