import { useState, type FormEvent } from "react";
import { Pencil, Pin, Trash2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCardSlotCount, getUniqueEntries, type BingoEntry } from "@/lib/bingo";
import { cn } from "@/lib/utils";
import { brand } from "@/brand";

interface EntryInputProps {
  entries: BingoEntry[];
  hasFreeSpace: boolean;
  onAdd: (entry: string) => void;
  onEdit: (index: number, entry: string) => void;
  onToggleMandatory: (index: number) => void;
  onToggleEnabled: (index: number) => void;
  onRemove: (index: number) => void;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function duplicatesAnotherEntry(entries: BingoEntry[], text: string, ignoreIndex?: number): boolean {
  const key = normalize(text);
  return entries.some((entry, i) => i !== ignoreIndex && normalize(entry.text) === key);
}

export function EntryInput({
  entries,
  hasFreeSpace,
  onAdd,
  onEdit,
  onToggleMandatory,
  onToggleEnabled,
  onRemove,
}: EntryInputProps) {
  const [draft, setDraft] = useState("");
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const slotCount = getCardSlotCount(hasFreeSpace);
  const enabledUnique = getUniqueEntries(entries).filter((entry) => entry.enabled !== false);
  const uniqueCount = enabledUnique.length;
  const filledCount = Math.min(uniqueCount, slotCount);
  const mandatoryCount = enabledUnique.filter((entry) => entry.mandatory).length;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;

    if (duplicatesAnotherEntry(entries, trimmed)) {
      setDuplicateError(`"${trimmed}" is already in the list.`);
      return;
    }

    onAdd(trimmed);
    setDraft("");
    setDuplicateError(null);
  }

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditDraft(entries[index].text);
    setEditError(null);
  }

  function cancelEditing() {
    setEditingIndex(null);
    setEditDraft("");
    setEditError(null);
  }

  function handleEditSubmit(event: FormEvent, index: number) {
    event.preventDefault();
    const trimmed = editDraft.trim();
    if (!trimmed) return;

    if (duplicatesAnotherEntry(entries, trimmed, index)) {
      setEditError(`"${trimmed}" is already in the list.`);
      return;
    }

    onEdit(index, trimmed);
    cancelEditing();
  }

  return (
    // No heading and no "See suggestions" button: both belong to the panel
    // around this, so the section is titled once and the suggestions dialog
    // stays the editor's concern rather than the entry list's.
    <div className="grid gap-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <Field htmlFor="entry-draft" label="Add an entry" className="flex-1">
          {({ id }) => (
            <Input
              id={id}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDuplicateError(null);
              }}
              placeholder={brand.copy.editor.entryPlaceholder}
            />
          )}
        </Field>
        <Button type="submit" className="shrink-0">
          Add
        </Button>
      </form>
      {duplicateError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{duplicateError}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        {filledCount} / {slotCount} cells filled
        {uniqueCount > slotCount && <> ({uniqueCount - slotCount} extra, used on randomize)</>}
      </p>

      {mandatoryCount > slotCount && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertDescription>
            {mandatoryCount} entries are marked mandatory, but only {slotCount} cells are available —
            not all of them can appear.
          </AlertDescription>
        </Alert>
      )}

      <ul className="grid gap-1 sm:grid-cols-2 sm:gap-x-6">
        {entries.map((entry, index) =>
          editingIndex === index ? (
            <li key={index} className="py-1 sm:col-span-full">
              <form onSubmit={(e) => handleEditSubmit(e, index)} className="flex gap-2">
                <Input
                  value={editDraft}
                  onChange={(e) => {
                    setEditDraft(e.target.value);
                    setEditError(null);
                  }}
                  aria-label={`Edit entry ${entry.text}`}
                  autoFocus
                />
                <Button type="submit" size="sm" className="shrink-0">
                  Save
                </Button>
                <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={cancelEditing}>
                  Cancel
                </Button>
              </form>
              {editError && (
                <Alert variant="destructive" className="mt-1">
                  <TriangleAlert />
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}
            </li>
          ) : (
            // `group` drives the hover reveal below. The row is a group rather
            // than the buttons being always-visible because two icon buttons per
            // entry, times 24 entries, is 48 competing targets on the screen.
            <li
              key={index}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-secondary/60",
                index % 2 === 1 && "sm:border-l sm:border-border sm:pl-4",
              )}
            >
              <Checkbox
                checked={entry.enabled !== false}
                onCheckedChange={() => onToggleEnabled(index)}
                aria-label={`Toggle ${entry.text} active`}
              />

              <span
                className={cn(
                  "flex-1 text-sm",
                  entry.enabled === false && "text-muted-foreground line-through",
                )}
              >
                {entry.text}
              </span>

              {/*
                Mandatory was a labelled switch; it is now a pin. A pinned entry
                is one that always appears, which is what a pin means everywhere
                else, and it costs a fifth of the row width.

                Not rendered at all for an inactive, unpinned entry: the button
                base carries `disabled:opacity-50`, which beats the hover-reveal
                `opacity-0` and left dead controls sitting visible on exactly the
                rows that had nothing to offer. A pinned-but-inactive entry keeps
                its pin, because that state is worth seeing.
              */}
              {(entry.mandatory || entry.enabled !== false) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-pressed={entry.mandatory}
                      disabled={entry.enabled === false}
                      onClick={() => onToggleMandatory(index)}
                      aria-label={`Mark ${entry.text} as mandatory`}
                      className={cn(
                        entry.mandatory
                          ? "text-primary hover:text-primary"
                          : "text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                      )}
                    >
                      <Pin className={cn(entry.mandatory && "fill-current")} aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {entry.mandatory ? "Always include this entry" : "Always include"}
                  </TooltipContent>
                </Tooltip>
              )}

              {/*
                Revealed on hover, but only visually: opacity keeps them in the
                tab order, and `group-focus-within` brings them back for anyone
                arriving by keyboard.
              */}
              <div className="flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => startEditing(index)}
                      aria-label={`Edit ${entry.text}`}
                    >
                      <Pencil aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemove(index)}
                      aria-label={`Remove ${entry.text}`}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
